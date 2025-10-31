import { IsString, IsOptional, IsNumber, IsInt, Min, IsIn } from 'class-validator';

export class CreateCouponDto {
  @IsString()
  code!: string;

  // 👇 CAMBIO: ahora validamos como string con valores permitidos
  @IsString()
  @IsIn(['PERCENT', 'FIXED'])
  type!: string;

  @IsNumber()
  value!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  perUserLimit?: number;

  @IsOptional()
  @IsNumber()
  minSpend?: number;

  @IsOptional()
  expiresAt?: string; // ISO date
}