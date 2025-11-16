import { Module } from '@nestjs/common';
import { StandardUserController } from './standard-user.controller';
import { StandardUserService } from './standard-user.service';
import { PrismaModule } from 'src/infra/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
  ],
  controllers: [StandardUserController],
  providers: [StandardUserService],
  exports: [StandardUserService],
})
export class StandardUserModule {}
