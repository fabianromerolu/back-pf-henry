// src/application/auth/auth.service.ts
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';
import * as bcrypt from 'bcryptjs';
import { MailerService } from '../mailer/mailer.service';

type AppRole = 'ADMIN' | 'RENTER' | 'USER';

interface JwtAppPayload {
  sub: string;
  email: string;
  name: string;
  role: AppRole;
}

interface JwtPayload {
  sub: string;
  email?: string;
  name?: string;
  iss: string;
  aud: string | string[];
  [key: string]: any;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailer: MailerService, // 👈 AÑADIDO
  ) {}

  /* ===== helpers de correo para no romper el flujo si falla SMTP ===== */
  private async safeSendWelcome(email?: string | null, name?: string | null) {
    if (!email) return;
    try {
      await this.mailer.sendWelcomeEmail(email, name ?? '');
    } catch (e: any) {
      console.error('[AuthService] sendWelcomeEmail failed:', e?.message || e);
    }
  }
  private async safeSendLogin(email?: string | null, name?: string | null) {
    if (!email) return;
    try {
      await this.mailer.sendLoginEmail(email, name ?? '');
    } catch (e: any) {
      console.error('[AuthService] sendLoginEmail failed:', e?.message || e);
    }
  }

  /** ADMIN por dominio exacto (env: ADMIN_DOMAINS=midominio.com,otra.co) */
  private isAdminEmail(email?: string | null): boolean {
    const domain = email?.split('@')[1]?.toLowerCase().trim();
    const envList = (process.env.ADMIN_DOMAINS || '')
      .toLowerCase()
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!email || !domain || envList.length === 0) return false;
    return new Set(envList).has(domain);
  }

  /** Genera JWT con role */
  async generateToken(payload: JwtAppPayload): Promise<string> {
    return this.jwtService.sign(
      {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role,
      },
      { expiresIn: '60m' },
    );
  }

  /** Si validas tokens propios de Auth0 aquí, usa JWKS en producción (no JWT_SECRET local). */
  async validateAuth0Token(token: string): Promise<JwtPayload> {
    try {
      const decoded = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_SECRET,
      });
      if (!decoded.sub) throw new Error('Invalid token structure');

      const expectedIss = (process.env.AUTH0_ISSUER_BASE_URL || '').replace(/\/+$/, '');
      const gotIss = (decoded.iss || '').replace(/\/+$/, '');
      if (expectedIss && gotIss !== expectedIss) {
        throw new Error('Invalid token issuer');
      }

      const expectedAud = process.env.AUTH0_AUDIENCE;
      if (expectedAud) {
        if (Array.isArray(decoded.aud)) {
          if (!decoded.aud.includes(expectedAud)) throw new Error('Invalid token audience');
        } else {
          if (decoded.aud !== expectedAud) throw new Error('Invalid token audience');
        }
      } else {
        // sin audience, acepta client_id como audiencia
        const clientId = process.env.AUTH0_CLIENT_ID;
        if (clientId) {
          if (Array.isArray(decoded.aud)) {
            if (!decoded.aud.includes(clientId)) throw new Error('Invalid token audience');
          } else if (decoded.aud !== clientId) {
            throw new Error('Invalid token audience');
          }
        }
      }

      return decoded;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }


  private sanitizeRoleForRegistration(
    requested?: string | null,
    email?: string | null,
  ): AppRole {
    if (this.isAdminEmail(email)) return 'ADMIN';
    if (requested === 'RENTER') return 'RENTER';
    return 'USER';
  }

  /** Crea/actualiza usuario desde SSO (Auth0).
   *  ⚠️ No enviamos correos aquí para no spamear en endpoints tipo /auth/me.
   *  Para SSO, dispara correos tras el callback real de login (ver helper más abajo).
   */
  async validateUser(payload: any): Promise<{ user: any; created: boolean }> {
    const sub = payload.sub;
    const email = payload.email || null;
    const name = payload.name || (email ? email.split('@')[0] : 'user');

    let user = await this.usersService.findByAuth0Id(sub);
    let created = false;

    if (!user) {
      if (email) {
        const byEmail = await this.usersService.findByEmail(email);
        if (byEmail && !byEmail.auth0Id) {
          const patch: any = { auth0Id: sub };
          if (this.isAdminEmail(email)) patch.role = 'ADMIN';
          else if (!byEmail.role) patch.role = 'USER';
          await this.usersService.updateUser(byEmail.id, patch as any);
          user = await this.usersService.findOne(byEmail.id);
          return { user, created }; // enlazado, no “nuevo”
        }
      }
      const role: AppRole = this.isAdminEmail(email) ? 'ADMIN' : 'USER';
      user = await this.usersService.createUser({
        username: name,
        email,
        phone: null,
        password: null,
        role,
        auth0Id: sub,
      } as any);
      created = true;
    } else if (email && this.isAdminEmail(email) && user.role !== 'ADMIN') {
      await this.usersService.updateUser(user.id, { role: 'ADMIN' } as any);
      user = await this.usersService.findOne(user.id);
    }

    if (!user.role) {
      await this.usersService.updateUser(user.id, { role: 'USER' } as any);
      user = await this.usersService.findOne(user.id);
    }

    return { user, created };
  }

  /** Registro LOCAL */
  async register(dto: any /* CreateUserDto */) {
    const {
      email,
      password,
      confirmPassword,
      username,
      name,
      phone,
      role: requestedRole,
    } = dto;

    if (!password || !confirmPassword) {
      throw new BadRequestException(
        'Password and confirmPassword are required',
      );
    }
    if (password !== confirmPassword)
      throw new BadRequestException('Passwords do not match');

    const exists = await this.usersService.findByEmail(email);
    if (exists) throw new BadRequestException('Email already exists');

    const hashed = await bcrypt.hash(password, 10);
    const role = this.sanitizeRoleForRegistration(requestedRole, email);

    const user = await this.usersService.createUser({
      email,
      username,
      name,
      phone,
      password: hashed,
      role,
    } as any);

    // 👇 Enviar bienvenida (no bloquea el flujo si falla)
    this.safeSendWelcome(user.email, user.name ?? user.username ?? undefined);

    const token = await this.generateToken({
      sub: user.id,
      email: user.email,
      name: user.name ?? user.username ?? user.email,
      role: user.role as AppRole,
    });

    return {
      accessToken: token,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  /** Login LOCAL */
  async login(dto: any /* LoginUserDto */) {
    const { email, password } = dto;
    if (!password) throw new BadRequestException('Password is required');

    const user = await this.usersService.findByEmail(email, {
      withPassword: true,
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.password)
      throw new UnauthorizedException('This account uses SSO');

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    if (this.isAdminEmail(email) && user.role !== 'ADMIN') {
      await this.usersService.updateUser(user.id, { role: 'ADMIN' } as any);
    }
    const fresh = await this.usersService.findOne(user.id);

    // 👇 Email de “login”
    this.safeSendLogin(fresh.email, fresh.name ?? fresh.username ?? undefined);

    const token = await this.generateToken({
      sub: fresh.id,
      email: fresh.email,
      name: fresh.name ?? fresh.username ?? fresh.email,
      role: fresh.role as AppRole,
    });

    return {
      accessToken: token,
      user: { id: fresh.id, email: fresh.email, role: fresh.role },
    };
  }

  /* ======= Opcional: úsalo en tu callback SSO (Auth0) =======
   * Ejemplo (pseudocódigo):
   *   const user = await authService.validateUser(req.oidc.user);
   *   if (isNewUser) await authService.sendWelcomeForSso(user);
   *   else await authService.sendLoginForSso(user);
   */
  async sendWelcomeForSso(user: {
    email?: string | null;
    name?: string | null;
    username?: string | null;
  }) {
    await this.safeSendWelcome(
      user.email,
      user.name ?? user.username ?? undefined,
    );
  }
  async sendLoginForSso(user: {
    email?: string | null;
    name?: string | null;
    username?: string | null;
  }) {
    await this.safeSendLogin(
      user.email,
      user.name ?? user.username ?? undefined,
    );
  }

  /** Opcionales: refresh/revoke */
  async refreshToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const base = (process.env.AUTH0_ISSUER_BASE_URL || '').replace(/\/+$/, '');
      const res = await axios.post(`${base}/oauth/token`, {
        grant_type: 'refresh_token',
        client_id: process.env.AUTH0_CLIENT_ID,
        client_secret: process.env.AUTH0_CLIENT_SECRET,
        refresh_token: refreshToken,
      });
      return {
        accessToken: res.data.access_token,
        refreshToken: res.data.refresh_token || refreshToken,
      };
    } catch {
      throw new Error('Token refresh failed');
    }
  }

  async revokeToken(refreshToken: string): Promise<void> {
    try {
      const base = (process.env.AUTH0_ISSUER_BASE_URL || '').replace(/\/+$/, '');
      await axios.post(`${base}/oauth/revoke`, {
        client_id: process.env.AUTH0_CLIENT_ID,
        client_secret: process.env.AUTH0_CLIENT_SECRET,
        token: refreshToken,
      });
    } catch {
      throw new Error('The token could not be revoked');
    }
  }

}
