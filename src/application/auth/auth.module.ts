// src/application/auth/auth.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AnyJwtGuard } from './guards/any-jwt.guard';
import { LocalJwtStrategy } from './types/local-jwt.strategy';
import { JwtStrategy } from './types/jwt.strategy';
import { RolesGuard } from './guards/roles.guard';
import { MailerModule } from '../mailer/mailer.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CouponsModule } from '../coupons/coupons.module';

@Module({
  imports: [
    forwardRef(() => UsersModule), // 👈 evita ciclo
    MailerModule,
    CouponsModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET || 'default_jwt_secret',
        signOptions: { expiresIn: '60m' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LocalJwtStrategy, AnyJwtGuard, RolesGuard, JwtAuthGuard],
  exports: [
    AuthService,
    AnyJwtGuard,
    RolesGuard,
    JwtAuthGuard, 
    JwtModule,  
  ],
})
export class AuthModule {}
