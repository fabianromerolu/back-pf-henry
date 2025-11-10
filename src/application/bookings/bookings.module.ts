import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CouponsModule } from '../coupons/coupons.module';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
    }),
    CouponsModule
  ],
  controllers: [BookingsController],
  providers: [BookingsService, JwtAuthGuard],
})
export class BookingsModule {}
