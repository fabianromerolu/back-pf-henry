//src/application/payments/payments.service.ts
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
      const booking = await this.prisma.bookings.findUnique({
        where: { id: bookingId },
      });
      if (!booking) throw new Error('Booking not found');

      const price = Number(booking.totalPrice);
      if (isNaN(price) || price <= 0) {
        throw new Error(
          `Precio inválido para la reserva ${bookingId}: ${booking.totalPrice}`,
        );
      }

      const body = {
        items: [
          {
            id: bookingId,
            title: 'Reserva de vehículo',
            quantity: 1,
            unit_price: price,
            currency_id:
              process.env.MP_CURRENCY_ID || booking.currency || 'MXN',
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
      const initPoint = result.response?.init_point || result.init_point;
      if (!initPoint) throw new Error('MP init_point vacío');
      return { init_point: initPoint };
    } catch (e) {
      this.logger.error('Error creando preferencia:', e);
      throw new Error('Error al crear la preferencia de pago');
    }
  }

  async handleWebhook(data: MercadoPagoWebhookData) {
    try {
      this.logger.log(`Webhook recibido: ${JSON.stringify(data)}`);
      const topic = data.topic || data.type;
      if (topic !== 'payment') return { received: true };

      const paymentId = data.data?.id ?? data.id;
      if (!paymentId) return { received: false };

      const result = await this.payment.get({ id: paymentId });
      const bookingId = result.external_reference;
      if (!bookingId) return { received: true };

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

      const booking = await this.prisma.bookings.update({
        where: { id: bookingId },
        data: { paymentStatus, paymentId: String(result.id) },
        include: { pin: true },
      });

      // 👇 Credita wallet si se aprobó
      if (paymentStatus === 'PAID') {
        const holdDays = Number(process.env.WALLET_HOLD_DAYS ?? '3');
        const availableAt = new Date();
        availableAt.setDate(availableAt.getDate() + holdDays);

        await this.prisma.walletTransaction.create({
          data: {
            ownerId: booking.pin.ownerId,
            bookingId: booking.id,
            type: 'CREDIT',
            amount: booking.ownerEarning,
            currency: booking.currency || 'COP',
            status: holdDays > 0 ? 'PENDING' : 'AVAILABLE',
            availableAt: holdDays > 0 ? availableAt : null,
          },
        });
      }

      return { received: true };
    } catch (error: any) {
      this.logger.error(`Error al procesar webhook: ${error?.message}`);
      return { received: false, error: error?.message };
    }
  }
}
