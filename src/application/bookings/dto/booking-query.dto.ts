import { ApiProperty } from '@nestjs/swagger';
import { BookingsStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsInt,
  Min,
  IsString,
  IsUUID,
  IsEnum,
  IsISO8601,
} from 'class-validator';

export class BookingsQueryDto {
  @ApiProperty({
    required: false,
    description: 'Número de página',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiProperty({
    required: false,
    description: 'Límite de resultados por página',
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 10;

  @ApiProperty({
    required: false,
    description: 'Filtrar por ID de usuario',
    example: 'uuid-usuario',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  userId?: string;

  @ApiProperty({
    required: false,
    description: 'Filtrar por estado de la reserva',
    enum: BookingsStatus,
    example: BookingsStatus.active,
  })
  @IsOptional()
  @IsEnum(BookingsStatus)
  status?: BookingsStatus;

  @ApiProperty({
    required: false,
    description: 'Filtrar por ID del pin',
    example: 'uuid-pin',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  pinId?: string;

  @ApiProperty({
    required: false,
    description: 'Filtrar por estado del pago',
    example: 'PAID',
  })
  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @ApiProperty({
    required: false,
    description: 'Filtrar desde fecha de creación (ISO 8601)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  createdAtFrom?: string;

  @ApiProperty({
    required: false,
    description: 'Filtrar hasta fecha de creación (ISO 8601)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsISO8601()
  createdAtTo?: string;

  @ApiProperty({
    required: false,
    description: 'Filtrar desde fecha de inicio de reserva',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  startDateFrom?: string;

  @ApiProperty({
    required: false,
    description: 'Filtrar hasta fecha de inicio de reserva',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsISO8601()
  startDateTo?: string;
}
