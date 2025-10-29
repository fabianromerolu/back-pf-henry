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
import { bookingDto } from './dto/booking.dto';

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
    if (vehicleExist.status !== VehicleStatus.DRAFT) {
      throw new BadRequestException('El vehículo no está disponible');
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

    await this.prisma.pin.update({
      where: {
        id: vehicleExist.id,
      },
      data: {
        status: VehicleStatus.BLOCKED,
        updatedAt: new Date(),
      },
    });
    return newOrder;
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
}
