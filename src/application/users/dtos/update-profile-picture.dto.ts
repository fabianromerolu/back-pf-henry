import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateProfilePictureDto {
  @ApiProperty({
    example: 'users/123/avatars/abc123',
    description:
      'Identificador público en Cloudinary (`public_id`) de la imagen de perfil que ya fue subida.',
  })
  @IsString()
  @IsNotEmpty()
  publicId: string;
}
