import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AppRole } from '@prisma/client'; // o vuelve a declarar el union

@Injectable()
export class LocalJwtStrategy extends PassportStrategy(Strategy, 'local-jwt') {
  constructor() {
    const extractFromCookie = (req: any) =>
      req?.cookies?.volantia_token || null;

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        extractFromCookie,
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'default_jwt_secret',
    });
  }

  async validate(payload: any) {
    const role: AppRole =
      (payload.role as AppRole | undefined) ?? 'USER';
    const isAdmin = role === 'ADMIN' || payload.isAdmin === true;

    return {
      sub: payload.sub,
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role,
      isAdmin,
    };
  }
}
