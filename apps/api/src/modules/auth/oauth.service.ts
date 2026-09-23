import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthUser } from '@buisnez/shared';
import { Env } from '../../config/env.schema';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from './token.service';
import { TokenPair } from './token.types';
import { serializeUser } from './auth.service';

export type OAuthProvider = 'google' | 'facebook';

interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

interface FacebookUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: { data?: { url?: string } };
}

export interface OAuthResult extends TokenPair {
  user: AuthUser;
}

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  isConfigured(provider: OAuthProvider): boolean {
    return provider === 'google'
      ? Boolean(this.config.get('GOOGLE_OAUTH_CLIENT_ID', { infer: true }))
      : Boolean(this.config.get('FACEBOOK_OAUTH_CLIENT_ID', { infer: true }));
  }

  private callbackUrl(provider: OAuthProvider): string {
    return `${this.config.get('OAUTH_CALLBACK_BASE_URL', { infer: true })}/auth/${provider}/callback`;
  }

  buildAuthorizationUrl(provider: OAuthProvider): string {
    if (provider === 'google') {
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.searchParams.set(
        'client_id',
        this.config.get('GOOGLE_OAUTH_CLIENT_ID', { infer: true }),
      );
      url.searchParams.set('redirect_uri', this.callbackUrl('google'));
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', 'openid email profile');
      return url.toString();
    }
    const url = new URL('https://www.facebook.com/v19.0/dialog/oauth');
    url.searchParams.set(
      'client_id',
      this.config.get('FACEBOOK_OAUTH_CLIENT_ID', { infer: true }),
    );
    url.searchParams.set('redirect_uri', this.callbackUrl('facebook'));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'email public_profile');
    return url.toString();
  }

  async handleCallback(
    provider: OAuthProvider,
    code: string,
  ): Promise<OAuthResult> {
    const profile =
      provider === 'google'
        ? await this.fetchGoogleProfile(code)
        : await this.fetchFacebookProfile(code);
    return this.upsertOAuthUser(
      provider,
      profile.id,
      profile.email,
      profile.name,
      profile.avatarUrl,
    );
  }

  /** Only reachable when the real provider isn't configured — see docs/10-auth-roles.md. */
  async handleStubCallback(
    provider: OAuthProvider,
    email: string,
    name: string,
  ): Promise<OAuthResult> {
    if (this.isConfigured(provider)) {
      throw new AppException(
        403,
        'STUB_DISABLED',
        `${provider} OAuth is configured with real credentials — the stub handshake is disabled`,
      );
    }
    return this.upsertOAuthUser(provider, `stub-${email}`, email, name, null);
  }

  private async fetchGoogleProfile(code: string): Promise<{
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  }> {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.get('GOOGLE_OAUTH_CLIENT_ID', { infer: true }),
        client_secret: this.config.get('GOOGLE_OAUTH_CLIENT_SECRET', {
          infer: true,
        }),
        redirect_uri: this.callbackUrl('google'),
        grant_type: 'authorization_code',
        code,
      }),
    });
    if (!tokenResponse.ok) {
      throw new AppException(401, 'OAUTH_FAILED', 'Google sign-in failed');
    }
    const { access_token: accessToken } = (await tokenResponse.json()) as {
      access_token: string;
    };

    const profileResponse = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: { authorization: `Bearer ${accessToken}` },
      },
    );
    if (!profileResponse.ok) {
      throw new AppException(401, 'OAUTH_FAILED', 'Google sign-in failed');
    }
    const profile = (await profileResponse.json()) as GoogleUserInfo;
    return {
      id: profile.sub,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.picture ?? null,
    };
  }

  private async fetchFacebookProfile(code: string): Promise<{
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  }> {
    const tokenUrl = new URL(
      'https://graph.facebook.com/v19.0/oauth/access_token',
    );
    tokenUrl.searchParams.set(
      'client_id',
      this.config.get('FACEBOOK_OAUTH_CLIENT_ID', { infer: true }),
    );
    tokenUrl.searchParams.set(
      'client_secret',
      this.config.get('FACEBOOK_OAUTH_CLIENT_SECRET', { infer: true }),
    );
    tokenUrl.searchParams.set('redirect_uri', this.callbackUrl('facebook'));
    tokenUrl.searchParams.set('code', code);
    const tokenResponse = await fetch(tokenUrl);
    if (!tokenResponse.ok) {
      throw new AppException(401, 'OAUTH_FAILED', 'Facebook sign-in failed');
    }
    const { access_token: accessToken } = (await tokenResponse.json()) as {
      access_token: string;
    };

    const profileUrl = new URL('https://graph.facebook.com/me');
    profileUrl.searchParams.set('fields', 'id,name,email,picture');
    profileUrl.searchParams.set('access_token', accessToken);
    const profileResponse = await fetch(profileUrl);
    if (!profileResponse.ok) {
      throw new AppException(401, 'OAUTH_FAILED', 'Facebook sign-in failed');
    }
    const profile = (await profileResponse.json()) as FacebookUserInfo;
    return {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.picture?.data?.url ?? null,
    };
  }

  private async upsertOAuthUser(
    provider: OAuthProvider,
    providerAccountId: string,
    email: string,
    name: string,
    avatarUrl: string | null,
  ): Promise<OAuthResult> {
    const account = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } },
      include: { user: true },
    });

    const user =
      account?.user ??
      (await this.prisma.user.findUnique({ where: { email } })) ??
      (await this.prisma.user.create({
        data: {
          email,
          name,
          avatarUrl,
          // Google/Facebook have already verified this address.
          emailVerifiedAt: new Date(),
        },
      }));

    if (!account) {
      await this.prisma.oAuthAccount.create({
        data: { provider, providerAccountId, userId: user.id },
      });
      this.logger.log(`Linked ${provider} account to user ${user.id}`);
    }

    const tokens = await this.tokenService.issueTokenPair(user.id, user.role);
    return { user: serializeUser(user), ...tokens };
  }
}
