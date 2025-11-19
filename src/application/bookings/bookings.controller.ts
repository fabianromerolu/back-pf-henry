import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { bookingDto, BookingsResponseDto } from './dto/booking.dto';
//import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserPayloadInterface } from './interfaces/bookingsInterface';
import { BookingsQueryDto } from './dto/booking-query.dto';
import { AppRole } from '@prisma/client';
import { Roles } from '../auth/types/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('bookings') //se colocan los guardianes solo en algunos endpoints, una vez probados los mismos se procedera a los resguardos
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @HttpCode(201)
  @RolesGuard(AppRole.USER)
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
  @HttpCode(200)
  @Roles(AppRole.USER)
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
  // @UseGuards(JwtAuthGuard)
  // @ApiBearerAuth()
  @Patch(':id/complete')
  @HttpCode(200)
  @ApiOperation({ summary: 'Completar reserva (owner/admin)' })
  async complete(
    @Param('id') id: string,
    @CurrentUser() user: UserPayloadInterface,
  ) {
    return this.bookingsService.completeBooking(id, user);
  }

  // @UseGuards(JwtAuthGuard)
  // @ApiBearerAuth()
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
