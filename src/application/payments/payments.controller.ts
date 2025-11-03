//src/application/payments/payments.controller.ts
import {
  Controller,
  Post,
  Body,
  HttpCode,
  Get,
  Query,
  Res,
} from '@nestjs/common';
import { MercadoPagoWebhookData, PaymentsService } from './payments.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { Response } from 'express';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @ApiOperation({ summary: 'Crea una preferencia de pago en Mercado Pago' })
  @ApiResponse({
    status: 201,
    description: 'Preferencia creada correctamente',
    schema: {
      example: {
        init_point: 'https://www.mercadopago.com/init_point_url...',
      },
    },
  })
  async createPreference(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.createPayment(dto.bookingId);
  }

  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Webhook de Mercado Pago: recibe notificaciones de pago',
  })
  async webhook(@Body() body: MercadoPagoWebhookData) {
    return this.paymentsService.handleWebhook(body);
  }

  @Get('success')
  success(@Query() query: Record<string, string>, @Res() res: Response) {
    const FRONT_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
    const paymentId = query['payment_id'];
    console.log('Pago aprobado:', query);
    res.redirect(`${FRONT_URL}/success?payment_id=${paymentId}`);
  }

  @Get('pending')
  pending(@Query() query: Record<string, string>, @Res() res: Response) {
    const FRONT_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
    const paymentId = query['payment_id'];
    console.log('Pago pendiente:', query);
    res.redirect(`${FRONT_URL}/pending?payment_id=${paymentId}`);
  }

  @Get('failure')
  failure(@Query() query: Record<string, string>, @Res() res: Response) {
    const FRONT_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
    const paymentId = query['payment_id'];
    console.log('Pago fallido:', query);
    res.redirect(`${FRONT_URL}/failure?payment_id=${paymentId}`);
  }
}
