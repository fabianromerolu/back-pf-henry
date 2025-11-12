import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  HttpCode,
  Patch,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { bookingDto, BookingsResponseDto } from './dto/booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserPayloadInterface } from './interfaces/bookingsInterface';
import { BookingsQueryDto } from './dto/booking-query.dto';
import { AppRole } from '@prisma/client';
import { Roles } from '../auth/types/roles.decorator';

@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('bookings') //se colocan los guardianes solo en algunos endpoints, una vez probados los mismos se procedera a los resguardos
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @Roles(AppRole.ADMIN, AppRole.USER)
  @HttpCode(201)
  @ApiOperation({ summary: 'Create new Order' })
  @ApiResponse({
    status: 201,
    description: 'Orden creada exitosamente',
    type: bookingDto,
  })
  async create(
    @Body() createBookingDto: CreateBookingDto,
    //se desactiva momentaneamente el uso del decorador del endpoint
    //@CurrentUser() user: UserPayloadInterface,
  ): Promise<bookingDto> {
    return await this.bookingsService.create(createBookingDto); //(createBookingDto, user.id) modificacion momentanea
  }

  @Get()
  @Roles(AppRole.ADMIN, AppRole.USER)
  @HttpCode(200)
  @ApiOperation({ summary: 'Obtener todas las reservas del usuario' })
  @ApiResponse({
    status: 200,
    description: 'Lista de reservas',
    type: BookingsResponseDto,
  })
  findAll(
    //@CurrentUser() user: UserPayloadInterface,
    @Query() query: BookingsQueryDto,
  ) {
    return this.bookingsService.findAllByUser(query);
  }

  @Get(':id')
  @Roles(AppRole.ADMIN, AppRole.USER)
  @HttpCode(200)
  @ApiOperation({ summary: 'Obtener una reserva específica' })
  @ApiResponse({
    status: 200,
    description: 'Reserva encontrada',
    type: bookingDto,
  })
  async findOne(
    @Param('id') id: string,
    //   @CurrentUser() user: UserPayloadInterface,
  ): Promise<bookingDto> {
    return this.bookingsService.findOne(id);
  }

  // ✅ Mover la lógica de completar/cancelar al service
  @Patch(':id/complete')
  @HttpCode(200)
  @ApiOperation({ summary: 'Completar reserva (owner/admin)' })
  async complete(
    @Param('id') id: string,
    @CurrentUser() user: UserPayloadInterface,
  ) {
    return this.bookingsService.completeBooking(id, user);
  }

  @Patch(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancelar reserva' })
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: UserPayloadInterface,
  ) {
    return this.bookingsService.cancelBooking(id, user);
  }
}
