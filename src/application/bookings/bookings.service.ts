import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateBookingDto } from './dto/create-booking.dto';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import {
  priceCalculator,
  validateDates,
} from 'src/utils/ordersFunctions/ordersFunction';
//import { price } from 'src/utils/ordersFunctions/ordersInterface';
import { Bookings, BookingsStatus, VehicleStatus } from '@prisma/client';
import { bookingDto, BookingsResponseDto } from './dto/booking.dto';
import { UserPayloadInterface } from './interfaces/bookingsInterface';
import { BookingsQueryDto } from './dto/booking-query.dto';
import { CouponsService } from '../coupons/coupons.service';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly couponsService: CouponsService, // 👈 nuevo
  ) {}

  async completeBooking(bookingId: string, user: UserPayloadInterface) {
    const booking = await this.prisma.bookings.findUnique({
      where: { id: bookingId },
      include: { pin: true },
    });
    if (!booking) throw new NotFoundException('Reserva no encontrada');

    const isOwner = booking.pin.ownerId === user.id;
    const isAdmin = user.role === 'ADMIN';
    if (!isOwner && !isAdmin) throw new ForbiddenException('No autorizado');

    await this.prisma.$transaction([
      this.prisma.bookings.update({
        where: { id: bookingId },
        data: { status: BookingsStatus.complete },
      }),
      this.prisma.pin.update({
        where: { id: booking.pinId },
        data: { status: VehicleStatus.PUBLISHED },
      }),
    ]);

    return { success: true };
  }

  async cancelBooking(bookingId: string, user: UserPayloadInterface) {
    const booking = await this.prisma.bookings.findUnique({
      where: { id: bookingId },
      include: { pin: true },
    });
    if (!booking) throw new NotFoundException('Reserva no encontrada');

    const isRenter = booking.userId === user.id; // quien alquiló
    const isOwner = booking.pin.ownerId === user.id; // dueño del auto
    const isAdmin = user.role === 'ADMIN';
    if (!isRenter && !isOwner && !isAdmin)
      throw new ForbiddenException('No autorizado');

    await this.prisma.$transaction([
      this.prisma.bookings.update({
        where: { id: bookingId },
        data: { status: BookingsStatus.suspended, paymentStatus: 'UNPAID' },
      }),
      this.prisma.pin.update({
        where: { id: booking.pinId },
        data: { status: VehicleStatus.PUBLISHED },
      }),
    ]);

    return { success: true };
  }

  async create(createBooking: CreateBookingDto): Promise<Bookings> {
    const userExist = await this.prisma.user.findUnique({
      where: { id: createBooking.userId },
    });
    if (!userExist) throw new BadRequestException('Usuario no encotrado');

    const vehicle = await this.prisma.pin.findUnique({
      where: { id: createBooking.pinId },
    });
    if (!vehicle) throw new BadRequestException('Vehiculo no encotrado');
    if (vehicle.status !== VehicleStatus.PUBLISHED) {
      throw new BadRequestException('El vehículo no está disponible');
    }

    //verificacion de fechas y validacion de disponibilidad
    const availability: boolean = await this.checkAvailability(
      createBooking.pinId,
      createBooking.start_date,
      createBooking.end_date,
    );

    if (!availability) {
      throw new BadRequestException('Periodo no valido');
    }

    const prices = {
      pricePerDay: vehicle.pricePerDay,
      pricePerHour: vehicle.pricePerHour,
      pricePerWeek: vehicle.pricePerWeek,
    };

    //calculo de precio de alquiler
    let gross = priceCalculator(
      prices,
      createBooking.start_date,
      createBooking.end_date,
    );

    // === 🐘 NUEVA LÓGICA: buscar y aplicar cupón ENTERAMENTE EN EL BACK ===
    // - Si el front envía couponCode lo usamos.
    // - Si no, buscamos un cupón disponible para el user (bookingId null, no expirado).
    // - Calculamos el precio descontado en memoria antes de crear la booking.
    // - Después de crear la booking intentamos marcar el cupón como usado con protección contra race.
    // (todo lo marcado aquí con 🐘 es nuevo)
    let couponId: string | null = null;
    try {
      const maybeCouponCode = (createBooking as any)?.couponCode ?? null; // 🐘 acepta couponCode opcional
      let coupon: any = null;

      if (maybeCouponCode) {
        // buscar por código + user (si front envía código) 🐘
        coupon = await this.prisma.coupon.findFirst({
          where: {
            code: maybeCouponCode,
            userId: createBooking.userId,
            bookingId: null,
          },
        });
      } else {
        // buscar primer cupón válido del user (no usado y no expirado) 🐘
        coupon = await this.prisma.coupon.findFirst({
          where: {
            userId: createBooking.userId,
            bookingId: null,
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } },
            ],
          },
          orderBy: { createdAt: 'asc' },
        });
      }

      if (coupon) {
        // validar estado del cupón 🐘
        if (coupon.bookingId) {
          coupon = null; // ya usado, ignorar
        } else if (coupon.expiresAt && coupon.expiresAt < new Date()) {
          coupon = null; // expirado
        } else if (typeof coupon.discountPct !== 'number') {
          coupon = null; // inválido
        } else {
          couponId = coupon.id;
          const discount = (gross * coupon.discountPct) / 100;
          gross = Number((gross - discount).toFixed(2)); // aplicar descuento en memoria 🐘
        }
      }
    } catch (err) {
      // si falla la búsqueda del cupón no bloqueamos la reserva; solo logueamos 🐘
      console.error('Error buscando/aplicando cupón en back:', err);
      couponId = null;
    }
    // === FIN LÓGICA NUEVA 🐘 ===

    //calculos grales de impuestos comisiones etc
    const FEE = Number(process.env.PLATFORM_FEE_PCT ?? '0.15');
    const currency = process.env.DEFAULT_CURRENCY || 'COP';

    const platformFee = Number(gross) * FEE;
    const ownerEarning = Number(gross) - platformFee;

    //creacion de orden
    const newOrder = await this.prisma.bookings.create({
      data: {
        userId: createBooking.userId,
        pinId: vehicle.id,
        startDate: createBooking.start_date,
        endDate: createBooking.end_date,
        totalPrice: gross,
        currency,
        platformFee,
        ownerEarning,
      },
    });

    // === 🐘 NUEVO: marcar cupón como usado de forma segura (evita race FKs)
    if (couponId) {
      try {
        // intentamos actualizar solo si bookingId sigue siendo null
        const res = await this.prisma.coupon.updateMany({
          where: { id: couponId, bookingId: null },
          data: { bookingId: newOrder.id, usedAt: new Date() },
        });
        if (res.count === 0) {
          // no se actualizó: posible race o ya usado por otro proceso
          console.warn(
            `Coupon ${couponId} no pudo marcarse como usado (count=0) — posible condición de carrera`,
          );
        }
      } catch (err) {
        // si falla no queremos revertir la booking creada; logueamos 🐘
        console.error('Error marcando cupón como usado (seguro):', err);
      }
    }
    // === FIN marcar cupón 🐘 ===

    await this.prisma.pin.update({
      where: { id: vehicle.id },
      data: { bookingsCount: { increment: 1 }, updatedAt: new Date() },
    });

    return newOrder;
  }

  async findAllByUser(filtros: BookingsQueryDto): Promise<BookingsResponseDto> {
    const {
      page,
      limit,
      userId,
      status,
      pinId,
      paymentStatus,
      createdAtFrom,
      createdAtTo,
      startDateFrom,
      startDateTo,
    } = filtros;

    const where: any = {};

    if (userId) where.userId = userId;
    if (status) where.status = status;
    if (pinId) where.pinId = pinId;
    if (paymentStatus) where.paymentStatus = paymentStatus;

    // Filtro por fechas de creación
    if (createdAtFrom || createdAtTo) {
      where.createdAt = {};
      if (createdAtFrom) where.createdAt.gte = new Date(createdAtFrom);
      if (createdAtTo) where.createdAt.lte = new Date(createdAtTo);
    }

    // Filtro por fechas de inicio de reserva
    if (startDateFrom || startDateTo) {
      where.startDate = {};
      if (startDateFrom) where.startDate.gte = new Date(startDateFrom);
      if (startDateTo) where.startDate.lte = new Date(startDateTo);
    }

    const validPage = isNaN(page) || page < 1 ? 1 : page;
    const validLimit = isNaN(limit) || limit < 1 ? 10 : Math.min(limit, 100);

    const skip = (validPage - 1) * validLimit;

    const [bookings, total] = await Promise.all([
      this.prisma.bookings.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          pin: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: validLimit,
      }),
      this.prisma.bookings.count({ where: { userId } }),
    ]);

    const totalPages = Math.ceil(total / validLimit);
    const hasNext = validPage < totalPages;
    const hasPrev = validPage > 1;

    return {
      data: bookings,
      total,
      page: validPage,
      limit: validLimit,
      totalPages,
      hasNext,
      hasPrev,
    };
  }

  async findOne(bookingId: string): Promise<bookingDto> {
    const booking = await this.prisma.bookings.findFirst({
      where: {
        id: bookingId,
      },
      include: {
        pin: true,
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
      throw new NotFoundException('Reserva no encontrada o acceso denegado');
    }

    return booking;
  }

  //funciones extras

  async checkAvailability(
    pinId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<boolean> {
    validateDates(startDate, endDate); //validador de fechas

    const overlappingBooking = await this.prisma.bookings.findFirst({
      //validador de superposicion de fechas en ordenes activas
      where: {
        pinId: pinId,
        status: 'active',
        OR: [
          {
            startDate: { lte: startDate },
            endDate: { gte: startDate },
          },

          {
            startDate: { lte: endDate },
            endDate: { gte: endDate },
          },

          {
            startDate: { gte: startDate },
            endDate: { lte: endDate },
          },
        ],
      },
    });

    if (overlappingBooking) {
      return false;
    }

    return true;
  }
}
