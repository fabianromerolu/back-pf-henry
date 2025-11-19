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

  @Cron('*/1 * * * *') // se ejecuta cada 1 min
  async handlePendingBookings() {
    this.logger.log('Ejecutando cron para reservas pending...');

    const now = new Date();
    //const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000); //periodo de 24hs
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000); //periodo de 5 min

    // busca reservas pendientes
    const pendingBookings = await this.prisma.bookings.findMany({
      where: {
        status: 'pending',
        createdAt: {
          gt: fiveMinutesAgo, //evalua a las que solo esten dentro del margen de tiempo
        },
      },
      include: {
        user: true,
      },
    });

    for (const booking of pendingBookings) {
      //manda los email
      await this.mailerService.sendPendingReminder(
        booking.user.email,
        booking.user.name ?? 'usuario',
      );
    }

    //  Busca reservas vencidas pasando 5min
    const expiredBookings = await this.prisma.bookings.findMany({
      where: {
        status: 'pending',
        createdAt: { lte: fiveMinutesAgo },
      },
      include: {
        user: true,
      },
    });

    for (const booking of expiredBookings) {
      // manda email de cancelacion
      await this.mailerService.sendBookingCancelled(
        booking.user.email,
        booking.user.name ?? 'usuario',
      );

      // cambiar estado
      await this.prisma.bookings.update({
        where: { id: booking.id },
        data: { status: 'suspended' },
      });
    }
  }
}
