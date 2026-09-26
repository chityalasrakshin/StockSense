import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({
    description: 'Unique category name',
    example: 'Raw Materials',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    description: 'UUID of the parent category for hierarchical tree structure',
    example: 'c0000000-0000-0000-0000-000000000001',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;
}
