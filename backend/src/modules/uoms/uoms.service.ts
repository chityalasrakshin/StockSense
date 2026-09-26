import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateUomDto } from './dtos/create-uom.dto';
import { UpdateUomDto } from './dtos/update-uom.dto';
import { UomItemDto } from './dtos/uom-response.dto';

@Injectable()
export class UomsService {
  private readonly logger = new Logger(UomsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUomDto): Promise<UomItemDto> {
    const existing = await this.prisma.unitOfMeasure.findUnique({
      where: { code: dto.code.trim() },
    });

    if (existing) {
      throw new ConflictException(`Unit of measure with code "${dto.code}" already exists`);
    }

    const uom = await this.prisma.unitOfMeasure.create({
      data: {
        code: dto.code.trim(),
        name: dto.name.trim(),
      },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    this.logger.log(`Unit of measure created: ${uom.code} - ${uom.name} (${uom.id})`);
    return uom;
  }

  async findAll(): Promise<UomItemDto[]> {
    return this.prisma.unitOfMeasure.findMany({
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  async findOne(id: string): Promise<UomItemDto> {
    const uom = await this.prisma.unitOfMeasure.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!uom) {
      throw new NotFoundException(`Unit of measure with ID "${id}" not found`);
    }

    return uom;
  }

  async update(id: string, dto: UpdateUomDto): Promise<UomItemDto> {
    const uom = await this.findOne(id);

    if (dto.code && dto.code.trim() !== uom.code) {
      const existing = await this.prisma.unitOfMeasure.findUnique({
        where: { code: dto.code.trim() },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Unit of measure with code "${dto.code}" already exists`);
      }
    }

    return this.prisma.unitOfMeasure.update({
      where: { id },
      data: {
        ...(dto.code ? { code: dto.code.trim() } : {}),
        ...(dto.name ? { name: dto.name.trim() } : {}),
      },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
  }

  /**
   * Safe removal of Units of Measure.
   * INVARIANT: Deletion is strictly BLOCKED if any products reference this UoM.
   */
  async remove(id: string): Promise<{ message: string; id: string }> {
    const uom = await this.findOne(id);

    const productCount = await this.prisma.product.count({
      where: { uomId: id },
    });

    if (productCount > 0) {
      throw new ConflictException(
        `Cannot delete unit of measure "${uom.code}": it is assigned to ${productCount} product(s). Please reassign or remove them first.`,
      );
    }

    await this.prisma.unitOfMeasure.delete({
      where: { id },
    });

    this.logger.log(`Unit of measure deleted: ${uom.code} (${id})`);
    return {
      message: `Unit of measure "${uom.code}" successfully deleted`,
      id,
    };
  }
}
