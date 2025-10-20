import { Injectable } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';

@Injectable()
export class FilesService {
  constructor(private readonly cloudinary: CloudinaryService) {}

  async getUploadSignature(folder: string) {
    return this.cloudinary.generateUploadSignature(folder);
  }
}
