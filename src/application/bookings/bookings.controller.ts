import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';

import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { bookingDto } from './dto/booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserPayloadInterface } from './interfaces/bookingsInterface';

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

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: UserPayloadInterface,
  ): Promise<bookingDto> {
    return await this.bookingsService.findOne(id, user.id);
  }
}
