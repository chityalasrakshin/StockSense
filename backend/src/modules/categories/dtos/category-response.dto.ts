import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CategoryCountsDto {
  @ApiProperty({ description: 'Number of products in this category', example: 5 })
  products!: number;

  @ApiProperty({ description: 'Number of immediate child categories', example: 2 })
  children!: number;
}

export class CategoryItemDto {
  @ApiProperty({ example: 'c0000000-0000-0000-0000-000000000001' })
  id!: string;

  @ApiProperty({ example: 'Raw Materials' })
  name!: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  parentId!: string | null;

  @ApiPropertyOptional({ type: () => CategoryItemDto, nullable: true })
  parent?: CategoryItemDto | null;

  @ApiPropertyOptional({ type: () => [CategoryItemDto] })
  children?: CategoryItemDto[];

  @ApiPropertyOptional({ type: CategoryCountsDto })
  _count?: CategoryCountsDto;
}

export class CategoryTreeNodeDto {
  @ApiProperty({ example: 'c0000000-0000-0000-0000-000000000001' })
  id!: string;

  @ApiProperty({ example: 'Raw Materials' })
  name!: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  parentId!: string | null;

  @ApiProperty({ example: 3 })
  productCount!: number;

  @ApiProperty({ type: () => [CategoryTreeNodeDto] })
  children!: CategoryTreeNodeDto[];
}
