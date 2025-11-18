//src/application/admin/admin.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
  ParseUUIDPipe,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AnyJwtGuard } from '../auth/guards/any-jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/types/roles.decorator';
import { AppRole } from '@prisma/client';
import { AdminService } from './admin.service';
import { QueryAdminUsersDto } from './dtos/query-admin-users.dto';
import { UpdateUserStatusDto } from './dtos/update-user-status.dto';
import { QueryAdminBookingsDto } from './dtos/query-admin-bookings.dto';
import { QueryAdminWalletDto } from './dtos/query-admin-wallet.dto';
import { QueryAdminPayoutsDto } from './dtos/query-admin-payouts.dto';
import { MetricsOverviewDto } from './dtos/metrics-overview.dto';
import { MetricsSeriesQueryDto } from './dtos/metrics-series.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(AnyJwtGuard, RolesGuard)
@Roles(AppRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  /* ===== USERS ===== */

  /* ===== USERS ===== */

  @Get('users')
  @ApiOperation({ summary: 'Listar usuarios (admin)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  async listUsers(
    @Query() q: QueryAdminUsersDto,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.admin.listUsers({
      q: q.q,
      role: q.role,
      status: q.status,
      city: q.city,
      page,
      limit,
    });
  }


  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Cambiar estado del usuario (ACTIVE | SUSPENDED)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async setUserStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.admin.setUserStatus(id, dto.status, dto.blockPins);
  }

  /* ===== BOOKINGS / ORDERS ===== */

  @Get('bookings')
  @ApiOperation({ summary: 'Listar reservas (orders) con filtros' })
  async listBookings(@Query() q: QueryAdminBookingsDto) {
    return this.admin.listBookings({
      status: q.status,
      userId: q.userId,
      ownerId: q.ownerId,
      from: q.from,
      to: q.to,
      page: q.page,
      limit: q.limit,
    });
  }

  /* ===== PAYMENTS ===== */

  @Get('payments/transactions')
  @ApiOperation({ summary: 'Historial de wallet (créditos/débitos)' })
  async listWallet(@Query() q: QueryAdminWalletDto) {
    return this.admin.listWalletTransactions({
      ownerId: q.ownerId,
      type: q.type,
      status: q.status,
      page: q.page,
      limit: q.limit,
    });
  }

  @Get('payments/payouts')
  @ApiOperation({ summary: 'Historial de retiros (payouts)' })
  async listPayouts(@Query() q: QueryAdminPayoutsDto) {
    return this.admin.listPayouts({
      ownerId: q.ownerId,
      status: q.status,
      page: q.page,
      limit: q.limit,
    });
  }

  /* ===== METRICS ===== */

  @Get('metrics/overview')
  @ApiOperation({ summary: 'Métricas globales para dashboard admin' })
  @ApiOkResponse({ type: MetricsOverviewDto })
  async overview(): Promise<MetricsOverviewDto> {
    return this.admin.overview();
  }

  @Get('metrics/series')
  @ApiOperation({ summary: 'Series (bookings y revenue) por día/mes' })
  @ApiQuery({ name: 'from', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'granularity', required: false, enum: ['day', 'month'] })
  async series(@Query() q: MetricsSeriesQueryDto) {
    return this.admin.series(q.from, q.to, q.granularity ?? 'day');
  }
}
