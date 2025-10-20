import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
import { BodyType, Drivetrain, FuelType, Transmission, VehicleCategory } from '@prisma/client';


class PhotoInputDto {
  @ApiProperty({ example: 'https://res.cloudinary.com/.../img.jpg' })
  @IsString()
  url: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isCover?: boolean;
}

export class CreatePinDto {
  /* Identificación */
  @ApiProperty({ example: 'Toyota Corolla 2019' })
  @IsString() @Length(2, 120)
  title: string;

  @ApiProperty({ example: 'Toyota' })
  @IsString() @Length(1, 60)
  make: string;

  @ApiProperty({ example: 'Corolla' })
  @IsString() @Length(1, 60)
  model: string;

  @ApiProperty({ example: 2019 })
  @IsInt() @Min(1990) @Max(new Date().getFullYear() + 1)
  year: number;

  @ApiPropertyOptional({ example: 'LE' })
  @IsString() @IsOptional()
  trim?: string;

  @ApiProperty({ enum: BodyType })
  @IsEnum(BodyType)
  bodyType: BodyType;

  @ApiProperty({ enum: VehicleCategory })
  @IsEnum(VehicleCategory)
  category: VehicleCategory;

  @ApiProperty({ enum: Transmission })
  @IsEnum(Transmission)
  transmission: Transmission;

  @ApiProperty({ enum: FuelType })
  @IsEnum(FuelType)
  fuel: FuelType;

  @ApiPropertyOptional({ enum: Drivetrain })
  @IsEnum(Drivetrain) @IsOptional()
  drivetrain?: Drivetrain;

  @ApiPropertyOptional({ example: 'Blanco' })
  @IsString() @IsOptional()
  color?: string;

  @ApiProperty({ example: 5 })
  @IsInt() @Min(1) @Max(9)
  seats: number;

  @ApiProperty({ example: 4 })
  @IsInt() @Min(2) @Max(6)
  doors: number;

  /* Ubicación */
  @ApiProperty({ example: 'Montería' })
  @IsString() @Length(1, 80)
  city: string;

  @ApiProperty({ example: 'Córdoba' })
  @IsString() @Length(1, 80)
  state: string;

  @ApiProperty({ example: 'Colombia' })
  @IsString() @Length(1, 80)
  country: string;

  @ApiPropertyOptional({ example: 8.748 })
  @IsNumber() @IsOptional()
  lat?: number;

  @ApiPropertyOptional({ example: -75.881 })
  @IsNumber() @IsOptional()
  lng?: number;

  /* Precios y políticas */
  @ApiProperty({ example: 20.0 })
  @IsNumber() @Min(0)
  pricePerHour: number;

  @ApiProperty({ example: 100.0 })
  @IsNumber() @Min(0)
  pricePerDay: number;

  @ApiProperty({ example: 600.0 })
  @IsNumber() @Min(0)
  pricePerWeek: number;

  @ApiProperty({ example: 200.0 })
  @IsNumber() @Min(0)
  deposit: number;

  @ApiProperty({ example: 150 })
  @IsInt() @Min(0)
  kmIncludedPerDay: number;

  @ApiProperty({ example: 0.25 })
  @IsNumber() @Min(0)
  pricePerExtraKm: number;

  @ApiProperty({ example: 2 })
  @IsInt() @Min(1)
  minHours: number;

  @ApiProperty({ example: 21 })
  @IsInt() @Min(18)
  minDriverAge: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  insuranceIncluded: boolean;

  @ApiPropertyOptional({ example: 'No fumar. No mascotas.' })
  @IsString() @IsOptional()
  rules?: string;

  /* Descripción / fotos */
  @ApiPropertyOptional({ example: 'Auto cómodo, bajo consumo, ideal ciudad.' })
  @IsString() @IsOptional()
  description?: string;

  @ApiPropertyOptional({ type: [PhotoInputDto] })
  @IsOptional()
  photos?: PhotoInputDto[];
}
