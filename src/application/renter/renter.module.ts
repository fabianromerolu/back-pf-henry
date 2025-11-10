// src/application/renter/renter.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { RenterController } from './renter.controller';
import { RenterService } from './renter.service';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from 'src/infra/prisma/prisma.module'; 

@Module({
  imports: [
    forwardRef(() => AuthModule),
    PrismaModule,
  ],
  controllers: [RenterController],
  providers: [RenterService],
})
export class RenterModule {}
