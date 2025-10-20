import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { FilesService } from './files.service';
import { AuthGuard } from '@nestjs/passport'; 

function sanitizeFolder(input: string) {
  return (input || '').replace(/(^\/+|\/+$)/g, '').replace(/\.\./g, '');
}

@ApiTags('Files')
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @UseGuards(AuthGuard(['local-jwt', 'jwt'])) 
  @ApiBearerAuth()
  @Get('signature')
  @ApiOperation({
    summary: 'Generate upload signature',
    description:
      'Devuelve parámetros firmados (signature, timestamp, apiKey, cloudName, folder) para subir directamente a Cloudinary.',
  })
  @ApiQuery({
    name: 'folder',
    required: false,
    description: 'Carpeta destino (namespace). Si se omite, se usará "pins/<userId>".',
    example: 'user-avatars',
  })
  @ApiOkResponse({ description: 'Signed params generated successfully.' })
  @ApiBadRequestResponse({ description: 'Bad input folder.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected error.' })
  async getUploadSignature(@Req() req: any, @Query('folder') folder?: string) {
    const userId = req?.user?.sub ?? req?.user?.id;
    const effectiveFolder = sanitizeFolder(folder || `pins/${userId}`);
    return this.filesService.getUploadSignature(effectiveFolder);
  }
}
