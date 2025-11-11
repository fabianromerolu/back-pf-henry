import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from 'src/application/auth/guards/jwt-auth.guard';
import { Request } from 'express';

interface AuthRequest extends Request {
  user: {
    sub: string;
    email: string;
    role: string;
  };
}

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Crear una reseña a partir de una reserva (booking)',
  })
  async create(@Req() req: AuthRequest, @Body() dto: CreateReviewDto) {
    const userId = req.user.sub; // JWT payload (sub = userId)
    return this.reviewsService.createFromBooking(userId, dto);
  }

  @Get('pin/:pinId')
  @ApiOperation({
    summary:
      'Obtener reseñas simplificadas de un vehículo (formato para el frontend)',
  })
  @ApiParam({ name: 'pinId', description: 'ID del vehículo', format: 'uuid' })
  async getByPin(@Param('pinId', new ParseUUIDPipe()) pinId: string) {
    return this.reviewsService.getByPin(pinId);
  }

  @Get('pin/:pinId/summary')
  @ApiOperation({
    summary: 'Obtener promedio de calificaciones y cantidad total de reseñas',
  })
  @ApiParam({ name: 'pinId', description: 'ID del vehículo', format: 'uuid' })
  async getPinSummary(@Param('pinId', new ParseUUIDPipe()) pinId: string) {
    return this.reviewsService.getPinSummary(pinId);
  }
}
