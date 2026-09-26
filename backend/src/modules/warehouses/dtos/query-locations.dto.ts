import { ApiPropertyOptional } from '@nestjs/swagger';
import { LocationType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class QueryLocationsDto {
  @ApiPropertyOptional({
    description: 'Filter by location type (WAREHOUSE, ZONE, RACK, BIN)',
    enum: LocationType,
  })
  @IsOptional()
  @IsEnum(LocationType)
  type?: LocationType;

  @ApiPropertyOptional({
    description: 'Filter by parent location UUID',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({
    description: 'Filter locations by name or shortCode keyword',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
