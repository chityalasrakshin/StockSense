import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UserProfileDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-1234-56789abcdef0' })
  id!: string;

  @ApiProperty({ example: 'manager@stocksense.dev' })
  email!: string;

  @ApiProperty({ enum: Role, example: Role.INVENTORY_MANAGER })
  role!: Role;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-09-26T12:00:00.000Z' })
  createdAt!: Date;
}

export class AuthResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Short-lived JWT access token (~15min TTL)',
  })
  accessToken!: string;

  @ApiProperty({
    type: UserProfileDto,
    description: 'Authenticated user profile details',
  })
  user!: UserProfileDto;
}

export class RefreshResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Newly rotated JWT access token (~15min TTL)',
  })
  accessToken!: string;
}

export class MessageResponseDto {
  @ApiProperty({ example: 'Operation completed successfully' })
  message!: string;
}
