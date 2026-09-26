import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateUomDto {
  @ApiProperty({
    description: 'Unique standard code for the unit of measure (e.g., kg, pcs, box, m)',
    example: 'kg',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code!: string;

  @ApiProperty({
    description: 'Human-readable descriptive name of the unit of measure',
    example: 'Kilograms',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;
}
