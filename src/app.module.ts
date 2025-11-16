//src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './infra/prisma/prisma.module';
import { AuthModule } from './application/auth/auth.module';
import { UsersModule } from './application/users/users.module';
import { PinModule } from './application/pins/pins.module';
import { FilesModule } from './application/files/files.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MailerModule } from './application/mailer/mailer.module';
import { BookingsModule } from './application/bookings/bookings.module';
import { PaymentsModule } from './application/payments/payments.module';

import { AdminModule } from './application/admin/admin.module';
import { ReviewsModule } from './application/reviews/reviews.module';
import { CouponsModule } from './application/coupons/coupons.module';
import { StandardUserModule } from './application/standard-user/standard-user.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),
    PrismaModule,
    AuthModule,
    UsersModule,
    PinModule,
    FilesModule,
    MailerModule,
    BookingsModule,
    PaymentsModule,
    AdminModule,
    ReviewsModule,
    CouponsModule,
    StandardUserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
