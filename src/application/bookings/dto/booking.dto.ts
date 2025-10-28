import { BookingsStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export class bookingDto {
  id: string;
  startDate: Date;
  endDate: Date;
  status: BookingsStatus;
  totalPrice: Decimal;
  userId: string;
  pinId: string;
}
