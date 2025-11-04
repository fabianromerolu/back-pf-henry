import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { BookingsStatus } from '@prisma/client';

type ListOpts = {
  status?: BookingsStatus;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};

function safeDate(v?: string): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
}

@Injectable()
export class RenterService {
  constructor(private readonly prisma: PrismaService) {}

  async listOwnerBookings(ownerId: string, opts: ListOpts) {
    if (!ownerId) throw new BadRequestException('ownerId requerido');

    const page = Math.max(1, Number(opts.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(opts.limit ?? 20)));

    const from = safeDate(opts.from);
    const to = safeDate(opts.to);

    const where: any = {
      pin: { ownerId }, // relación Booking -> Pin(ownerId)
      ...(opts.status && { status: opts.status }),
      ...(from || to
        ? {
            startDate: {
              ...(from && { gte: from }),
              ...(to && { lte: to }),
            },
          }
        : {}),
    };

  const [items, total] = await this.prisma.$transaction([
    this.prisma.bookings.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        pin:  { select: { id: true, make: true, model: true } }, // 👈 sin 'title'
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    this.prisma.bookings.count({ where }),
  ]);

    return {
      data: items,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async overview(ownerId: string) {
    if (!ownerId) throw new BadRequestException('ownerId requerido');

    const now = new Date();
    const monthAgo = new Date(now);
    monthAgo.setDate(now.getDate() - 30);

    const [pinsTotal, pinsPublished, pinsBlocked, last30, pending] =
      await this.prisma.$transaction([
        this.prisma.pin.count({ where: { ownerId } }),
        this.prisma.pin.count({ where: { ownerId, status: 'PUBLISHED' } }),
        this.prisma.pin.count({ where: { ownerId, status: 'BLOCKED' } }),
        this.prisma.bookings.aggregate({
          _sum: { ownerEarning: true },
          where: {
            pin: { ownerId },
            paymentStatus: 'PAID',
            createdAt: { gte: monthAgo },
          },
        }),
        this.prisma.bookings.aggregate({
          _sum: { ownerEarning: true },
          where: {
            pin: { ownerId },
            paymentStatus: { in: ['PENDING', 'UNPAID'] },
          },
        }),
      ]);

    return {
      pins: {
        total: pinsTotal,
        published: pinsPublished,
        blocked: pinsBlocked,
      },
      revenueLast30d: last30._sum.ownerEarning?.toString() ?? '0',
      revenuePending: pending._sum.ownerEarning?.toString() ?? '0',
    };
  }

  async balance(ownerId: string) {
    if (!ownerId) throw new BadRequestException('ownerId requerido');

    const [available, pending] = await Promise.all([
      this.prisma.walletTransaction.aggregate({
        _sum: { amount: true },
        where: { ownerId, type: 'CREDIT', status: 'AVAILABLE' },
      }),
      this.prisma.walletTransaction.aggregate({
        _sum: { amount: true },
        where: { ownerId, type: 'CREDIT', status: 'PENDING' },
      }),
    ]);

    const debits = await this.prisma.walletTransaction.aggregate({
      _sum: { amount: true },
      where: { ownerId, type: 'DEBIT' },
    });

    const avail =
      Number(available._sum.amount || 0) -
      Math.abs(Number(debits._sum.amount || 0));
    const pend = Number(pending._sum.amount || 0);

    return {
      available: Math.max(avail, 0).toFixed(2),
      pending: Math.max(pend, 0).toFixed(2),
      currency: 'COP',
    };
  }

  async listPayments(ownerId: string, page = 1, limit = 20) {
    if (!ownerId) throw new BadRequestException('ownerId requerido');

    const p = Math.max(1, Number(page));
    const l = Math.min(100, Math.max(1, Number(limit)));

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.walletTransaction.findMany({
        where: { ownerId },
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * l,
        take: l,
      }),
      this.prisma.walletTransaction.count({ where: { ownerId } }),
    ]);

    return {
      data: rows,
      meta: {
        page: p,
        limit: l,
        total,
        pages: Math.ceil(total / l),
        hasNext: p * l < total,
        hasPrev: p > 1,
      },
    };
  }

  async createPayout(ownerId: string, amount: number) {
    if (!ownerId) throw new BadRequestException('ownerId requerido');
    const amt = Number(amount);
    if (!isFinite(amt) || amt <= 0) {
      throw new BadRequestException('Monto inválido');
    }

    const bal = await this.balance(ownerId);
    if (amt > Number(bal.available)) {
      throw new BadRequestException('Saldo insuficiente');
    }

    return this.prisma.$transaction(async (tx) => {
      const payout = await tx.payout.create({
        data: { ownerId, amount: amt, currency: 'COP', status: 'REQUESTED' },
      });
      await tx.walletTransaction.create({
        data: {
          ownerId,
          bookingId: null,
          type: 'DEBIT',
          amount: amt * -1,
          currency: 'COP',
          status: 'PAID',
        },
      });
      return payout;
    });
  }

  async listPayouts(ownerId: string, page = 1, limit = 20) {
    if (!ownerId) throw new BadRequestException('ownerId requerido');

    const p = Math.max(1, Number(page));
    const l = Math.min(100, Math.max(1, Number(limit)));

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.payout.findMany({
        where: { ownerId },
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * l,
        take: l,
      }),
      this.prisma.payout.count({ where: { ownerId } }),
    ]);

    return {
      data: rows,
      meta: {
        page: p,
        limit: l,
        total,
        pages: Math.ceil(total / l),
        hasNext: p * l < total,
        hasPrev: p > 1,
      },
    };
  }
}
