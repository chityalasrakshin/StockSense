import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LocationType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateLocationDto {
  @ApiProperty({
    description: 'Human-readable name of the warehouse, zone, rack, or bin',
    example: 'Main Warehouse',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'Unique short code for the location (used in document reference generation, e.g., WH, WH-REC, WH-PR)',
    example: 'WH',
  })
  @IsString()
  @IsNotEmpty()
  shortCode!: string;

  @ApiPropertyOptional({
    description: 'Location hierarchy type (WAREHOUSE, ZONE, RACK, BIN)',
    enum: LocationType,
    default: LocationType.WAREHOUSE,
    example: LocationType.WAREHOUSE,
  })
  @IsOptional()
  @IsEnum(LocationType)
  type?: LocationType;

  @ApiPropertyOptional({
    description: 'UUID of parent location in the warehouse tree (null for root warehouses)',
    example: 'l0000000-0000-0000-0000-000000000001',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;
}
