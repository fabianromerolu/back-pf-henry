import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateBookingDto } from './dto/create-booking.dto';
import { PrismaService } from 'src/infra/prisma/prisma.service';

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createBookingDto: CreateBookingDto): Promise<string> {
    const userExist = await this.prisma.user.findUnique({
      where: { id: createBookingDto.userId },
    });

    if (!userExist) throw new BadRequestException('Usuario no encotrado');

    return 'This action adds a new booking';
  }

  findOne(id: number) {
    return `This action returns a #${id} booking`;
  }
}
