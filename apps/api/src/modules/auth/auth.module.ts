import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MailModule } from '../../integrations/mail/mail.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';

@Module({
  imports: [JwtModule.register({ global: true }), MailModule],
  controllers: [AuthController, OAuthController],
  providers: [AuthService, TokenService, OAuthService],
  exports: [TokenService],
})
export class AuthModule {}
