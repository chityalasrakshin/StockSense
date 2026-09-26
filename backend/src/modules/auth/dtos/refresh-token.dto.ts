import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description:
      'Optional refresh token string if client cannot supply httpOnly cookie (e.g. mobile/script clients)',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
