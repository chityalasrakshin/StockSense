import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({
    description: 'Unique Stock Keeping Unit identifier (e.g., STEEL-ROD-001, DESK-001)',
    example: 'STEEL-ROD-001',
  })
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @ApiProperty({
    description: 'Descriptive commercial name of the product',
    example: 'Steel Rods',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    description: 'Unit cost valuation in dollars (decimal 12,2)',
    example: 45.0,
    default: 0.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @ApiPropertyOptional({
    description: 'UUID of the product category',
    example: 'c0000000-0000-0000-0000-000000000001',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'UUID of the product default Unit of Measure (UoM)',
    example: 'u0000000-0000-0000-0000-000000000001',
  })
  @IsOptional()
  @IsUUID()
  uomId?: string;

  @ApiPropertyOptional({
    description: 'Minimum stock safety threshold triggering reorder alert',
    example: 25,
    default: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  reorderPoint?: number;

  @ApiPropertyOptional({
    description: 'Suggested replenishment order quantity when stock breaches reorder threshold',
    example: 100,
    default: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  reorderQty?: number;

  @ApiPropertyOptional({
    description:
      'Optional initial stock quantity upon product onboarding (automatically writes initial stock_ledger entry and stock_balances row)',
    example: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  initialStock?: number;

  @ApiPropertyOptional({
    description:
      'Target warehouse location UUID for initial stock. If omitted and initialStock > 0, defaults to first root warehouse.',
    example: 'l0000000-0000-0000-0000-000000000001',
  })
  @IsOptional()
  @IsUUID()
  initialLocationId?: string;
}
