import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { BookingsStatus, VehicleStatus } from '@prisma/client';

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
export class StandardUserService {
  constructor(private readonly prisma: PrismaService) {}

  /* ========== LISTA DE MIS RESERVAS (USER) ========== */

  async listMyBookings(userId: string, opts: ListOpts) {
    if (!userId) throw new BadRequestException('userId requerido');

    const page = Math.max(1, Number(opts.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(opts.limit ?? 20)));

    const from = safeDate(opts.from);
    const to = safeDate(opts.to);

    const where: any = {
      userId,
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

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.bookings.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          pin: {
            select: {
              id: true,
              make: true,
              model: true,
              city: true,
              state: true,
              country: true,
            },
          },
        },
      }),
      this.prisma.bookings.count({ where }),
    ]);

    return {
      data: rows,
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

  /* ========== DETALLE DE UNA RESERVA MÍA ========== */

  async getMyBooking(userId: string, bookingId: string) {
    if (!userId) throw new BadRequestException('userId requerido');
    if (!bookingId) throw new BadRequestException('bookingId requerido');

    const booking = await this.prisma.bookings.findFirst({
      where: { id: bookingId, userId },
      include: {
        pin: {
          select: {
            id: true,
            make: true,
            model: true,
            city: true,
            state: true,
            country: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Reserva no encontrada o no te pertenece');
    }

    return booking;
  }

  /* ========== CANCELAR UNA RESERVA MÍA ========== */

  async cancelMyBooking(userId: string, bookingId: string) {
    if (!userId) throw new BadRequestException('userId requerido');
    if (!bookingId) throw new BadRequestException('bookingId requerido');

    const booking = await this.prisma.bookings.findUnique({
      where: { id: bookingId },
      include: { pin: true },
    });

    if (!booking) throw new NotFoundException('Reserva no encontrada');

    if (booking.userId !== userId) {
      throw new ForbiddenException('No puedes cancelar esta reserva');
    }

    await this.prisma.$transaction([
      this.prisma.bookings.update({
        where: { id: bookingId },
        data: {
          status: BookingsStatus.suspended,
          paymentStatus: 'UNPAID',
        },
      }),
      this.prisma.pin.update({
        where: { id: booking.pinId },
        data: { status: VehicleStatus.PUBLISHED },
      }),
    ]);

    return { success: true };
  }

  /* ========== OVERVIEW PARA DASHBOARD DEL USER ========== */

  async overview(userId: string) {
    if (!userId) throw new BadRequestException('userId requerido');

    const now = new Date();
    const monthAgo = new Date(now);
    monthAgo.setDate(now.getDate() - 30);

    const [total, active, complete, spentAgg, nextBooking] =
      await this.prisma.$transaction([
        this.prisma.bookings.count({ where: { userId } }),
        this.prisma.bookings.count({
          where: { userId, status: BookingsStatus.active },
        }),
        this.prisma.bookings.count({
          where: { userId, status: BookingsStatus.complete },
        }),
        this.prisma.bookings.aggregate({
          _sum: { totalPrice: true },
          where: { userId, createdAt: { gte: monthAgo } },
        }),
        this.prisma.bookings.findFirst({
          where: {
            userId,
            status: BookingsStatus.active,
            startDate: { gte: now },
          },
          orderBy: { startDate: 'asc' },
          include: {
            pin: {
              select: {
                id: true,
                make: true,
                model: true,
                city: true,
                state: true,
                country: true,
              },
            },
          },
        }),
      ]);

    return {
      bookingsTotal: total,
      bookingsActive: active,
      bookingsComplete: complete,
      spentLast30d: spentAgg._sum.totalPrice?.toString() ?? '0',
      nextBooking: nextBooking
        ? {
            id: nextBooking.id,
            startDate: nextBooking.startDate,
            endDate: nextBooking.endDate,
            pin: nextBooking.pin,
          }
        : null,
    };
  }
}
