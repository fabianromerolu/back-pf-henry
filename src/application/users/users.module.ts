import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PinModule } from '../pins/pins.module';
import { FilesModule } from '../files/files.module';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [
    MailerModule,
    PinModule,
    FilesModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
