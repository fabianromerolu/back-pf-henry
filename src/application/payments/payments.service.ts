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
  resource?: string;
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
          success: `https://front-pf-henry.vercel.app/payments/success`,
          failure: `https://front-pf-henry.vercel.app/payments/failure`,
          pending: `https://front-pf-henry.vercel.app/payments/pending`,
        },
        auto_return: 'approved',
        external_reference: bookingId,
        notification_url: `${process.env.MP_BACKEND_URL}/payments/webhook`,
      };

      console.log('DEBUG PAYMENT BODY:', body);
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

    let paymentId: number | string | undefined;

    // ======================================================
    //    CASO 1: topic = "payment" (checkout tradicional)
    // ======================================================
    if (topic === 'payment') {
      paymentId = data.data?.id ?? data.id;
    }

    // ======================================================
    //    CASO 2: topic = "merchant_order" (Checkout Pro)
    // ======================================================
    if (topic === 'merchant_order') {
      // Obtener merchant order desde la URL enviada
      if (!data.resource) {
        this.logger.warn('Merchant order sin resource');
        return { received: true };
      }

      const merchantOrder = await fetch(data.resource).then(res => res.json());

      this.logger.log(`Merchant Order: ${JSON.stringify(merchantOrder)}`);

      // Tomar el primer payment asociado
      paymentId = merchantOrder.payments?.[0]?.id;

      if (!paymentId) {
        this.logger.warn('Merchant order sin payment asociado');
        return { received: true };
      }
    }

    // ======================================================
    //    Si no hay paymentId → no procesar
    // ======================================================
    if (!paymentId) {
      this.logger.warn('Webhook sin paymentId');
      return { received: true };
    }

    // ======================================================
    //    OBTENER PAGO DESDE MERCADO PAGO
    // ======================================================
    let result;
    try {
      result = await this.payment.get({ id: paymentId });
    } catch (err) {
      // MP a veces aún no tiene el pago listo → reintento
      await new Promise(res => setTimeout(res, 1200));
      result = await this.payment.get({ id: paymentId });
    }

    this.logger.log(`Pago consultado: ${JSON.stringify(result)}`);

    const bookingId = result.external_reference;
    if (!bookingId) {
      this.logger.warn('Pago sin external_reference, ignorado');
      return { received: true };
    }

    // ======================================================
    //    MAPEAR ESTADO DEL PAGO
    // ======================================================
    const status = (result.status ?? 'UNKNOWN').toUpperCase();

    let paymentStatus: string;
    switch (status) {
      case 'APPROVED':
      case 'AUTHORIZED':
        paymentStatus = 'PAID';
        break;

      case 'PENDING':
      case 'IN_PROCESS':
        paymentStatus = 'PENDING';
        break;

      case 'REJECTED':
      case 'CANCELLED':
      case 'REFUNDED':
      case 'CHARGED_BACK':
        paymentStatus = 'FAILED';
        break;

      default:
        paymentStatus = 'UNPAID';
    }

    // ======================================================
    //    ACTUALIZAR BOOKING
    // ======================================================
    const booking = await this.prisma.bookings.update({
      where: { id: bookingId },
      data: { 
        paymentStatus, 
        paymentId: String(result.id) 
      },
      include: { pin: true },
    });

    // ======================================================
    //    EVITAR DUPLICAR WALLET (idempotencia)
    // ======================================================
    if (paymentStatus === 'PAID') {
      const existing = await this.prisma.walletTransaction.findFirst({
        where: { bookingId: booking.id, type: 'CREDIT' },
      });

      if (!existing) {
        const holdDays = Number(process.env.WALLET_HOLD_DAYS ?? '3');
        const availableAt =
          holdDays > 0 
            ? new Date(Date.now() + holdDays * 86400000)
            : null;

        await this.prisma.walletTransaction.create({
          data: {
            ownerId: booking.pin.ownerId,
            bookingId: booking.id,
            type: 'CREDIT',
            amount: booking.ownerEarning,
            currency: 'MXN', // O booking.currency, pero fijo si es México
            status: holdDays > 0 ? 'PENDING' : 'AVAILABLE',
            availableAt,
          },
        });
      }
    }

    return { received: true };

  } catch (error: any) {
    this.logger.error(`Error al procesar webhook: ${error?.message}`);
    return { received: false, error: error?.message };
  }
}

}
