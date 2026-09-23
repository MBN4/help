import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import type { Response } from 'express';
import { Env } from '../../config/env.schema';
import { AppException } from '../../common/exceptions/app.exception';
import { Public } from '../../common/decorators/public.decorator';
import { setAuthCookies } from '../../common/constants/auth-cookies';
import { OAuthService, type OAuthProvider } from './oauth.service';

const callbackQuerySchema = z.object({ code: z.string().min(1) });
const stubCallbackQuerySchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

function parseProvider(value: string): OAuthProvider {
  if (value !== 'google' && value !== 'facebook') {
    throw new AppException(400, 'VALIDATION_ERROR', 'Unknown OAuth provider');
  }
  return value;
}

@Controller('auth')
export class OAuthController {
  constructor(
    private readonly oauthService: OAuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Get('google')
  startGoogle(@Res() res: Response): void {
    this.start('google', res);
  }

  @Public()
  @Get('facebook')
  startFacebook(@Res() res: Response): void {
    this.start('facebook', res);
  }

  @Public()
  @Get('google/callback')
  async googleCallback(
    @Query() query: unknown,
    @Res() res: Response,
  ): Promise<void> {
    const { code } = callbackQuerySchema.parse(query);
    const result = await this.oauthService.handleCallback('google', code);
    this.finish(res, result);
  }

  @Public()
  @Get('facebook/callback')
  async facebookCallback(
    @Query() query: unknown,
    @Res() res: Response,
  ): Promise<void> {
    const { code } = callbackQuerySchema.parse(query);
    const result = await this.oauthService.handleCallback('facebook', code);
    this.finish(res, result);
  }

  /** Only reachable when the real provider isn't configured — the web app's stub consent page hits this. */
  @Public()
  @Get('oauth-stub/:provider/callback')
  async stubCallback(
    @Param('provider') providerParam: string,
    @Query() query: unknown,
    @Res() res: Response,
  ): Promise<void> {
    const provider = parseProvider(providerParam);
    const { email, name } = stubCallbackQuerySchema.parse(query);
    const result = await this.oauthService.handleStubCallback(
      provider,
      email,
      name,
    );
    this.finish(res, result);
  }

  private start(provider: OAuthProvider, res: Response): void {
    const webOrigin = this.config.get('WEB_ORIGIN', { infer: true });
    if (!this.oauthService.isConfigured(provider)) {
      res.redirect(`${webOrigin}/auth/oauth-stub?provider=${provider}`);
      return;
    }
    res.redirect(this.oauthService.buildAuthorizationUrl(provider));
  }

  private finish(
    res: Response,
    result: {
      accessToken: string;
      refreshToken: string;
      refreshTokenExpiresInSeconds: number;
    },
  ): void {
    const secure =
      this.config.get('NODE_ENV', { infer: true }) === 'production';
    setAuthCookies(
      res,
      secure,
      result.accessToken,
      result.refreshToken,
      result.refreshTokenExpiresInSeconds,
    );
    res.redirect(this.config.get('WEB_ORIGIN', { infer: true }));
  }
}
