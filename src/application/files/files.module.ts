import { Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { CloudinaryService } from './cloudinary.service';
import { FilesController } from './files.controller';

@Module({
  imports: [], // ⬅️ quitamos AuthModule para romper el ciclo
  controllers: [FilesController],
  providers: [FilesService, CloudinaryService],
  exports: [FilesService, CloudinaryService],
})
export class FilesModule {}
