import {
  BadRequestException, // 👈 importa esto
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { StandardUserService } from './standard-user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserPayloadInterface } from '../bookings/interfaces/bookingsInterface';
import { BookingsStatus } from '@prisma/client';

@ApiTags('StandardUser')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('standard-user')
export class StandardUserController {
  constructor(private readonly svc: StandardUserService) {}

  // helper para no repetir la jugada en cada endpoint
  private getUserId(u: UserPayloadInterface): string {
    const id =
      (u as any).id ??
      (u as any).userId ??
      (u as any).sub;

    if (!id) {
      throw new BadRequestException('userId requerido');
    }
    return id;
  }

  // Normaliza status (string) -> enum BookingsStatus
  private parseStatus(s?: string): BookingsStatus | undefined {
    if (!s) return undefined;
    const v = s.toString().toLowerCase();
    const allowed: BookingsStatus[] = [
      BookingsStatus.active,
      BookingsStatus.suspended,
      BookingsStatus.complete,
    ];
    return allowed.includes(v as BookingsStatus)
      ? (v as BookingsStatus)
      : undefined;
  }

  /* ========== OVERVIEW DASHBOARD USER ========== */

  @Get('dashboard/overview')
  @ApiOperation({ summary: 'Resumen para dashboard del USER (cliente)' })
  async overview(@CurrentUser() u: UserPayloadInterface) {
    const userId = this.getUserId(u);
    return this.svc.overview(userId);
  }

  /* ========== MIS RESERVAS (LISTADO) ========== */

  @Get('bookings')
  @ApiOperation({ summary: 'Listado de mis reservas (USER)' })
  @ApiQuery({ name: 'status', required: false, example: 'active' })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date desde (startDate)' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date hasta (startDate)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  async myBookings(
    @CurrentUser() u: UserPayloadInterface,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string | number,
    @Query('limit') limit?: string | number,
  ) {
    const userId = this.getUserId(u);
    return this.svc.listMyBookings(userId, {
      status: this.parseStatus(status),
      from,
      to,
      page: Number(page ?? 1),
      limit: Number(limit ?? 20),
    });
  }

  /* ========== DETALLE DE UNA RESERVA MÍA ========== */

  @Get('bookings/:id')
  @ApiOperation({ summary: 'Detalle de una reserva mía' })
  @ApiParam({ name: 'id', description: 'Booking id (uuid)' })
  async myBookingDetail(
    @CurrentUser() u: UserPayloadInterface,
    @Param('id') id: string,
  ) {
    const userId = this.getUserId(u);
    return this.svc.getMyBooking(userId, id);
  }

  /* ========== CANCELAR UNA RESERVA MÍA ========== */

  @Patch('bookings/:id/cancel')
  @ApiOperation({ summary: 'Cancelar una de mis reservas' })
  @ApiParam({ name: 'id', description: 'Booking id (uuid)' })
  async cancelMyBooking(
    @CurrentUser() u: UserPayloadInterface,
    @Param('id') id: string,
  ) {
    const userId = this.getUserId(u);
    return this.svc.cancelMyBooking(userId, id);
  }
}
