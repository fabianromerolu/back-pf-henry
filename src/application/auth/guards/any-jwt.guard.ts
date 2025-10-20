import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class AnyJwtGuard extends AuthGuard('local-jwt') {
  async canActivate(ctx: ExecutionContext) {
    try {
      const okLocal = (await super.canActivate(ctx)) as boolean;
      if (okLocal) return true;
    } catch (_) {
      // si falla la local, seguimos al fallback
    }

    const JwtGuard = AuthGuard('jwt');
    const g = new (JwtGuard as any)();
    return (await g.canActivate(ctx)) as boolean;
  }
  handleRequest(err: any, user: any) {
    if (err) throw err;
    if (user) {
      user.sub = user.sub ?? user.id ?? user.userId;
    }
    return user;
  }
}
