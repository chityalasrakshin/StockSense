import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class SignupDto {
  @ApiProperty({
    example: 'operator@stocksense.dev',
    description: 'User email address',
  })
  @IsEmail({}, { message: 'Must be a valid email address' })
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    example: 'SecureP@ssw0rd123!',
    description: 'User password (minimum 8 characters)',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @IsNotEmpty()
  password!: string;

  @ApiPropertyOptional({
    enum: Role,
    default: Role.WAREHOUSE_STAFF,
    description: 'Assigned system role',
  })
  @IsOptional()
  @IsEnum(Role, { message: 'Role must be either INVENTORY_MANAGER or WAREHOUSE_STAFF' })
  role?: Role;
}
