import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './services/auth.service';
import { OtpService } from './services/otp.service';
import { SignupDto } from './dtos/signup.dto';
import { LoginDto } from './dtos/login.dto';
import { OtpRequestDto } from './dtos/otp-request.dto';
import { OtpVerifyResetDto } from './dtos/otp-verify-reset.dto';
import { RefreshTokenDto } from './dtos/refresh-token.dto';
import { AuthResponseDto, MessageResponseDto, RefreshResponseDto } from './dtos/auth-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly otpService: OtpService,
  ) {}

  @Public()
  @Post('signup')
  @ApiOperation({
    summary: 'Register a new user account',
    description:
      'Creates a user, establishes an initial refresh token session family in an httpOnly cookie, and issues a 15-minute JWT access token.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User registered and authenticated successfully',
    type: AuthResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid input data or weak password' })
  @ApiConflictResponse({ description: 'Email address is already in use' })
  async signup(
    @Body() signupDto: SignupDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    return this.authService.signup(signupDto, response);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({
    summary: 'Authenticate with email and password',
    description:
      'Validates credentials, establishes a new refresh token session family in an httpOnly cookie, and returns a 15-minute JWT access token.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Login successful',
    type: AuthResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials or inactive account' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    return this.authService.login(loginDto, response);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  @ApiOperation({
    summary: 'Rotate refresh token and issue new access token',
    description:
      'Rotates the active refresh token within its session family. Replay/reuse of old tokens revokes the entire family.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tokens rotated successfully',
    type: RefreshResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid token, expired token, or token reuse detected (family revoked)',
  })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() body: RefreshTokenDto,
  ): Promise<RefreshResponseDto> {
    const rawRefreshToken = request.cookies?.refreshToken || body.refreshToken;
    return this.authService.refreshTokens(rawRefreshToken, response);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  @ApiOperation({
    summary: 'Log out current session',
    description: 'Revokes the current refresh token session family and clears the httpOnly cookie.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Logged out successfully',
    type: MessageResponseDto,
  })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() body: RefreshTokenDto,
  ): Promise<MessageResponseDto> {
    const rawRefreshToken = request.cookies?.refreshToken || body.refreshToken;
    return this.authService.logout(rawRefreshToken, response);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  @HttpCode(HttpStatus.OK)
  @Post('otp/request')
  @ApiOperation({
    summary: 'Request a 6-digit password reset OTP',
    description:
      'Hard rate-limited endpoint. Generates a 6-digit OTP (10 min TTL), hashes it at rest in otp_codes, and sends it via email provider.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password reset OTP generated and dispatched if account exists',
    type: MessageResponseDto,
  })
  @ApiTooManyRequestsResponse({
    description: 'Exceeded maximum allowable OTP requests within rate limit window',
  })
  async requestOtp(@Body() dto: OtpRequestDto): Promise<MessageResponseDto> {
    return this.otpService.requestPasswordResetOtp(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  @HttpCode(HttpStatus.OK)
  @Post('otp/verify-reset')
  @ApiOperation({
    summary: 'Verify OTP and reset account password',
    description:
      'Verifies the 6-digit OTP against the hashed value at rest, consumes the OTP (single-use), updates password, and revokes prior sessions.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password reset successfully',
    type: MessageResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid, already consumed, or expired OTP code' })
  async verifyReset(@Body() dto: OtpVerifyResetDto): Promise<MessageResponseDto> {
    return this.authService.verifyResetPassword(dto);
  }
}
