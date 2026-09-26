import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class QueryProductsDto {
  @ApiPropertyOptional({
    description: 'Filter by category UUID',
    example: 'c0000000-0000-0000-0000-000000000001',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Filter for items currently at or below their reorder threshold',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  lowStock?: boolean;

  @ApiPropertyOptional({
    description: 'General keyword search matching name or SKU',
    example: 'steel',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Page index (1-based)',
    default: 1,
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    default: 20,
    example: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;
}

export class SearchProductsDto {
  @ApiPropertyOptional({
    description: 'Search query for pg_trgm fuzzy match against SKU and product name',
    example: 'steel rod',
  })
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of search results to return',
    default: 20,
    example: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Pagination offset',
    default: 0,
    example: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;
}
