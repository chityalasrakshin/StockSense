import { ApiProperty } from '@nestjs/swagger';

export class FilterOptionDto {
  @ApiProperty({ example: 'Receipts' })
  label!: string;

  @ApiProperty({ example: 'RECEIPT' })
  value!: string;
}

export class WarehouseFilterOptionDto {
  @ApiProperty({ example: 'l0000000-0000-0000-0000-000000000001' })
  id!: string;

  @ApiProperty({ example: 'Main Warehouse' })
  name!: string;

  @ApiProperty({ example: 'Main Warehouse' })
  label!: string;

  @ApiProperty({ example: 'l0000000-0000-0000-0000-000000000001' })
  value!: string;

  @ApiProperty({ example: 'WH' })
  shortCode!: string;

  @ApiProperty({ example: 'WAREHOUSE' })
  type!: string;
}

export class CategoryFilterOptionDto {
  @ApiProperty({ example: 'c0000000-0000-0000-0000-000000000001' })
  id!: string;

  @ApiProperty({ example: 'Raw Materials' })
  name!: string;

  @ApiProperty({ example: 'Raw Materials' })
  label!: string;

  @ApiProperty({ example: 'c0000000-0000-0000-0000-000000000001' })
  value!: string;

  @ApiProperty({ nullable: true, example: null })
  parentId!: string | null;
}

export class FiltersMetadataDto {
  @ApiProperty({ type: [FilterOptionDto] })
  documentTypes!: FilterOptionDto[];

  @ApiProperty({ type: [FilterOptionDto] })
  statuses!: FilterOptionDto[];

  @ApiProperty({ type: [WarehouseFilterOptionDto] })
  warehouses!: WarehouseFilterOptionDto[];

  @ApiProperty({ type: [CategoryFilterOptionDto] })
  categories!: CategoryFilterOptionDto[];
}
