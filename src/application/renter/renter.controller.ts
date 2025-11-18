// src/application/renter/renter.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RenterService } from './renter.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserPayloadInterface } from '../bookings/interfaces/bookingsInterface';
import { BookingsStatus } from '@prisma/client';

@ApiTags('Renter')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('renter')
export class RenterController {
  constructor(private readonly svc: RenterService) {}

  // ========= helper para extraer el userId de req.user =========
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

  // Normaliza el status recibido desde el front (minúsculas) a tu enum de Prisma
  private parseStatus(s?: string): BookingsStatus | undefined {
    if (!s) return undefined;
    const v = s.toString().toLowerCase();
    const allowed = new Set(['active', 'suspended', 'complete']);
    return allowed.has(v) ? (v as BookingsStatus) : undefined;
  }

  @Get('bookings')
  @ApiOperation({ summary: 'Reservas de mis vehículos' })
  async bookings(
    @CurrentUser() u: UserPayloadInterface,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string | number,
    @Query('limit') limit?: string | number,
  ) {
    const userId = this.getUserId(u);

    return this.svc.listOwnerBookings(userId, {
      status: this.parseStatus(status),
      from,
      to,
      page: Number(page ?? 1),
      limit: Number(limit ?? 20),
    });
  }

  @Get('dashboard/overview')
  @ApiOperation({ summary: 'Resumen para dashboard del RENTER' })
  async overview(@CurrentUser() u: UserPayloadInterface) {
    const userId = this.getUserId(u);
    return this.svc.overview(userId);
  }

  @Get('balance')
  @ApiOperation({ summary: 'Saldo del propietario' })
  async balance(@CurrentUser() u: UserPayloadInterface) {
    const userId = this.getUserId(u);
    return this.svc.balance(userId);
  }

  @Get('payments')
  @ApiOperation({ summary: 'Historial de créditos/débitos (wallet)' })
  async payments(
    @CurrentUser() u: UserPayloadInterface,
    @Query('page') page?: string | number,
    @Query('limit') limit?: string | number,
  ) {
    const userId = this.getUserId(u);
    return this.svc.listPayments(userId, Number(page ?? 1), Number(limit ?? 20));
  }

  @Post('payouts')
  @ApiOperation({ summary: 'Solicitar retiro' })
  async createPayout(
    @CurrentUser() u: UserPayloadInterface,
    @Body() body: { amount: number },
  ) {
    const userId = this.getUserId(u);
    return this.svc.createPayout(userId, Number(body?.amount ?? 0));
  }

  @Get('payouts')
  @ApiOperation({ summary: 'Historial de retiros' })
  async listPayouts(
    @CurrentUser() u: UserPayloadInterface,
    @Query('page') page?: string | number,
    @Query('limit') limit?: string | number,
  ) {
    const userId = this.getUserId(u);
    return this.svc.listPayouts(userId, Number(page ?? 1), Number(limit ?? 20));
  }
}
