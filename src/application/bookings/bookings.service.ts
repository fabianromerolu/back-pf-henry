import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateBookingDto } from './dto/create-booking.dto';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { priceCalculator } from 'src/utils/ordersFunctions/ordersFunction';
import { price } from 'src/utils/ordersFunctions/ordersInterface';
import { VehicleStatus } from '@prisma/client';
import { bookingDto, BookingsResponseDto } from './dto/booking.dto';

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createBooking: CreateBookingDto,
    userId: string,
  ): Promise<bookingDto> {
    const userExist = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userExist) throw new BadRequestException('Usuario no encotrado');

    const vehicleExist = await this.prisma.pin.findUnique({
      where: { id: createBooking.pinId },
    });
    if (!vehicleExist) throw new BadRequestException('Vehiculo no encotrado');
    if (vehicleExist.status !== VehicleStatus.PUBLISHED) {
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

    const prices: price = {
      pricePerDay: vehicleExist.pricePerDay,
      pricePerHour: vehicleExist.pricePerHour,
      pricePerWeek: vehicleExist.pricePerWeek,
    };
    const newOrder = await this.prisma.bookings.create({
      data: {
        userId: userId,
        startDate: createBooking.start_date,
        endDate: createBooking.end_date,
        pinId: vehicleExist.id,
        totalPrice: priceCalculator(
          prices,
          createBooking.start_date,
          createBooking.end_date,
        ),
      },
    });

    // await this.prisma.pin.update({
    //   where: {
    //     id: vehicleExist.id,
    //   },
    //   data: {
    //     status: VehicleStatus.BLOCKED,
    //     updatedAt: new Date(),
    //   },
    // });
    return newOrder;
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
