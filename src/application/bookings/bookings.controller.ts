import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  HttpCode,
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

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create new Order' })
  @ApiResponse({
    status: 201,
    description: 'Orden creada exitosamente',
    type: bookingDto,
  })
  // @ApiResponse({ status: 400, description: 'Datos inválidos' })
  // @ApiResponse({ status: 401, description: 'No autorizado' })
  // @ApiResponse({ status: 404, description: 'Usuario o vehículo no encontrado' })
  async create(
    @Body() createBookingDto: CreateBookingDto,
    @CurrentUser() user: UserPayloadInterface,
  ): Promise<bookingDto> {
    return await this.bookingsService.create(createBookingDto, user.id);
  }

  @Get()
  @HttpCode(200)
  @ApiOperation({ summary: 'Obtener todas las reservas del usuario' })
  @ApiResponse({
    status: 200,
    description: 'Lista de reservas',
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
  @HttpCode(200)
  @ApiOperation({ summary: 'Obtener una reserva específica' })
  @ApiResponse({
    status: 200,
    description: 'Reserva encontrada',
    type: bookingDto,
  })
  // @ApiResponse({ status: 401, description: 'No autorizado' })
  // @ApiResponse({ status: 404, description: 'Reserva no encontrada' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: UserPayloadInterface,
  ): Promise<bookingDto> {
    const booking = await this.bookingsService.findOne(id, user.id);

    return booking;
  }
}
