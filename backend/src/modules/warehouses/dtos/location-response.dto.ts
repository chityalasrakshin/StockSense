import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LocationType } from '@prisma/client';

export class LocationCountsDto {
  @ApiProperty({ description: 'Number of child zones/racks/bins', example: 2 })
  children!: number;

  @ApiProperty({ description: 'Number of distinct products stored at this location', example: 8 })
  balances!: number;
}

export class LocationItemDto {
  @ApiProperty({ example: 'l0000000-0000-0000-0000-000000000001' })
  id!: string;

  @ApiProperty({ example: 'Main Warehouse' })
  name!: string;

  @ApiProperty({ example: 'WH' })
  shortCode!: string;

  @ApiProperty({ enum: LocationType, example: LocationType.WAREHOUSE })
  type!: LocationType;

  @ApiPropertyOptional({ example: null, nullable: true })
  parentId!: string | null;

  @ApiPropertyOptional({ type: () => LocationItemDto, nullable: true })
  parent?: LocationItemDto | null;

  @ApiPropertyOptional({ type: () => [LocationItemDto] })
  children?: LocationItemDto[];

  @ApiPropertyOptional({ type: LocationCountsDto })
  _count?: LocationCountsDto;
}

export class LocationTreeNodeDto {
  @ApiProperty({ example: 'l0000000-0000-0000-0000-000000000001' })
  id!: string;

  @ApiProperty({ example: 'Main Warehouse' })
  name!: string;

  @ApiProperty({ example: 'WH' })
  shortCode!: string;

  @ApiProperty({ enum: LocationType, example: LocationType.WAREHOUSE })
  type!: LocationType;

  @ApiPropertyOptional({ example: null, nullable: true })
  parentId!: string | null;

  @ApiProperty({ type: () => [LocationTreeNodeDto] })
  children!: LocationTreeNodeDto[];
}
