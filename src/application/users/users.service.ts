import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { AppRole, Sex, User, UserStatus } from '@prisma/client';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { UpdateUserDto } from './dtos/update-user.dto';
import * as nodemailer from 'nodemailer'; // 🆕 agregado

type ListUsersFilters = {
  page?: number;
  limit?: number;
  q?: string;
  role?: AppRole;
  status?: UserStatus;
  city?: string;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeEmail(email?: string | null): string | null {
    return email ? email.trim().toLowerCase() : null;
  }

  async list(filters: ListUsersFilters) {
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.min(100, Math.max(1, Number(filters.limit || 20)));

    const where: any = {};
    if (filters.q) {
      const q = filters.q.trim();
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { username: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (filters.role)   where.role = filters.role;
    if (filters.status) where.status = filters.status;
    if (filters.city)   where.city = filters.city;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data: items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getAllUsers(): Promise<User[]> {
    return this.prisma.user.findMany();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User #${id} not found`);
    return user;
  }

  async getUser(id: string): Promise<User> {
    return this.findOne(id);
  }

  async createUser(dto: any): Promise<User> {
    const { confirmPassword, ...rest } = dto ?? {};
    const created = await this.prisma.user.create({
      data: {
        ...rest,
        email: this.normalizeEmail(rest.email)!,
      },
    });

    // 🆕 Envío de correo de bienvenida: no debe romper la creación si falla
    try {
      await this.sendWelcomeEmail(created.email, created.name ?? created.username ?? created.email);
    } catch (e) {
      // Conservador: loggear el error pero no abortar el flujo.
      // Si quieres, reemplaza console.error por un logger central.
      // eslint-disable-next-line no-console
      console.warn('[UsersService] sendWelcomeEmail failed:', (e as any)?.message ?? e);
    }

    return created;
  }

  async updateUser(id: string, patch: Partial<UpdateUserDto>): Promise<User> {
    const { confirmPassword, ...rest } = (patch ?? {}) as any;
    if (rest.email) rest.email = this.normalizeEmail(rest.email)!;

    // birthDate: null limpia, undefined no toca
    // Prisma maneja Date directamente si decides usar Date; tu schema usa Date, ok.
    return this.prisma.user.update({
      where: { id },
      data: rest as any,
    });
  }

  async updateMe(userId: string, dto: UpdateProfileDto): Promise<User> {
    const patch: any = {
      name: dto.name,
      username: dto.username,
      city: dto.city,
      state: dto.state,
      country: dto.country,
      address: dto.address,
      sex: dto.sex as Sex,
      birthDate: dto.birthDate ?? null,
      biography: dto.biography,
      phone: dto.phone,
    };
    return this.prisma.user.update({
      where: { id: userId },
      data: patch,
    });
  }

  async removeUser(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /* ===== auth helpers ===== */
  async findByAuth0Id(auth0Id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { auth0Id } });
  }

// 🆕 Modificado: soporta opts.withPassword para devolver password sólo cuando se solicita
async findByEmail(email: string, opts: { withPassword: true }): Promise<User | null>;
async findByEmail(email: string, opts?: { withPassword?: false }): Promise<Omit<User, 'password'> | null>;
async findByEmail(email: string, opts?: { withPassword?: boolean }): Promise<any> {
  const normalized = this.normalizeEmail(email);
  if (!normalized) return null;

  if (opts?.withPassword) {
    // Devuelve registro completo (incluye password). Usar sólo internamente para login.
    return this.prisma.user.findUnique({ where: { email: normalized } });
  }

  // Por defecto devolvemos sólo campos no sensibles
  return this.prisma.user.findUnique({
    where: { email: normalized },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      role: true,
      status: true,
      profilePicture: true,
      city: true,
      state: true,
      country: true,
      pinsCount: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      auth0Id: true,
    },
  });
}

  async markLastLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  /* ===== media ===== */
  async uploadProfilePicture(id: string, url: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { profilePicture: url },
    });
  }

  // 🆕 Nueva función: envía correo de bienvenida usando nodemailer
  private async sendWelcomeEmail(email?: string | null, name?: string | null) {
    if (!email) return;
    const from = process.env.MAIL_USER;
    const pass = process.env.MAIL_PASS;
    if (!from || !pass) {
      // En entornos sin email configurado no lanzamos error (comportamiento conservador)
      // eslint-disable-next-line no-console
      console.warn('[UsersService] MAIL_USER or MAIL_PASS not configured, skipping welcome email');
      return;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail', // conservador y simple; para prod usar provider dedicado (SendGrid, SES, Mailgun)
      auth: {
        user: from,
        pass,
      },
    });

    const displayName = name ?? 'usuario';

    await transporter.sendMail({
      from: `"Volantia" <${from}>`,
      to: email,
      subject: '¡Bienvenido a Volantia!',
      html: `
        <div style="font-family: Arial, sans-serif; color: #111">
          <h2>¡Hola ${displayName}!</h2>
          <p>Gracias por unirte a <strong>Volantia</strong>. Ya podés ingresar y disfrutar de nuestros servicios.</p>
          <p>Atentamente,<br/>El equipo de Volantia</p>
        </div>
      `,
    });
  }
}
