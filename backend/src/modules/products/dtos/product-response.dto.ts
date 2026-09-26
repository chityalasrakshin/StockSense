import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CategoryItemDto } from '../../categories/dtos/category-response.dto';
import { UomItemDto } from '../../uoms/dtos/uom-response.dto';
import { LocationItemDto } from '../../warehouses/dtos/location-response.dto';

export class ProductStockBalanceDto {
  @ApiProperty({ example: 'p0000000-0000-0000-0000-000000000001' })
  productId!: string;

  @ApiProperty({ example: 'l0000000-0000-0000-0000-000000000001' })
  locationId!: string;

  @ApiProperty({ example: 47 })
  quantity!: number;

  @ApiProperty({ example: '2026-09-26T12:00:00.000Z' })
  updatedAt!: Date;

  @ApiPropertyOptional({ type: () => LocationItemDto })
  location?: LocationItemDto;
}

export class ProductItemDto {
  @ApiProperty({ example: 'p0000000-0000-0000-0000-000000000001' })
  id!: string;

  @ApiProperty({ example: 'STEEL-ROD-001' })
  sku!: string;

  @ApiProperty({ example: 'Steel Rods' })
  name!: string;

  @ApiProperty({ example: 45.0 })
  unitCost!: number;

  @ApiPropertyOptional({ example: 'c0000000-0000-0000-0000-000000000001', nullable: true })
  categoryId!: string | null;

  @ApiPropertyOptional({ example: 'u0000000-0000-0000-0000-000000000001', nullable: true })
  uomId!: string | null;

  @ApiProperty({ example: 25 })
  reorderPoint!: number;

  @ApiProperty({ example: 100 })
  reorderQty!: number;

  @ApiProperty({ example: 77 })
  totalStock!: number;

  @ApiProperty({ example: false })
  isLowStock!: boolean;

  @ApiProperty({ example: '2026-09-26T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-09-26T12:00:00.000Z' })
  updatedAt!: Date;

  @ApiPropertyOptional({ type: () => CategoryItemDto, nullable: true })
  category?: CategoryItemDto | null;

  @ApiPropertyOptional({ type: () => UomItemDto, nullable: true })
  uom?: UomItemDto | null;

  @ApiPropertyOptional({ type: () => [ProductStockBalanceDto] })
  balances?: ProductStockBalanceDto[];
}

export class ProductPaginationMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  totalItems!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class PaginatedProductsDto {
  @ApiProperty({ type: () => [ProductItemDto] })
  items!: ProductItemDto[];

  @ApiProperty({ type: () => ProductPaginationMetaDto })
  meta!: ProductPaginationMetaDto;
}

export class ProductSearchResultDto {
  @ApiProperty({ example: 'p0000000-0000-0000-0000-000000000001' })
  id!: string;

  @ApiProperty({ example: 'STEEL-ROD-001' })
  sku!: string;

  @ApiProperty({ example: 'Steel Rods' })
  name!: string;

  @ApiProperty({ example: 45.0 })
  unitCost!: number;

  @ApiPropertyOptional({ example: 'Metals & Alloys', nullable: true })
  categoryName?: string | null;

  @ApiPropertyOptional({ example: 'Kilograms', nullable: true })
  uomName?: string | null;

  @ApiPropertyOptional({ example: 'kg', nullable: true })
  uomCode?: string | null;

  @ApiProperty({ example: 77 })
  totalStock!: number;

  @ApiProperty({ example: 25 })
  reorderPoint!: number;

  @ApiProperty({ example: 100 })
  reorderQty!: number;

  @ApiProperty({ example: 0.545455 })
  similarityScore!: number;
}
