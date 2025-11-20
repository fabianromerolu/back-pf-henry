// src/application/bookings/bookings.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CouponsModule } from '../coupons/coupons.module'; // 🐘 añadido

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
    }),
    // usamos forwardRef por si existe dependencia circular entre BookingsModule <-> CouponsModule
    forwardRef(() => CouponsModule), // 🐘 añadido
  ],
  controllers: [BookingsController],
  providers: [BookingsService, JwtAuthGuard],
})
export class BookingsModule {}
