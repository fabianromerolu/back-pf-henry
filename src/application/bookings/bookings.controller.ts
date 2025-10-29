import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';

import { ApiOperation } from '@nestjs/swagger';

@Controller('bookings')
// @UseGuards(JwtAuthGuard)
// @ApiBearerAuth()
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @ApiOperation({ summary: 'Create new Order' })
  @Post()
  create(@Body() createBookingDto: CreateBookingDto) {
    return this.bookingsService.create(createBookingDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bookingsService.findOne(+id);
  }
}
