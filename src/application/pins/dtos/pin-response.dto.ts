// src/application/pins/dtos/pin-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';

class PinPhotoDto {
  @ApiProperty() @Expose() url: string;
  @ApiProperty() @Expose() isCover: boolean;
}

class OwnerLiteDto {
  @ApiProperty() @Expose() id: string;
  @ApiProperty() @Expose() username: string;
  @ApiPropertyOptional() @Expose() name?: string | null;
  @ApiProperty({ enum: ['ADMIN', 'RENTER', 'USER'] })
  @Expose() role: 'ADMIN' | 'RENTER' | 'USER';
  @ApiPropertyOptional() @Expose() profilePicture?: string | null;
  @ApiPropertyOptional() @Expose() city?: string | null;
  @ApiPropertyOptional() @Expose() state?: string | null;
  @ApiPropertyOptional() @Expose() country?: string | null;
  @ApiProperty() @Expose() pinsCount: number;
}

export class PinResponseDto {
  @ApiProperty() @Expose() id: string;

  /* Identificación */
  @ApiProperty() @Expose() title: string;
  @ApiProperty() @Expose() make: string;
  @ApiProperty() @Expose() model: string;
  @ApiProperty() @Expose() year: number;
  @ApiPropertyOptional() @Expose() trim?: string | null;

  /* Especificaciones */
  @ApiProperty({ enum: ['SEDAN','HATCHBACK','SUV','PICKUP','VAN','COUPE','CONVERTIBLE'] })
  @Expose() bodyType: string;

  @ApiProperty({ enum: ['ECONOMY','COMPACT','MIDSIZE','SUV','PICKUP','VAN','PREMIUM','ELECTRIC'] })
  @Expose() category: string;

  @ApiProperty({ enum: ['MANUAL','AUTOMATIC'] })
  @Expose() transmission: string;

  @ApiProperty({ enum: ['GASOLINE','DIESEL','HYBRID','ELECTRIC'] })
  @Expose() fuel: string;

  @ApiPropertyOptional({ enum: ['FWD','RWD','AWD','WD4'] })
  @Expose() drivetrain?: string | null;

  @ApiPropertyOptional() @Expose() color?: string | null;

  /* Ubicación */
  @ApiProperty() @Expose() city: string;
  @ApiProperty() @Expose() state: string;
  @ApiProperty() @Expose() country: string;

  @ApiPropertyOptional({ description: 'Latitud (number)' })
  @Expose()
  @Transform(({ value }) => (value != null ? Number(value) : null))
  lat?: number | null;

  @ApiPropertyOptional({ description: 'Longitud (number)' })
  @Expose()
  @Transform(({ value }) => (value != null ? Number(value) : null))
  lng?: number | null;

  /* Precios / políticas (decimals como string) */
  @ApiProperty() @Expose()
  @Transform(({ value }) => value?.toString?.() ?? value)
  pricePerHour: string;

  @ApiProperty() @Expose()
  @Transform(({ value }) => value?.toString?.() ?? value)
  pricePerDay: string;

  @ApiProperty() @Expose()
  @Transform(({ value }) => value?.toString?.() ?? value)
  pricePerWeek: string;

  @ApiProperty() @Expose()
  @Transform(({ value }) => value?.toString?.() ?? value)
  deposit: string;

  @ApiProperty() @Expose() kmIncludedPerDay: number;

  @ApiProperty() @Expose()
  @Transform(({ value }) => value?.toString?.() ?? value)
  pricePerExtraKm: string;

  @ApiProperty() @Expose() minHours: number;
  @ApiProperty() @Expose() minDriverAge: number;
  @ApiProperty() @Expose() insuranceIncluded: boolean;

  @ApiPropertyOptional() @Expose() rules?: string | null;

  /* Descripción / media */
  @ApiPropertyOptional() @Expose() description?: string | null;

  @ApiPropertyOptional({ type: [PinPhotoDto] })
  @Expose() @Type(() => PinPhotoDto)
  photos?: PinPhotoDto[];

  // Campo derivado útil para la UI: URL de portada si existe
  @ApiPropertyOptional()
  @Expose()
  @Transform(({ obj }) => {
    const cover = Array.isArray(obj?.photos) ? obj.photos.find((p: any) => p.isCover) : null;
    return cover?.url ?? null;
  })
  coverPhotoUrl?: string | null;

  /* Estado y métricas */
  @ApiProperty({ enum: ['DRAFT','PUBLISHED','PAUSED','BLOCKED'] })
  @Expose() status: string;

  @ApiProperty() @Expose() viewsCount: number;
  @ApiProperty() @Expose() favoritesCount: number;
  @ApiProperty() @Expose() bookingsCount: number;

  /* Owner */
  @ApiProperty() @Expose() ownerId: string;

  @ApiPropertyOptional({ type: OwnerLiteDto })
  @Expose() @Type(() => OwnerLiteDto)
  owner?: OwnerLiteDto;

  /* Auditoría */
  @ApiProperty({ type: String })
  @Expose()
  @Transform(({ value }) => (value instanceof Date ? value.toISOString() : value))
  createdAt: string;

  @ApiProperty({ type: String })
  @Expose()
  @Transform(({ value }) => (value instanceof Date ? value.toISOString() : value))
  updatedAt: string;
}
