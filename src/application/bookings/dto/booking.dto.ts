import { ApiProperty } from '@nestjs/swagger';
import { BookingsStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export class bookingDto {
  id: string;
  startDate: Date;
  endDate: Date;
  status: BookingsStatus;
  totalPrice: Decimal;
  pinId: string;
}

export class BookingsResponseDto {
  @ApiProperty({ type: [bookingDto] })
  data: bookingDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  hasNext: boolean;

  @ApiProperty()
  hasPrev: boolean;
}
