import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { CreateProductDto } from './dtos/create-product.dto';
import { UpdateProductDto } from './dtos/update-product.dto';
import { QueryProductsDto } from './dtos/query-products.dto';
import {
  PaginatedProductsDto,
  ProductItemDto,
  ProductSearchResultDto,
} from './dtos/product-response.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  /**
   * Creates a new product master record.
   * If initialStock > 0 is provided, internally calls LedgerService to create
   * exactly one stock_ledger entry and one stock_balances row within an atomic transaction.
   */
  async create(dto: CreateProductDto, actorId: string): Promise<ProductItemDto> {
    const sku = dto.sku.trim();

    // 1. Pre-validation of SKU uniqueness for friendly API response
    const existing = await this.prisma.product.findUnique({
      where: { sku },
    });
    if (existing) {
      throw new ConflictException(`Product with SKU "${sku}" already exists`);
    }

    // 2. Validate category if provided
    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new NotFoundException(`Category with ID "${dto.categoryId}" not found`);
      }
    }

    // 3. Validate UoM if provided
    if (dto.uomId) {
      const uom = await this.prisma.unitOfMeasure.findUnique({
        where: { id: dto.uomId },
      });
      if (!uom) {
        throw new NotFoundException(`Unit of measure with ID "${dto.uomId}" not found`);
      }
    }

    // 4. Resolve initial warehouse location if initial stock is requested
    let targetLocationId = dto.initialLocationId;
    if (dto.initialStock && dto.initialStock > 0) {
      if (targetLocationId) {
        const location = await this.prisma.location.findUnique({
          where: { id: targetLocationId },
        });
        if (!location) {
          throw new NotFoundException(
            `Initial stock location with ID "${targetLocationId}" not found`,
          );
        }
      } else {
        const defaultLoc =
          (await this.prisma.location.findFirst({
            where: { type: 'WAREHOUSE' },
            orderBy: { shortCode: 'asc' },
          })) || (await this.prisma.location.findFirst());

        if (!defaultLoc) {
          throw new BadRequestException(
            'Cannot assign initial stock: No warehouse location found. Please create a warehouse location first or specify initialLocationId.',
          );
        }
        targetLocationId = defaultLoc.id;
      }
    }

    try {
      if (dto.initialStock && dto.initialStock > 0) {
        // Execute atomic creation with initial stock ledger entry
        return await this.prisma.$transaction(async (tx) => {
          const product = await tx.product.create({
            data: {
              sku,
              name: dto.name.trim(),
              unitCost: dto.unitCost ?? 0.0,
              categoryId: dto.categoryId ?? null,
              uomId: dto.uomId ?? null,
              reorderPoint: dto.reorderPoint ?? 10,
              reorderQty: dto.reorderQty ?? 50,
            },
            include: {
              category: true,
              uom: true,
            },
          });

          // Record initial stock via LedgerService stub
          await this.ledgerService.recordInitialStock(
            {
              productId: product.id,
              locationId: targetLocationId!,
              quantity: dto.initialStock!,
              actorId,
            },
            tx,
          );

          const balances = await tx.stockBalance.findMany({
            where: { productId: product.id },
            include: { location: true },
          });

          const totalStock = dto.initialStock!;
          const isLowStock = totalStock <= product.reorderPoint;

          this.logger.log(
            `Product created with initial stock: ${product.sku} (+${dto.initialStock} at location ${targetLocationId})`,
          );

          return {
            ...product,
            unitCost: Number(product.unitCost),
            balances,
            totalStock,
            isLowStock,
          };
        });
      } else {
        // Simple product creation without initial stock
        const product = await this.prisma.product.create({
          data: {
            sku,
            name: dto.name.trim(),
            unitCost: dto.unitCost ?? 0.0,
            categoryId: dto.categoryId ?? null,
            uomId: dto.uomId ?? null,
            reorderPoint: dto.reorderPoint ?? 10,
            reorderQty: dto.reorderQty ?? 50,
          },
          include: {
            category: true,
            uom: true,
            balances: {
              include: { location: true },
            },
          },
        });

        this.logger.log(`Product created: ${product.sku} (${product.id})`);
        return {
          ...product,
          unitCost: Number(product.unitCost),
          totalStock: 0,
          isLowStock: 0 <= product.reorderPoint,
        };
      }
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`Product with SKU "${sku}" already exists`);
      }
      throw err;
    }
  }

  async findAll(query: QueryProductsDto): Promise<PaginatedProductsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {};

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { sku: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [rawProducts, totalItems] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          category: true,
          uom: true,
          balances: {
            include: { location: true },
          },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    let items: ProductItemDto[] = rawProducts.map((p) => {
      const totalStock = p.balances.reduce((acc, b) => acc + b.quantity, 0);
      return {
        ...p,
        unitCost: Number(p.unitCost),
        totalStock,
        isLowStock: totalStock <= p.reorderPoint,
      };
    });

    if (query.lowStock !== undefined) {
      items = items.filter((p) => p.isLowStock === query.lowStock);
    }

    const totalPages = Math.ceil(totalItems / limit) || 1;

    return {
      items,
      meta: {
        page,
        limit,
        totalItems,
        totalPages,
      },
    };
  }

  async findOne(id: string): Promise<ProductItemDto> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        uom: true,
        balances: {
          include: { location: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID "${id}" not found`);
    }

    const totalStock = product.balances.reduce((acc, b) => acc + b.quantity, 0);

    return {
      ...product,
      unitCost: Number(product.unitCost),
      totalStock,
      isLowStock: totalStock <= product.reorderPoint,
    };
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductItemDto> {
    const product = await this.findOne(id);

    if (dto.sku && dto.sku.trim() !== product.sku) {
      const newSku = dto.sku.trim();
      const existing = await this.prisma.product.findUnique({
        where: { sku: newSku },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Product with SKU "${newSku}" already exists`);
      }
    }

    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new NotFoundException(`Category with ID "${dto.categoryId}" not found`);
      }
    }

    if (dto.uomId) {
      const uom = await this.prisma.unitOfMeasure.findUnique({
        where: { id: dto.uomId },
      });
      if (!uom) {
        throw new NotFoundException(`Unit of measure with ID "${dto.uomId}" not found`);
      }
    }

    try {
      const updated = await this.prisma.product.update({
        where: { id },
        data: {
          ...(dto.sku ? { sku: dto.sku.trim() } : {}),
          ...(dto.name ? { name: dto.name.trim() } : {}),
          ...(dto.unitCost !== undefined ? { unitCost: dto.unitCost } : {}),
          ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
          ...(dto.uomId !== undefined ? { uomId: dto.uomId } : {}),
          ...(dto.reorderPoint !== undefined ? { reorderPoint: dto.reorderPoint } : {}),
          ...(dto.reorderQty !== undefined ? { reorderQty: dto.reorderQty } : {}),
        },
        include: {
          category: true,
          uom: true,
          balances: {
            include: { location: true },
          },
        },
      });

      const totalStock = updated.balances.reduce((acc, b) => acc + b.quantity, 0);

      this.logger.log(`Product updated: ${updated.sku} (${updated.id})`);
      return {
        ...updated,
        unitCost: Number(updated.unitCost),
        totalStock,
        isLowStock: totalStock <= updated.reorderPoint,
      };
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`Product with SKU "${dto.sku}" already exists`);
      }
      throw err;
    }
  }

  /**
   * Safe product removal.
   * INVARIANT: Deletion is strictly BLOCKED if stock_ledger entries or document lines exist.
   */
  async remove(id: string): Promise<{ message: string; id: string }> {
    const product = await this.findOne(id);

    const ledgerCount = await this.prisma.stockLedger.count({
      where: { productId: id },
    });
    if (ledgerCount > 0) {
      throw new ConflictException(
        `Cannot delete product "${product.name}" [${product.sku}]: ${ledgerCount} stock ledger audit entry(ies) exist. Products with inventory movement history cannot be deleted.`,
      );
    }

    const docLineCount = await this.prisma.documentLine.count({
      where: { productId: id },
    });
    if (docLineCount > 0) {
      throw new ConflictException(
        `Cannot delete product "${product.name}" [${product.sku}]: it is referenced in ${docLineCount} document line(s).`,
      );
    }

    // Clean up empty 0-quantity balances
    await this.prisma.stockBalance.deleteMany({
      where: { productId: id },
    });

    await this.prisma.product.delete({
      where: { id },
    });

    this.logger.log(`Product deleted: ${product.sku} (${id})`);
    return {
      message: `Product "${product.name}" [${product.sku}] successfully deleted`,
      id,
    };
  }

  /**
   * Smart fuzzy search leveraging Postgres GIN trigram indexes (pg_trgm).
   * Accelerates partial SKU/name inputs, typo tolerance, and returns relevance-ranked results.
   */
  async search(query: string, limit = 20, offset = 0): Promise<ProductSearchResultDto[]> {
    const cleanQuery = (query || '').trim();
    if (!cleanQuery) {
      return [];
    }

    const results = await this.prisma.$queryRaw<
      Array<{
        id: string;
        sku: string;
        name: string;
        unitCost: Prisma.Decimal;
        categoryName: string | null;
        uomName: string | null;
        uomCode: string | null;
        totalStock: number;
        reorderPoint: number;
        reorderQty: number;
        similarityScore: number;
      }>
    >`
      SELECT p.id,
             p.sku,
             p.name,
             p.unit_cost AS "unitCost",
             c.name AS "categoryName",
             u.name AS "uomName",
             u.code AS "uomCode",
             COALESCE((
               SELECT SUM(sb.quantity)::integer
               FROM stock_balances sb
               WHERE sb.product_id = p.id
             ), 0) AS "totalStock",
             p.reorder_point AS "reorderPoint",
             p.reorder_qty AS "reorderQty",
             GREATEST(
               similarity(p.sku, ${cleanQuery}),
               similarity(p.name, ${cleanQuery})
             )::float AS "similarityScore"
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN units_of_measure u ON p.uom_id = u.id
      WHERE p.sku % ${cleanQuery}
         OR p.name % ${cleanQuery}
         OR p.sku ILIKE ('%' || ${cleanQuery} || '%')
         OR p.name ILIKE ('%' || ${cleanQuery} || '%')
      ORDER BY "similarityScore" DESC, p.name ASC
      LIMIT ${limit} OFFSET ${offset};
    `;

    return results.map((r) => ({
      id: r.id,
      sku: r.sku,
      name: r.name,
      unitCost: Number(r.unitCost),
      categoryName: r.categoryName,
      uomName: r.uomName,
      uomCode: r.uomCode,
      totalStock: Number(r.totalStock),
      reorderPoint: r.reorderPoint,
      reorderQty: r.reorderQty,
      similarityScore: Number(r.similarityScore),
    }));
  }
}
