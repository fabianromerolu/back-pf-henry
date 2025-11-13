// src/application/coupons/coupons.controller.ts 

import { Controller, Post, Body } from '@nestjs/common'; 

import { CouponsService } from './coupons.service'; 

import { MailerService } from '../mailer/mailer.service'; 

 

@Controller('coupons') 

export class CouponsController { 

  constructor( 

    private readonly couponsService: CouponsService, 

    private readonly mailerService: MailerService, 

  ) {} 

 

  @Post() 

  async create(@Body() body: { userId: string }) { 

    return this.couponsService.createWelcomeCoupon(body.userId); 

  } 

 

  // 🚀 Endpoint para enviar el cupón por correo 

  @Post('send') 

  async sendCoupon(@Body() body: { userId: string }) { 

    const coupon = await this.couponsService.createWelcomeCoupon(body.userId); 

 

    // usar MailerService para enviar el correo con la plantilla "coupon" 

    await this.mailerService.sendCouponEmail( 

      coupon.user.email,       // email del usuario 

      coupon.code,             // código del cupón 

      coupon.discountPct,      // porcentaje de descuento 

    ); 

 

    return { message: 'Cupón enviado por correo', coupon }; 

  } 

} 