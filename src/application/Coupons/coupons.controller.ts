import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dtos/create-coupon.dto';
import { ValidateCouponDto } from './dtos/validate.coupon.dto';
import { RedeemCouponDto } from './dtos/redee-coupon';
import { AnyJwtGuard } from '../auth/guards/any-jwt.guard';
import { Roles } from '../auth/types/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AppRole } from '@prisma/client';


@Controller('coupons')
export class CouponsController {
constructor(private readonly coupons: CouponsService) {}


// @UseGuards(AnyJwtGuard, RolesGuard)
// @Roles(AppRole.ADMIN)
@Post()
async create(@Body() dto: CreateCouponDto) {
return this.coupons.create(dto as any);
}


@UseGuards(AnyJwtGuard)
@Post('validate')
async validate(@Body() dto: ValidateCouponDto, @Req() req: any) {
const userId = req?.user?.sub;
return this.coupons.validate(dto.code, dto.total, userId);
}


@UseGuards(AnyJwtGuard)
@Post('redeem')
async redeem(@Body() dto: RedeemCouponDto, @Req() req: any) {
const userId = req?.user?.sub;
return this.coupons.redeem(dto.code, dto.total, userId, dto.bookingId);
}
}
