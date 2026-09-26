import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class AlertsQueryDto {
  @ApiPropertyOptional({
    enum: ['OPEN', 'RESOLVED'],
    description: 'Filter by alert status (OPEN or RESOLVED)',
    example: 'OPEN',
  })
  @IsOptional()
  @IsEnum(['OPEN', 'RESOLVED'])
  status?: 'OPEN' | 'RESOLVED';

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @ApiPropertyOptional({ description: 'Filter alerts by product SKU or name' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class ProductAlertDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  sku!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  unitCost!: number;
}

export class LocationAlertDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  shortCode!: string;
}

export class LowStockAlertItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty()
  locationId!: string;

  @ApiProperty()
  currentStock!: number;

  @ApiProperty()
  currentBalance!: number;

  @ApiProperty()
  reorderPoint!: number;

  @ApiProperty({ enum: ['OPEN', 'RESOLVED'] })
  status!: string;

  @ApiProperty()
  openedAt!: string;

  @ApiProperty({ nullable: true })
  resolvedAt!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty({ type: ProductAlertDto })
  product!: ProductAlertDto;

  @ApiProperty({ type: LocationAlertDto })
  location!: LocationAlertDto;
}

export class PaginatedAlertsDto {
  @ApiProperty({ type: [LowStockAlertItemDto] })
  items!: LowStockAlertItemDto[];

  @ApiProperty({
    example: {
      page: 1,
      limit: 10,
      totalItems: 2,
      totalPages: 1,
    },
  })
  meta!: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}
