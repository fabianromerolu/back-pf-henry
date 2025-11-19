import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { BookingsService } from '../bookings/bookings.service';
import { MailerService } from '../mailer/mailer.service';
import { ScheduleModule } from '@nestjs/schedule';



@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [CronService, BookingsService, MailerService],
})
export class CronModule {}
