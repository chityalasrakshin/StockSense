import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateLocationDto } from './dtos/create-location.dto';
import { UpdateLocationDto } from './dtos/update-location.dto';
import { QueryLocationsDto } from './dtos/query-locations.dto';
import { LocationItemDto, LocationTreeNodeDto } from './dtos/location-response.dto';
import { LocationType, Prisma } from '@prisma/client';

@Injectable()
export class WarehousesService {
  private readonly logger = new Logger(WarehousesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLocationDto): Promise<LocationItemDto> {
    const existing = await this.prisma.location.findUnique({
      where: { shortCode: dto.shortCode.trim().toUpperCase() },
    });

    if (existing) {
      throw new ConflictException(
        `Location with short code "${dto.shortCode}" already exists`,
      );
    }

    if (dto.parentId) {
      const parent = await this.prisma.location.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException(`Parent location with ID "${dto.parentId}" not found`);
      }
    }

    const location = await this.prisma.location.create({
      data: {
        name: dto.name.trim(),
        shortCode: dto.shortCode.trim().toUpperCase(),
        type: dto.type ?? LocationType.WAREHOUSE,
        parentId: dto.parentId ?? null,
      },
      include: {
        parent: true,
        _count: {
          select: {
            children: true,
            balances: true,
          },
        },
      },
    });

    this.logger.log(
      `Location created: [${location.shortCode}] ${location.name} (${location.type})`,
    );
    return location;
  }

  async findAll(query?: QueryLocationsDto): Promise<LocationItemDto[]> {
    const where: Prisma.LocationWhereInput = {};

    if (query?.type) {
      where.type = query.type;
    }

    if (query?.parentId !== undefined) {
      where.parentId = query.parentId;
    }

    if (query?.search) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { shortCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.location.findMany({
      where,
      include: {
        parent: true,
        _count: {
          select: {
            children: true,
            balances: true,
          },
        },
      },
      orderBy: [{ type: 'asc' }, { shortCode: 'asc' }],
    });
  }

  /**
   * Retrieves the full location hierarchy as an ERPNext-style recursive tree
   * (e.g. WAREHOUSE -> ZONE -> RACK -> BIN).
   */
  async getTree(): Promise<LocationTreeNodeDto[]> {
    const allLocations = await this.prisma.location.findMany({
      orderBy: [{ type: 'asc' }, { shortCode: 'asc' }],
    });

    const locationMap = new Map<string, LocationTreeNodeDto>();
    for (const loc of allLocations) {
      locationMap.set(loc.id, {
        id: loc.id,
        name: loc.name,
        shortCode: loc.shortCode,
        type: loc.type,
        parentId: loc.parentId,
        children: [],
      });
    }

    const tree: LocationTreeNodeDto[] = [];
    for (const loc of allLocations) {
      const node = locationMap.get(loc.id)!;
      if (loc.parentId && locationMap.has(loc.parentId)) {
        locationMap.get(loc.parentId)!.children.push(node);
      } else {
        tree.push(node);
      }
    }

    return tree;
  }

  async findOne(id: string): Promise<LocationItemDto> {
    const location = await this.prisma.location.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
        _count: {
          select: {
            children: true,
            balances: true,
          },
        },
      },
    });

    if (!location) {
      throw new NotFoundException(`Location with ID "${id}" not found`);
    }

    return location;
  }

  async update(id: string, dto: UpdateLocationDto): Promise<LocationItemDto> {
    const location = await this.findOne(id);

    if (dto.shortCode && dto.shortCode.trim().toUpperCase() !== location.shortCode) {
      const existing = await this.prisma.location.findUnique({
        where: { shortCode: dto.shortCode.trim().toUpperCase() },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Location with short code "${dto.shortCode}" already exists`,
        );
      }
    }

    if (dto.parentId !== undefined && dto.parentId !== null) {
      if (dto.parentId === id) {
        throw new ConflictException('A location cannot be its own parent');
      }

      const parent = await this.prisma.location.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException(`Parent location with ID "${dto.parentId}" not found`);
      }

      // Check circular reference by traversing parent hierarchy
      let currentParentId: string | null = parent.parentId;
      while (currentParentId) {
        if (currentParentId === id) {
          throw new ConflictException(
            'Circular location hierarchy detected: location cannot have a descendant as its parent',
          );
        }
        const ancestor = await this.prisma.location.findUnique({
          where: { id: currentParentId },
        });
        currentParentId = ancestor?.parentId ?? null;
      }
    }

    return this.prisma.location.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.shortCode ? { shortCode: dto.shortCode.trim().toUpperCase() } : {}),
        ...(dto.type ? { type: dto.type } : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
      },
      include: {
        parent: true,
        children: true,
        _count: {
          select: {
            children: true,
            balances: true,
          },
        },
      },
    });
  }

  /**
   * Safe removal of warehouse / location.
   * INVARIANT: Location deletion is strictly BLOCKED if:
   * 1. It has child locations (zones/racks/bins)
   * 2. It holds positive stock in stock_balances
   * 3. It is referenced in documents (source or dest)
   * 4. It has historical stock_ledger entries
   */
  async remove(id: string): Promise<{ message: string; id: string }> {
    const location = await this.findOne(id);

    const childCount = await this.prisma.location.count({
      where: { parentId: id },
    });
    if (childCount > 0) {
      throw new ConflictException(
        `Cannot delete location [${location.shortCode}]: it has ${childCount} child sub-location(s). Please delete or reassign child locations first.`,
      );
    }

    const activeBalances = await this.prisma.stockBalance.count({
      where: { locationId: id, quantity: { gt: 0 } },
    });
    if (activeBalances > 0) {
      throw new ConflictException(
        `Cannot delete location [${location.shortCode}]: positive stock balances exist at this location.`,
      );
    }

    const docCount = await this.prisma.document.count({
      where: {
        OR: [{ sourceLocationId: id }, { destLocationId: id }],
      },
    });
    if (docCount > 0) {
      throw new ConflictException(
        `Cannot delete location [${location.shortCode}]: it is referenced by ${docCount} workflow document(s).`,
      );
    }

    const ledgerCount = await this.prisma.stockLedger.count({
      where: { locationId: id },
    });
    if (ledgerCount > 0) {
      throw new ConflictException(
        `Cannot delete location [${location.shortCode}]: audit ledger records exist for this location.`,
      );
    }

    // Clean up empty 0-quantity balance rows before removing location
    await this.prisma.stockBalance.deleteMany({
      where: { locationId: id },
    });

    await this.prisma.location.delete({
      where: { id },
    });

    this.logger.log(`Location deleted: [${location.shortCode}] ${location.name} (${id})`);
    return {
      message: `Location [${location.shortCode}] successfully deleted`,
      id,
    };
  }
}
