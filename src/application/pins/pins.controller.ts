// src/application/pins/pins.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  ParseUUIDPipe,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';

import { PinsService } from './pins.service';
import { AnyJwtGuard } from 'src/application/auth/guards/any-jwt.guard';

import { QueryPinsDto } from './dtos/query-pin.dto';
import { CreatePinDto } from './dtos/create-pin.dto';
import { UpdateStatusDto } from './dtos/update-status.dto';
import { UpdatePinDto } from './dtos/update-pin.dto';
import { PinResponseDto } from './dtos/pin-response.dto';

function pickUserId(req: any): string | undefined {
  return req?.user?.sub ?? req?.user?.id ?? req?.user?.userId ?? undefined;
}

@ApiTags('Pins')
@Controller('pins')
export class PinsController {
  constructor(private readonly pins: PinsService) {}

  /* === Public === */

  @Get()
  @ApiOperation({ summary: 'List published pins (paginated + filters)' })
  @ApiOkResponse({ description: 'List', type: PinResponseDto, isArray: true })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  async list(@Query() query: QueryPinsDto) {
    // antes: this.pins.list(query)  -> NO existe
    return this.pins.listPublic(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get pin by id (public)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PinResponseDto })
  @ApiNotFoundResponse({ description: 'Pin not found' })
  async getById(@Param('id', new ParseUUIDPipe()) id: string) {
    // antes: this.pins.getById(id)  -> NO existe
    return this.pins.getByIdPublic(id);
  }

  /* === Auth (RENTER/ADMIN) === */

  @UseGuards(AnyJwtGuard)
  @ApiBearerAuth()
  @Get('mine/list')
  @ApiOperation({ summary: "List my pins (owner's view)" })
  @ApiOkResponse({ description: 'List', type: PinResponseDto, isArray: true })
  async listMine(@Req() req: any, @Query() query: QueryPinsDto) {
    const uid = pickUserId(req);
    if (!uid) throw new ForbiddenException('Not authenticated');
    return this.pins.listMine(uid, query);
  }

  @UseGuards(AnyJwtGuard)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create pin (RENTER/ADMIN)' })
  @ApiCreatedResponse({ description: 'Created', type: PinResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT' })
  @ApiBadRequestResponse({ description: 'Validation error' })
  async create(@Req() req: any, @Body() dto: CreatePinDto) {
    const uid = pickUserId(req);
    if (!uid) throw new ForbiddenException('Not authenticated');
    // antes: this.pins.create(uid, dto) -> NO existe
    return this.pins.createPin(uid, dto);
  }

  @UseGuards(AnyJwtGuard)
  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({ summary: 'Update my pin (owner or admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Updated', type: PinResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT' })
  @ApiForbiddenResponse({ description: 'Not owner or not allowed' })
  async update(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdatePinDto) {
    const uid = pickUserId(req);
    if (!uid) throw new ForbiddenException('Not authenticated');
    // antes: this.pins.update(uid, id, dto) -> NO existe
    return this.pins.updatePin(uid, id, dto);
  }

  @UseGuards(AnyJwtGuard)
  @ApiBearerAuth()
  @Patch(':id/status')
  @ApiOperation({ summary: 'Change status (owner: publish/pause, admin: can block)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Status updated', type: PinResponseDto })
  @ApiForbiddenResponse({ description: 'Not allowed' })
  async setStatus(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: UpdateStatusDto) {
    const uid = pickUserId(req);
    if (!uid) throw new ForbiddenException('Not authenticated');
    // IMPORTANTE: el servicio espera un objeto { status }, no un string suelto
    return this.pins.setStatus(uid, id, body);
  }

  @UseGuards(AnyJwtGuard)
  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: 'Delete pin (owner or admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Deleted' })
  async remove(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    const uid = pickUserId(req);
    if (!uid) throw new ForbiddenException('Not authenticated');
    // antes: this.pins.remove(uid, id) -> NO existe
    await this.pins.deletePin(uid, id);
    return { success: true };
  }
}
