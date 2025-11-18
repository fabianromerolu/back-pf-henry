//src/application/admin/admin.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AppRole, BookingsStatus, UserStatus, VehicleStatus } from '@prisma/client';

type Paginated<T> = { data: T[]; meta: { page: number; limit: number; total: number; pages: number; hasNext: boolean; hasPrev: boolean } };

function safeDate(v?: string): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  /* ========= USERS ========= */

  async listUsers(filters: {
    page?: number;
    limit?: number;
    q?: string;
    role?: AppRole;
    status?: UserStatus;
    city?: string;
  }) {
    // Reusa UsersService.list
    const result = await this.users.list(filters);
    const { page, limit, total, pages } = result.meta;

    return {
      data: result.data,
      meta: {
        page,
        limit,
        total,
        pages,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }


  async setUserStatus(userId: string, status: UserStatus, blockPins = true) {
    if (!userId) throw new BadRequestException('userId requerido');
    if (!status) throw new BadRequestException('status requerido');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status },
    });

    if (blockPins && status === UserStatus.suspended) {
      await this.prisma.pin.updateMany({
        where: { ownerId: userId },
        data: { status: VehicleStatus.BLOCKED },
      });
    }

    return updated;
  }

  /* ========= BOOKINGS (ORDERS) ========= */

  async listBookings(opts: {
    status?: BookingsStatus;
    userId?: string;
    ownerId?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }): Promise<Paginated<any>> {
    const page = Math.max(1, Number(opts.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(opts.limit ?? 20)));
    const from = safeDate(opts.from);
    const to = safeDate(opts.to);

    const where: any = {
      ...(opts.status && { status: opts.status }),
      ...(opts.userId && { userId: opts.userId }),
      ...(opts.ownerId && { pin: { ownerId: opts.ownerId } }),
      ...(from || to ? { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.bookings.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, email: true, name: true } },
          pin: { select: { id: true, make: true, model: true, ownerId: true } },
        },
      }),
      this.prisma.bookings.count({ where }),
    ]);

    return {
      data: rows,
      meta: {
        page, limit, total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  /* ========= PAYMENTS ========= */

  async listWalletTransactions(opts: {
    ownerId?: string;
    type?: 'CREDIT' | 'DEBIT';
    status?: 'AVAILABLE' | 'PENDING' | 'PAID';
    page?: number;
    limit?: number;
  }): Promise<Paginated<any>> {
    const page = Math.max(1, Number(opts.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(opts.limit ?? 20)));

    const where: any = {
      ...(opts.ownerId && { ownerId: opts.ownerId }),
      ...(opts.type && { type: opts.type }),
      ...(opts.status && { status: opts.status }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.walletTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.walletTransaction.count({ where }),
    ]);

    return {
      data: rows,
      meta: {
        page, limit, total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async listPayouts(opts: {
    ownerId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<Paginated<any>> {
    const page = Math.max(1, Number(opts.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(opts.limit ?? 20)));

    const where: any = {
      ...(opts.ownerId && { ownerId: opts.ownerId }),
      ...(opts.status && { status: opts.status }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.payout.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payout.count({ where }),
    ]);

    return {
      data: rows,
      meta: {
        page, limit, total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  /* ========= METRICS ========= */

  async overview() {
    const now = new Date();
    const monthAgo = new Date(now);
    monthAgo.setDate(now.getDate() - 30);

    const [
      usersTotal,
      usersActive,
      usersSuspended,
      pinsTotal,
      pinsPublished,
      pinsBlocked,
      bookingsTotal,
      bookingsActive,
      bookingsComplete,
      // revenue total: suma ownerEarning en walletTransaction CREDIT (PENDING/AVAILABLE/PAID)
      revenueAgg,
      // revenue last 30d: por bookings pagadas últimos 30 días
      last30Agg,
      topCityAgg,
    ] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: UserStatus.active } }),
      this.prisma.user.count({ where: { status: UserStatus.suspended } }),
      this.prisma.pin.count(),
      this.prisma.pin.count({ where: { status: VehicleStatus.PUBLISHED } }),
      this.prisma.pin.count({ where: { status: VehicleStatus.BLOCKED } }),
      this.prisma.bookings.count(),
      this.prisma.bookings.count({ where: { status: BookingsStatus.active } }),
      this.prisma.bookings.count({ where: { status: BookingsStatus.complete } }),
      this.prisma.walletTransaction.aggregate({
        _sum: { amount: true },
        where: { type: 'CREDIT' },
      }),
      this.prisma.bookings.aggregate({
        _sum: { ownerEarning: true },
        where: { paymentStatus: 'PAID', createdAt: { gte: monthAgo } },
      }),
      this.prisma.pin.groupBy({
        by: ['city'],
        _count: { city: true },
        orderBy: { _count: { city: 'desc' } },
        take: 5,
      }),
    ]);

    const revenueTotal = (revenueAgg._sum.amount ?? 0).toString();
    const revenueLast30d = (last30Agg._sum.ownerEarning ?? 0).toString();

    return {
      usersTotal,
      usersActive,
      usersSuspended,
      pinsTotal,
      pinsPublished,
      pinsBlocked,
      bookingsTotal,
      bookingsActive,
      bookingsComplete,
      revenueTotal,
      revenueLast30d,
      topCities: topCityAgg.map((x) => x.city ?? 'N/A'),
    };
  }

  /**
   * Serie simple por día/mes de:
   * - bookings creadas
   * - revenue (walletTransaction CREDIT)
   * Se hace en memoria para simplicidad (rango razonable).
   */
  async series(from?: string, to?: string, granularity: 'day' | 'month' = 'day') {
    const start = safeDate(from) ?? new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const end = safeDate(to) ?? new Date();

    const [bookings, credits] = await this.prisma.$transaction([
      this.prisma.bookings.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: { createdAt: true },
      }),
      this.prisma.walletTransaction.findMany({
        where: { type: 'CREDIT', createdAt: { gte: start, lte: end } },
        select: { createdAt: true, amount: true },
      }),
    ]);

    const bucket = (d: Date) =>
      granularity === 'month'
        ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
        : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

    const map = new Map<string, { bookings: number; revenue: number }>();

    bookings.forEach((b) => {
      const key = bucket(new Date(b.createdAt));
      const v = map.get(key) ?? { bookings: 0, revenue: 0 };
      v.bookings += 1;
      map.set(key, v);
    });

    credits.forEach((c) => {
      const key = bucket(new Date(c.createdAt));
      const v = map.get(key) ?? { bookings: 0, revenue: 0 };
      v.revenue += Number(c.amount || 0);
      map.set(key, v);
    });

    // ordenar por fecha asc
    const result = Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, v]) => ({ date, bookings: v.bookings, revenue: v.revenue }));

    return result;
  }
}
