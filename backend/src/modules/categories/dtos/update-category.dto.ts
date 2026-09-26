import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateCategoryDto {
  @ApiPropertyOptional({
    description: 'Updated category name',
    example: 'Advanced Raw Materials',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Updated parent category UUID (or null to make root category)',
    example: 'c0000000-0000-0000-0000-000000000001',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;
}
