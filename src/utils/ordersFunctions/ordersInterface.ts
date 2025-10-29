import { Prisma } from '@prisma/client';

export interface price {
  pricePerHour: Prisma.Decimal | number;
  pricePerDay: Prisma.Decimal | number;
  pricePerWeek: Prisma.Decimal | number;
}
