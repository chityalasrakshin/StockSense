import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUomDto {
  @ApiPropertyOptional({
    description: 'Updated unit of measure code',
    example: 'kg',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  @ApiPropertyOptional({
    description: 'Updated descriptive name',
    example: 'Kilograms (metric)',
  })
  @IsOptional()
  @IsString()
  name?: string;
}
