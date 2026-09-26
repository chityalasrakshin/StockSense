import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class UpdateProductDto {
  @ApiPropertyOptional({
    description: 'Updated SKU code',
    example: 'STEEL-ROD-002',
  })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional({
    description: 'Updated product name',
    example: 'High-Tensile Steel Rods (12mm)',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Updated unit cost valuation',
    example: 48.5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @ApiPropertyOptional({
    description: 'Updated category UUID (or null to clear)',
    example: 'c0000000-0000-0000-0000-000000000001',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional({
    description: 'Updated UoM UUID (or null to clear)',
    example: 'u0000000-0000-0000-0000-000000000001',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  uomId?: string | null;

  @ApiPropertyOptional({
    description: 'Updated reorder safety point',
    example: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  reorderPoint?: number;

  @ApiPropertyOptional({
    description: 'Updated replenishment reorder quantity',
    example: 120,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  reorderQty?: number;
}
