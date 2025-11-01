// src/application/coupons/coupons.module.ts
import { Module } from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { CouponsController } from './coupons.controller';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [
    PrismaModule,   // acceso a la base de datos
    MailerModule,   // para enviar emails de cupones
  ],
  controllers: [CouponsController],
  providers: [CouponsService],
  exports: [CouponsService], // opcional, si otros módulos necesitan usarlo
})
export class CouponsModule {}