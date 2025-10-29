import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateBookingDto } from './dto/create-booking.dto';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { priceCalculator } from 'src/utils/ordersFunctions/ordersFunction';
import { price } from 'src/utils/ordersFunctions/ordersInterface';
import { VehicleStatus } from '@prisma/client';
import { bookingDto } from './dto/booking.dto';

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createBooking: CreateBookingDto): Promise<bookingDto> {
    const userExist = await this.prisma.user.findUnique({
      where: { id: createBooking.userId },
    });

    if (!userExist) throw new BadRequestException('Usuario no encotrado');

    const vehicleExist = await this.prisma.pin.findUnique({
      where: { id: createBooking.pinId },
    });
    if (!vehicleExist) throw new BadRequestException('Vehiculo no encotrado');

    const prices: price = {
      pricePerDay: vehicleExist.pricePerDay,
      pricePerHour: vehicleExist.pricePerHour,
      pricePerWeek: vehicleExist.pricePerWeek,
    };
    const newOrder = this.prisma.bookings.create({
      data: {
        userId: userExist.id,
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

  findOne(id: number) {
    return `This action returns a #${id} booking`;
  }
}
