import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UsersService } from 'src/application/users/users.service';
import { ROLES_KEY } from '../types/roles.decorator';
import { AppRole } from '@prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<AppRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const u = req.user || {};

    // 1) Intentamos con lo que venga en el JWT
    let role: AppRole | undefined = u.role;
    let isAdminFlag: boolean = !!u.isAdmin;

    // 2) Si no vino el role (p.ej. JWT de Auth0 sin claims), consultamos DB
    if (!role && (u.sub || u.id || u.userId)) {
      try {
        const dbUser = await this.usersService.findOne(
          u.sub ?? u.id ?? u.userId,
        );
        role = dbUser?.role;
        isAdminFlag = isAdminFlag || !!dbUser?.isAdmin;
      } catch {
        // sigue abajo y fallará por falta de permisos
      }
    }

    // 3) Evaluación: ADMIN pasa si role === ADMIN o isAdmin === true
    const isAdmin = role === AppRole.ADMIN || isAdminFlag === true;

    const allowed = requiredRoles.some((r) => {
      if (r === AppRole.ADMIN) return isAdmin;
      return role === r;
    });

    if (!allowed) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
