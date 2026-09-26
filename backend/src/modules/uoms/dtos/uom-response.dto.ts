import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UomCountsDto {
  @ApiProperty({ description: 'Number of products utilizing this UoM', example: 12 })
  products!: number;
}

export class UomItemDto {
  @ApiProperty({ example: 'u0000000-0000-0000-0000-000000000001' })
  id!: string;

  @ApiProperty({ example: 'kg' })
  code!: string;

  @ApiProperty({ example: 'Kilograms' })
  name!: string;

  @ApiPropertyOptional({ type: UomCountsDto })
  _count?: UomCountsDto;
}
