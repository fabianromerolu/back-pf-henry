import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({
    example: '3f6a48e5-789b-4a22-8127-2e408c15df09',
    description: 'ID único de la reserva (booking) a pagar',
  })
  @IsUUID()
  @IsNotEmpty()
  bookingId: string;
}
