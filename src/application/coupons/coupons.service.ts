// src/application/coupons/coupons.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/infra/prisma/prisma.service';

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async createWelcomeCoupon(userId: string) {
    // Verificar que el usuario exista
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException(`User with id ${userId} not found`);
    }

    // Si ya tiene cupón, devolverlo
    const existing = await this.prisma.coupon.findFirst({ // 🐶 cambiado: findFirst en vez de findUnique
      where: { userId },
      include: { user: true }, // incluir datos del usuario
    });

    if (existing) return existing;

    // Crear cupón nuevo
    return this.prisma.coupon.create({
      data: {
        userId,
        code: `WELCOME-${userId.slice(0, 6)}`,
        discountPct: 20,
        description: 'Cupón de bienvenida para tu primera reserva',
        expiresAt: new Date(new Date().setMonth(new Date().getMonth() + 1)),
      },
      include: { user: true }, // incluir datos del usuario
    });
  }

  // 🐶 NUEVO: calcula el monto descontado sin tocar la DB (solo lectura)
  async calculateCouponDiscount(userId: string, gross: number): Promise<{ discountedGross: number; couponId: string | null }> {
    try {
      const coupon = await this.prisma.coupon.findFirst({ where: { userId } }); // 🐶 findFirst seguro
      if (!coupon) return { discountedGross: gross, couponId: null };
      if (coupon.bookingId) return { discountedGross: gross, couponId: null }; // ya usado
      if (coupon.expiresAt && coupon.expiresAt < new Date()) return { discountedGross: gross, couponId: null }; // expirado

      const discount = (gross * coupon.discountPct) / 100;
      return { discountedGross: gross - discount, couponId: coupon.id };
    } catch (err) {
      // 🐶 en caso de error no bloqueamos la reserva: devolvemos el bruto sin descuento
      console.error('calculateCouponDiscount error:', err);
      return { discountedGross: gross, couponId: null };
    }
  }

  // 🐶 NUEVO: marcar cupón como usado después de crear la reserva (escribe la bookingId real)
  async markCouponUsed(couponId: string, bookingId: string) {
    return this.prisma.coupon.update({
      where: { id: couponId },
      data: { bookingId, usedAt: new Date() },
    });
  }

  // 🐶 OPCIONAL: mantener applyCoupon por compatibilidad, usa la lógica segura (no recomendable para el flujo que crea reserva)
  async applyCoupon(userId: string, bookingId: string | null, gross: number) {
    // Si se pasa bookingId no nativo (ej: vehicle.id), esto seguirá fallando por FK.
    // Por eso preferimos usar calculateCouponDiscount + markCouponUsed en dos pasos desde BookingsService.
    const { discountedGross, couponId } = await this.calculateCouponDiscount(userId, gross);
    if (!couponId) return discountedGross;

    if (bookingId) {
      // Intentar marcar usado solo si bookingId corresponde a una booking válida.
      try {
        // Verificar existencia de booking antes de actualizar la FK
        const bookingExists = await this.prisma.bookings.findUnique({ where: { id: bookingId } });
        if (!bookingExists) {
          // no marcar, devolver el monto descontado (pero no intentar escribir FK)
          return discountedGross;
        }
        await this.markCouponUsed(couponId, bookingId);
      } catch (err) {
        console.error('applyCoupon mark error:', err);
        // no bloquear la reserva si hay error
        return discountedGross;
      }
    }

    return discountedGross;
  }
}
