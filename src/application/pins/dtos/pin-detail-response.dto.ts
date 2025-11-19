import { ApiProperty } from '@nestjs/swagger';
import {
  BodyType,
  FuelType,
  Transmission,
  VehicleCategory,
  VehicleStatus,
} from '@prisma/client';

export class PinDetailResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  make: string;

  @ApiProperty()
  model: string;

  @ApiProperty({ enum: BodyType })
  bodyType: BodyType;

  @ApiProperty({ enum: VehicleCategory })
  category: VehicleCategory;

  @ApiProperty({ enum: Transmission })
  transmission: Transmission;

  @ApiProperty({ enum: FuelType })
  fuel: FuelType;

  @ApiProperty()
  seats: number;

  @ApiProperty()
  pricePerDay: string;

  @ApiProperty()
  city: string;

  @ApiProperty()
  state: string;

  @ApiProperty()
  country: string;

  @ApiProperty()
  averageRating: number;

  @ApiProperty({ nullable: true })
  rules: string | null;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty({ enum: VehicleStatus })
  status: VehicleStatus;

  @ApiProperty({ type: [String] })
  photos: { url: string }[];

  @ApiProperty({ nullable: true })
  thumbnailUrl: string | null;
}
