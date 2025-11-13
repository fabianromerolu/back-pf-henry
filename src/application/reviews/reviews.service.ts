import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { BookingsStatus } from '@prisma/client';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  // Crear una review a partir de una reserva
  async createFromBooking(userId: string, dto: CreateReviewDto) {
    const { bookingId, rating, comment } = dto;

    const booking = await this.prisma.bookings.findUnique({
      where: { id: bookingId },
    });

    if (!booking) throw new NotFoundException('Reserva no encontrada');

    if (booking.userId !== userId) {
      throw new ForbiddenException(
        'No puedes reseñar una reserva que no te pertenece.',
      );
    }

    const now = new Date();
    const finished =
      booking.status === BookingsStatus.complete || booking.endDate < now;

    if (!finished) {
      throw new BadRequestException(
        'Solo puedes dejar una reseña cuando la reserva haya finalizado.',
      );
    }

    const existing = await this.prisma.review.findFirst({
      where: { bookingId },
    });
    if (existing) {
      throw new BadRequestException(
        'Ya has dejado una reseña para esta reserva.',
      );
    }
    // 🟢 Crear la reseña
    const review = await this.prisma.review.create({
      data: {
        rating,
        comment,
        userId,
        pinId: booking.pinId,
        bookingId,
      },
    });

    // 🟡 Recalcular promedio de calificaciones del Pin
    const result = await this.prisma.review.aggregate({
      where: { pinId: booking.pinId },
      _avg: { rating: true },
    });

    const newAverage = result._avg.rating ?? 0;

    // 🔵 Actualizar el campo averageRating en la tabla Pin
    await this.prisma.pin.update({
      where: { id: booking.pinId },
      data: { averageRating: newAverage },
    });

    return review;
  }

  // Obtener reseñas simplificadas para el front
  async getByPin(pinId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { pinId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            name: true,
            username: true,
            profilePicture: true,
          },
        },
      },
    });

    // Transformar al formato ReviewProps
    return reviews.map((r) => ({
      userName: r.user.name ?? r.user.username,
      comment: r.comment,
      rating: r.rating,
      userImage: r.user.profilePicture ?? null,
    }));
  }

  // Calcular promedio y cantidad de reviews de un pin
  async getPinSummary(pinId: string) {
    const result = await this.prisma.review.aggregate({
      where: { pinId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    return {
      average: result._avg.rating ?? 0,
      totalReviews: result._count.rating,
    };
  }
}
