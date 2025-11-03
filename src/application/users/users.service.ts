import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { AppRole, Sex, User, UserStatus } from '@prisma/client';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { UpdateUserDto } from './dtos/update-user.dto';

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
    if (filters.role) where.role = filters.role;
    if (filters.status) where.status = filters.status;
    if (filters.city) where.city = filters.city;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: items,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    };
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

  async findByEmail(
    email: string,
    opts?: { withPassword?: boolean },
  ): Promise<User | null> {
    const normalized = this.normalizeEmail(email)!;
    // Prisma no oculta fields por select:false como TypeORM; decide aquí si seleccionas todo.
    return this.prisma.user.findUnique({ where: { email: normalized } });
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
}
