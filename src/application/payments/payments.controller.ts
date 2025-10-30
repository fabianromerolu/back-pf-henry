import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { MercadoPagoWebhookData, PaymentsService } from './payments.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreatePaymentDto } from './dto/create-payment.dto';

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
}
