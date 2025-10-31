import { IsString, IsNumber } from 'class-validator';

export class ValidateCouponDto {
  @IsString()
  code!: string; // código del cupón a validar

  @IsNumber({ allowNaN: false, allowInfinity: false })
  total!: number; // total de la compra sobre el que se validará el cupón
}