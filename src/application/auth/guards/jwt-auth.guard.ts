// src/application/auth/guards/jwt-auth.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    const token = this.extractToken(req);
    if (!token) {
      throw new UnauthorizedException('Token de autenticación requerido');
    }

    try {
      const payload = await this.jwtService.verifyAsync<any>(token, {
        secret: process.env.JWT_SECRET,
      });

      // 👇 Normaliza como el resto del código espera (sub)
      req.user = {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role,
      };

      return true;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }

  private extractToken(req: any): string | undefined {
    // 1) Authorization: Bearer xxx
    const [type, token] = req.headers.authorization?.split(' ') ?? [];
    if (type === 'Bearer' && token) return token;

    // 2) Cookie (volantia_token)
    const cookieToken = req.cookies?.volantia_token;
    if (cookieToken) return cookieToken;

    return undefined;
  }
}
