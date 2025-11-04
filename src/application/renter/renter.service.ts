import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { BookingsStatus } from '@prisma/client';

@Injectable()
export class RenterService {
  constructor(private readonly prisma: PrismaService) {}

  async listOwnerBookings(
    ownerId: string,
    opts: {
      status?: BookingsStatus;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = Math.max(1, Number(opts.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(opts.limit ?? 20)));
    const where: any = { pin: { ownerId } };
    if (opts.status) where.status = opts.status;
    if (opts.from || opts.to) {
      where.startDate = {
        ...(opts.from && { gte: new Date(opts.from) }),
        ...(opts.to && { lte: new Date(opts.to) }),
      };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.bookings.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          pin: { select: { id: true, make: true, model: true } },
          user: { select: { id: true, name: true, email: true } }, // cliente
        },
      }),
      this.prisma.bookings.count({ where }),
    ]);

    return {
      data: items,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async overview(ownerId: string) {
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

    // resta débitos (retiros)
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
      meta: { page: p, limit: l, total, pages: Math.ceil(total / l) },
    };
  }

  async createPayout(ownerId: string, amount: number) {
    // valida saldo available
    const bal = await this.balance(ownerId);
    if (amount <= 0 || amount > Number(bal.available)) {
      throw new Error('Monto inválido o saldo insuficiente');
    }
    return this.prisma.$transaction(async (tx) => {
      const payout = await tx.payout.create({
        data: { ownerId, amount, currency: 'COP', status: 'REQUESTED' },
      });
      await tx.walletTransaction.create({
        data: {
          ownerId,
          bookingId: null,
          type: 'DEBIT',
          amount: amount * -1,
          currency: 'COP',
          status: 'PAID',
        },
      });
      return payout;
    });
  }

  async listPayouts(ownerId: string, page = 1, limit = 20) {
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
      meta: { page: p, limit: l, total, pages: Math.ceil(total / l) },
    };
  }
}
