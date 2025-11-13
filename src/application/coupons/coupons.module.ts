import { Module } from '@nestjs/common'; 

import { PrismaService } from 'src/infra/prisma/prisma.service'; 

 

// 🚀 NUEVO: importar controller y service de cupones 

 

import { CouponsController } from './counpons.controller'; 

import { CouponsService } from './coupons.service'; 

import { MailerModule } from '../mailer/mailer.module'; 

 

@Module({ 

 

 imports: [MailerModule], 

  controllers: [ 

    CouponsController, // 🚀 NUEVO: expone los endpoints de cupones 

  ], 

  providers: [ 

    CouponsService,    // 🚀 NUEVO: lógica de negocio de cupones 

    PrismaService,     // necesario para interactuar con la BD 

  ], 

  exports: [ 

    CouponsService,    // 🚀 NUEVO: exportar para que otros módulos (Auth, Bookings) lo usen 

  ], 

}) 

export class CouponsModule {} 

 

 

 