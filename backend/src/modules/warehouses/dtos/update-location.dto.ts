import { ApiPropertyOptional } from '@nestjs/swagger';
import { LocationType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateLocationDto {
  @ApiPropertyOptional({
    description: 'Updated location name',
    example: 'Main Central Warehouse',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Updated location short code',
    example: 'MCW',
  })
  @IsOptional()
  @IsString()
  shortCode?: string;

  @ApiPropertyOptional({
    description: 'Updated location type',
    enum: LocationType,
    example: LocationType.WAREHOUSE,
  })
  @IsOptional()
  @IsEnum(LocationType)
  type?: LocationType;

  @ApiPropertyOptional({
    description: 'Updated parent location UUID in the warehouse tree (null to make root warehouse)',
    example: 'l0000000-0000-0000-0000-000000000001',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;
}
