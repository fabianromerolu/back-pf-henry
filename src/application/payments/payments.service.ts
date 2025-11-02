import { Injectable, Inject, Logger } from '@nestjs/common';
import MercadoPagoConfig, { Payment, Preference } from 'mercadopago';
import { PrismaService } from 'src/infra/prisma/prisma.service';

type PreferenceCreateResponse = {
  id?: string;
  init_point?: string;
  sandbox_init_point?: string;
  response?: {
    id?: string;
    init_point?: string;
    sandbox_init_point?: string;
  };
};

export interface MercadoPagoWebhookData {
  id?: number;
  type?: string;
  topic?: string;
  action?: string;
  date_created?: string;
  live_mode?: boolean;
  user_id?: string;
  api_version?: string;
  data?: {
    id?: string | number;
  };
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly payment: Payment;

  constructor(
    @Inject('MP_PREFERENCE') private readonly preference: Preference,
    @Inject('MP_CLIENT') private readonly client: MercadoPagoConfig,
    private readonly prisma: PrismaService,
  ) {
    this.payment = new Payment(this.client);
  }

  async createPayment(bookingId: string) {
    try {
      const body = {
        items: [
          {
            id: bookingId,
            title: 'Reserva de vehículo',
            quantity: 1,
            unit_price: 100,
            currency_id: 'ARS',
          },
        ],
        back_urls: {
          success: `${process.env.MP_BACKEND_URL}/payments/success`,
          pending: `${process.env.MP_BACKEND_URL}/payments/pending`,
          failure: `${process.env.MP_BACKEND_URL}/payments/failure`,
        },
        auto_return: 'approved',
        external_reference: bookingId,
        notification_url: `${process.env.MP_BACKEND_URL}/payments/webhook`,
      };

      const result = (await this.preference.create({
        body,
      })) as PreferenceCreateResponse;

      if (!result || (!result.init_point && !result.response?.init_point)) {
        throw new Error(
          'Respuesta inesperada al crear la preferencia de pago.',
        );
      }

      const initPoint = result.response?.init_point || result.init_point;

      return { init_point: initPoint };
    } catch (error) {
      this.logger.error('Error creando preferencia:', error);
      throw new Error('Error al crear la preferencia de pago');
    }
  }

  async handleWebhook(data: MercadoPagoWebhookData) {
    try {
      this.logger.log(`Webhook recibido: ${JSON.stringify(data)}`);

      const topic = data.topic || data.type;

      if (topic !== 'payment') return { received: true };

      const paymentId = data.data?.id ?? data.id;
      if (!paymentId) {
        this.logger.warn('Webhook sin ID de pago');
        return { received: false };
      }

      const result = await this.payment.get({
        id: paymentId,
      });
      this.logger.log(`Pago consultado: ${JSON.stringify(result)}`);

      const bookingId = result.external_reference;
      if (!bookingId) {
        this.logger.warn('No se encontró bookingId en external_reference');
        return { received: true };
      }

      const status = (result.status ?? 'UNKNOWN').toUpperCase();

      let paymentStatus: string;

      switch (status) {
        case 'APPROVED':
          paymentStatus = 'PAID';
          break;
        case 'PENDING':
          paymentStatus = 'PENDING';
          break;
        case 'REJECTED':
          paymentStatus = 'FAILED';
          break;
        default:
          paymentStatus = 'UNPAID';
      }

      if (bookingId) {
        await this.prisma.bookings.update({
          where: { id: bookingId },
          data: {
            paymentStatus,
            paymentId: String(result.id),
          },
        });
        this.logger.log(
          `Booking ${bookingId} actualizado a estado ${paymentStatus}`,
        );
      }

      return { received: true };
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Error al procesar webhook: ${err.message}`);
      return { received: false, error: err.message };
    }
  }
}
