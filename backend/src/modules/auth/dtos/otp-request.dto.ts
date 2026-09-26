import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class OtpRequestDto {
  @ApiProperty({
    example: 'manager@stocksense.dev',
    description: 'Email address of account requiring password reset verification OTP',
  })
  @IsEmail({}, { message: 'Must be a valid email address' })
  @IsNotEmpty()
  email!: string;
}
