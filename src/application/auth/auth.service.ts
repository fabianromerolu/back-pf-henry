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
import { CouponsService } from '../coupons/coupons.service';

type AppRole = 'ADMIN' | 'RENTER' | 'USER';

interface JwtAppPayload {
  sub: string;
  email: string | null;
  name: string | null;
  role: AppRole;
}

interface LocalJwtPayload {
  sub: string;
  email?: string | null;
  name?: string | null;
  role?: AppRole;
  iat?: number;
  exp?: number;
}

interface OidcJwtPayload {
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
    private readonly mailer: MailerService,
    private readonly couponsService: CouponsService, // 👈 nuevo

  ) {}

  /* ================== Helpers correo ================== */
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

  /* ================== Roles ================== */
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

  private sanitizeRoleForRegistration(
    requested?: string | null,
    email?: string | null,
  ): AppRole {
    if (this.isAdminEmail(email)) return 'ADMIN';
    if (requested === 'RENTER') return 'RENTER';
    return 'USER';
  }

  /* ================== JWT local ================== */
  async generateToken(payload: JwtAppPayload): Promise<string> {
    return this.jwtService.sign(
      {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role,
      },
      {
        expiresIn: '60m',
        secret: process.env.JWT_SECRET,
      },
    );
  }

  async validateLocalJwt(token: string): Promise<LocalJwtPayload> {
    try {
      const decoded = await this.jwtService.verifyAsync<LocalJwtPayload>(
        token,
        { secret: process.env.JWT_SECRET },
      );
      if (!decoded?.sub) throw new Error('Invalid token structure');
      return decoded;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  /* ================== OIDC (Auth0) opcional ================== */
  async validateAuth0Token(token: string): Promise<OidcJwtPayload> {
    try {
      const decoded = await this.jwtService.verifyAsync<OidcJwtPayload>(token, {
        secret: process.env.JWT_SECRET,
      });
      if (!decoded.sub) throw new Error('Invalid token structure');

      const expectedIss = (process.env.AUTH0_ISSUER_BASE_URL || '').replace(
        /\/+$/,
        '',
      );
      const gotIss = (decoded.iss || '').replace(/\/+$/, '');
      if (expectedIss && gotIss !== expectedIss) {
        throw new Error('Invalid token issuer');
      }

      const expectedAud = process.env.AUTH0_AUDIENCE;
      if (expectedAud) {
        if (Array.isArray(decoded.aud)) {
          if (!decoded.aud.includes(expectedAud))
            throw new Error('Invalid token audience');
        } else if (decoded.aud !== expectedAud) {
          throw new Error('Invalid token audience');
        }
      } else {
        const clientId = process.env.AUTH0_CLIENT_ID;
        if (clientId) {
          if (Array.isArray(decoded.aud)) {
            if (!decoded.aud.includes(clientId))
              throw new Error('Invalid token audience');
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

  /* ================== Flujo SSO (Auth0) ================== */
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
          user = await this.usersService.findOneOrThrow(byEmail.id);
          return { user, created }; // enlazado
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
      user = await this.usersService.findOneOrThrow(user.id);
    }

    // 👇 Garantiza a TS que user no es null antes de tocar role
    if (!user) throw new UnauthorizedException('User not found');

    if (!user.role) {
      await this.usersService.updateUser(user.id, { role: 'USER' } as any);
      user = await this.usersService.findOneOrThrow(user.id);
    }

     // 🚀 NUEVO: si el usuario fue creado, generar cupón de bienvenida
    if (created) {
      await this.couponsService.createWelcomeCoupon(user.id);
    }


    return { user, created };
  }

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

  /* ================== Auth local ================== */
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
      
     // 🦖 NUEVO: generar cupón de bienvenida al registrarse y enviarlo por correo
    const coupon = await this.couponsService.createWelcomeCoupon(user.id);
    await this.mailer.sendCouponEmail(user.email, coupon.code, coupon.discountPct);


        // 🚀 NUEVO: generar cupón de bienvenida al registrarse
    await this.couponsService.createWelcomeCoupon(user.id);


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

    // 👇 A partir de aquí queremos un User no-null
    const fresh = await this.usersService.findOneOrThrow(user.id);

    this.safeSendLogin(
      fresh.email,
      fresh.name ?? fresh.username ?? undefined,
    );

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

  /* ================== Refresh/Revoke (Auth0) ================== */
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
