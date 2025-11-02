import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { MailerService } from '../mailer/mailer.service';

@Injectable()
export class CouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
  ) {}

  async create(dto: any) {
    const code = (dto.code || '').toUpperCase().trim();
    return this.prisma.coupon.create({
      data: { ...dto, code },
    });
  }

  async validate(codeRaw: string, total: number, userId?: string) {
    const code = (codeRaw || '').toUpperCase().trim();
    const coupon = await this.prisma.coupon.findUnique({ where: { code } });
    if (!coupon) return { valid: false, reason: 'NOT_FOUND' };
    if (!coupon.active) return { valid: false, reason: 'INACTIVE' };
    if (coupon.expiresAt && coupon.expiresAt < new Date())
      return { valid: false, reason: 'EXPIRED' };
    if (coupon.minSpend && Number(total) < Number(coupon.minSpend))
      return { valid: false, reason: 'MIN_SPEND' };
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses)
      return { valid: false, reason: 'NO_USES_LEFT' };

    if (userId && coupon.perUserLimit) {
      const userUses = await this.prisma.couponRedemption.count({
        where: { couponId: coupon.id, userId },
      });
      if (userUses >= coupon.perUserLimit)
        return { valid: false, reason: 'PER_USER_LIMIT' };
    }

    // calcular descuento
    let discount = 0;
    const t = Number(total);
    if (coupon.type === 'PERCENT') {
      discount = (t * Number(coupon.value)) / 100;
    } else {
      discount = Math.min(t, Number(coupon.value));
    }

    return {
      valid: true,
      discount: Number(discount.toFixed(2)),
      couponId: coupon.id,
    };
  }

  /**
   * Redime y registra la redención en una transacción
   */
  async redeem(
    codeRaw: string,
    total: number,
    userId: string,
    bookingId?: string,
  ) {
    const code = (codeRaw || '').toUpperCase().trim();

    return this.prisma.$transaction(async (tx) => {
      const coupon = await tx.coupon.findUnique({ where: { code } });
      if (!coupon) throw new NotFoundException('Coupon not found');
      if (!coupon.active) throw new BadRequestException('Coupon inactive');
      if (coupon.expiresAt && coupon.expiresAt < new Date())
        throw new BadRequestException('Coupon expired');
      if (coupon.minSpend && Number(total) < Number(coupon.minSpend))
        throw new BadRequestException('Coupon min spend not met');
      if (coupon.maxUses && coupon.usedCount >= coupon.maxUses)
        throw new BadRequestException('Coupon uses exhausted');

      if (coupon.perUserLimit) {
        const userUses = await tx.couponRedemption.count({
          where: { couponId: coupon.id, userId },
        });
        if (userUses >= coupon.perUserLimit)
          throw new BadRequestException('Coupon per-user limit reached');
      }

      // 👇 Registro de la redención
      await tx.couponRedemption.create({
        data: {
          couponId: coupon.id,
          userId,
        },
      });

      // 👇 Incrementar contador global
      await tx.coupon.update({
        where: { id: coupon.id },
        data: { usedCount: { increment: 1 } },
      });

      // 👇 Asociar al booking si corresponde
      if (bookingId) {
        await tx.bookings.update({
          where: { id: bookingId },
          data: { couponId: coupon.id },
        });
      }

      // Calcular descuento
      let discount = 0;
      const t = Number(total);
      if (coupon.type === 'PERCENT') {
        discount = (t * Number(coupon.value)) / 100;
      } else {
        discount = Math.min(t, Number(coupon.value));
      }

      return {
        success: true,
        discount: Number(discount.toFixed(2)),
        couponId: coupon.id,
      };
    });
  }
}


