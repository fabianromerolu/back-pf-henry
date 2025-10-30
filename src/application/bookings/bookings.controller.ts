import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';

import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { bookingDto, BookingsResponseDto } from './dto/booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserPayloadInterface } from './interfaces/bookingsInterface';
import { BookingQueryDto } from './dto/booking-query.dto';

@Controller('bookings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @ApiOperation({ summary: 'Create new Order' })
  @Post()
  async create(
    @Body() createBookingDto: CreateBookingDto,
    @CurrentUser() user: UserPayloadInterface,
  ): Promise<bookingDto> {
    return await this.bookingsService.create(createBookingDto, user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener todas las reservas del usuario',
    description:
      'Retorna una lista paginada de las reservas del usuario autenticado',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de reservas obtenida exitosamente',
    type: BookingsResponseDto,
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  findAll(
    @CurrentUser() user: UserPayloadInterface,
    @Query() query: BookingQueryDto,
  ) {
    return this.bookingsService.findAllByUser(user.id, query.page, query.limit);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: UserPayloadInterface,
  ): Promise<bookingDto> {
    return await this.bookingsService.findOne(id, user.id);
  }
}
