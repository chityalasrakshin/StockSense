import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length, Matches, MinLength } from 'class-validator';

export class OtpVerifyResetDto {
  @ApiProperty({
    example: 'manager@stocksense.dev',
    description: 'Email address of account resetting password',
  })
  @IsEmail({}, { message: 'Must be a valid email address' })
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    example: '482910',
    description: '6-digit single-use OTP verification code received via email',
  })
  @IsString()
  @Length(6, 6, { message: 'OTP code must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'OTP code must contain numeric characters only' })
  @IsNotEmpty()
  otp!: string;

  @ApiProperty({
    example: 'NewSecureP@ssw0rd2026!',
    description: 'New password for the account (minimum 8 characters)',
  })
  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters long' })
  @IsNotEmpty()
  newPassword!: string;
}
