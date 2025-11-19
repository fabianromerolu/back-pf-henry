import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { MailerService } from '../mailer/mailer.service';
import { PrismaService } from 'src/infra/prisma/prisma.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailerService: MailerService,
  ) {}

  // se ejecuta cada 5 min
  @Cron('*/5 * * * *')
  async handlePendingBookings() {
    this.logger.log('Ejecutando cron para reservas pending...');

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // busca reservas pendientes
    const pendingBookings = await this.prisma.bookings.findMany({
      where: {
        status: 'pending',
        createdAt: {
          gt: twentyFourHoursAgo,
        },
      },
      include: {
        user: true,
      },
    });

    for (const booking of pendingBookings) {
      await this.mailerService.sendPendingReminder(
        booking.user.email,
        booking.user.name,
      );
    }

    // ---------------------------
    // 2. Buscar reservas PENDING vencidas (más de 24 horas)
    // ---------------------------
    const expiredBookings = await this.prisma.bookings.findMany({
      where: {
        status: 'pending',
        createdAt: {
          lte: twentyFourHoursAgo,
        },
      },
      include: {
        user: true,
      },
    });

    for (const booking of expiredBookings) {
      // enviar notificación de cancelación
      await this.mailerService.sendBookingCancelled(
        booking.user.email,
        booking.user.name,
      );

      // cambiar estado → suspended
      await this.prisma.bookings.update({
        where: { id: booking.id },
        data: { status: 'suspended' },
      });
    }
  }
}
