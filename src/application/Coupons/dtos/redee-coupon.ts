import { IsString, IsNumber, IsOptional } from 'class-validator';

export class RedeemCouponDto {
  @IsString()
  code!: string; // código del cupón a redimir

  @IsNumber({ allowNaN: false, allowInfinity: false })
  total!: number; // total de la compra sobre el que se aplicará el cupón

  @IsOptional()
  @IsString()
  bookingId?: string; // opcional: id de la reserva a asociar
}