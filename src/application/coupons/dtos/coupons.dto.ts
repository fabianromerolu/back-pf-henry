import { ApiProperty } from '@nestjs/swagger'; 

 

export class CouponDto { 

  @ApiProperty() id: string; 

  @ApiProperty() code: string; 

  @ApiProperty() discountPct: number; 

  @ApiProperty() description?: string; 

  @ApiProperty() userId: string; 

  @ApiProperty() bookingId?: string; 

  @ApiProperty() createdAt: Date; 

  @ApiProperty() usedAt?: Date; 

  @ApiProperty() expiresAt?: Date; 

} 