//src/application/payments/payments.module.ts
import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { MercadoPagoConfig, Preference } from 'mercadopago';

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    {
      provide: 'MP_CLIENT',
      useFactory: () => {
        const client = new MercadoPagoConfig({
          accessToken: process.env.MP_ACCESS_TOKEN!,
        });
        return client;
      },
    },
    {
      provide: 'MP_PREFERENCE',
      useFactory: (client: MercadoPagoConfig) => new Preference(client),
      inject: ['MP_CLIENT'],
    },
  ],
  exports: ['MP_PREFERENCE'],
})
export class PaymentsModule {}
