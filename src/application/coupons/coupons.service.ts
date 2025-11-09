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
    const existing = await this.prisma.coupon.findUnique({
      where: { userId },
      include: { user: true }, // 👈 incluir datos del usuario
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
      include: { user: true }, // 👈 incluir datos del usuario
    });
  }

  async applyCoupon(userId: string, bookingId: string, gross: number) {
    const coupon = await this.prisma.coupon.findUnique({ where: { userId } });
    if (!coupon) return gross;
    if (coupon.bookingId) return gross; // ya usado
    if (coupon.expiresAt && coupon.expiresAt < new Date()) return gross;

    const discount = (gross * coupon.discountPct) / 100;
    await this.prisma.coupon.update({
      where: { id: coupon.id },
      data: { bookingId, usedAt: new Date() },
    });

    return gross - discount;
  }
}