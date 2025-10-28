import { Decimal } from '@prisma/client/runtime/library';

export interface price {
  pricePerHour: Decimal;
  pricePerDay: Decimal;
  pricePerWeek: Decimal;
}
