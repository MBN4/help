import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UsePipes,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  AuthUser,
  ForgotPasswordRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
  forgotPasswordRequestSchema,
  loginRequestSchema,
  registerRequestSchema,
  resetPasswordRequestSchema,
  verifyEmailRequestSchema,
} from '@buisnez/shared';
import { Env } from '../../config/env.schema';
import { AppException } from '../../common/exceptions/app.exception';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthService } from './auth.service';

const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @UsePipes(new ZodValidationPipe(registerRequestSchema))
  async register(
    @Body() body: RegisterRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: AuthUser; accessToken: string }> {
    const result = await this.authService.register(body);
    this.setRefreshCookie(
      res,
      result.refreshToken,
      result.refreshTokenExpiresInSeconds,
    );
    return { user: result.user, accessToken: result.accessToken };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @UsePipes(new ZodValidationPipe(loginRequestSchema))
  async login(
    @Body() body: LoginRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: AuthUser; accessToken: string }> {
    const result = await this.authService.login(body);
    this.setRefreshCookie(
      res,
      result.refreshToken,
      result.refreshTokenExpiresInSeconds,
    );
    return { user: result.user, accessToken: result.accessToken };
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const refreshToken = this.readRefreshCookie(req);
    if (!refreshToken) {
      this.clearRefreshCookie(res);
      throw new AppException(401, 'UNAUTHORIZED', 'Missing refresh token');
    }

    const tokens = await this.authService.refresh(refreshToken);
    this.setRefreshCookie(
      res,
      tokens.refreshToken,
      tokens.refreshTokenExpiresInSeconds,
    );
    return { accessToken: tokens.accessToken };
  }

  @Public()
  @HttpCode(200)
  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ loggedOut: true }> {
    const refreshToken = this.readRefreshCookie(req);
    await this.authService.logout(refreshToken);
    this.clearRefreshCookie(res);
    return { loggedOut: true };
  }

  @Get('me')
  async me(@CurrentUser('id') userId: string): Promise<AuthUser> {
    return this.authService.me(userId);
  }

  @Public()
  @Post('verify-email')
  @UsePipes(new ZodValidationPipe(verifyEmailRequestSchema))
  async verifyEmail(
    @Body() body: VerifyEmailRequest,
  ): Promise<{ verified: true }> {
    await this.authService.verifyEmail(body.token);
    return { verified: true };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password')
  @UsePipes(new ZodValidationPipe(forgotPasswordRequestSchema))
  async forgotPassword(
    @Body() body: ForgotPasswordRequest,
  ): Promise<{ sent: true }> {
    await this.authService.forgotPassword(body.email);
    return { sent: true };
  }

  @Public()
  @Post('reset-password')
  @UsePipes(new ZodValidationPipe(resetPasswordRequestSchema))
  async resetPassword(
    @Body() body: ResetPasswordRequest,
  ): Promise<{ reset: true }> {
    await this.authService.resetPassword(body.token, body.newPassword);
    return { reset: true };
  }

  private readRefreshCookie(req: Request): string | undefined {
    const cookies = req.cookies as
      Record<string, string | undefined> | undefined;
    return cookies?.[REFRESH_COOKIE_NAME];
  }

  private setRefreshCookie(
    res: Response,
    token: string,
    maxAgeSeconds: number,
  ): void {
    res.cookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
      maxAge: maxAgeSeconds * 1000,
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
  }
}
