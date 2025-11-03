import { Module } from '@nestjs/common';
import { RenterController } from './renter.controller';
import { RenterService } from './renter.service';

@Module({
  controllers: [RenterController],
  providers: [RenterService],
})
export class RenterModule {}
