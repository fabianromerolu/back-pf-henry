import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateBookingDto } from './dto/create-booking.dto';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { priceCalculator } from 'src/utils/ordersFunctions/ordersFunction';
import { price } from 'src/utils/ordersFunctions/ordersInterface';
import { BookingsStatus, VehicleStatus } from '@prisma/client';
import { bookingDto, BookingsResponseDto } from './dto/booking.dto';
import { UserPayloadInterface } from './interfaces/bookingsInterface';

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async create(
    createBooking: CreateBookingDto,
    userId: string,
  ): Promise<bookingDto> {
    const userExist = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!userExist) throw new BadRequestException('Usuario no encotrado');

    const vehicle = await this.prisma.pin.findUnique({
      where: { id: createBooking.pinId },
    });
    if (!vehicle) throw new BadRequestException('Vehiculo no encotrado');
    if (vehicle.status !== VehicleStatus.PUBLISHED) {
      throw new BadRequestException('El vehículo no está disponible');
    }

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
    const gross = priceCalculator(
      prices,
      createBooking.start_date,
      createBooking.end_date,
    );
    const FEE = Number(process.env.PLATFORM_FEE_PCT ?? '0.15');
    const currency = process.env.DEFAULT_CURRENCY || 'COP';

    const platformFee = Number(gross) * FEE;
    const ownerEarning = Number(gross) - platformFee;

    const newOrder = await this.prisma.bookings.create({
      data: {
        userId,
        pinId: vehicle.id,
        startDate: createBooking.start_date,
        endDate: createBooking.end_date,
        totalPrice: gross,
        currency,
        platformFee,
        ownerEarning,
      },
    });

    // await this.prisma.pin.update({
    //   where: { id: vehicle.id },
    //   data: { status: VehicleStatus.BLOCKED, updatedAt: new Date() },
    // });

    return newOrder as any;
  }

  async findAllByUser(
    userId: string,
    page: number,
    limit: number,
  ): Promise<BookingsResponseDto> {
    const validPage = isNaN(page) || page < 1 ? 1 : page;
    const validLimit = isNaN(limit) || limit < 1 ? 10 : Math.min(limit, 100);

    const skip = (validPage - 1) * validLimit;

    const [bookings, total] = await Promise.all([
      this.prisma.bookings.findMany({
        where: { userId },
        include: {
          pin: {
            select: {
              id: true,
              model: true,
              pricePerDay: true,
              pricePerHour: true,
              pricePerWeek: true,
            },
          },
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

  async findOne(bookingId: string, userId: string): Promise<bookingDto> {
    const booking = await this.prisma.bookings.findFirst({
      where: {
        id: bookingId,
        userId: userId,
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

  async checkAvailability(
    pinId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<boolean> {
    this.validateDates(startDate, endDate);

    const overlappingBooking = await this.prisma.bookings.findFirst({
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

  private validateDates(startDate: Date, endDate: Date): void {
    const now = new Date();

    if (startDate < now) {
      throw new BadRequestException(
        'La fecha de inicio no puede ser en el pasado',
      );
    }

    if (endDate <= startDate) {
      throw new BadRequestException(
        'La fecha de fin debe ser posterior a la fecha de inicio',
      );
    }

    const minRentalHours = 1;
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < minRentalHours) {
      throw new BadRequestException(
        `El período mínimo de alquiler es ${minRentalHours} hora`,
      );
    }
  }
}
