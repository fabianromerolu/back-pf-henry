// src/application/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AnyJwtGuard } from './guards/any-jwt.guard';
import { LocalJwtStrategy } from 'src/application/auth/types/local-jwt.strategy';
import { JwtStrategy } from './types/jwt.strategy';
import { RolesGuard } from './guards/roles.guard';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [
    UsersModule,
    MailerModule, // 👈 AÑADIDO
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET || 'default_jwt_secret',
        signOptions: { expiresIn: '60m' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    LocalJwtStrategy,
    AnyJwtGuard,
    RolesGuard,
  ],
  exports: [AuthService, AnyJwtGuard, RolesGuard],
})
export class AuthModule {}
