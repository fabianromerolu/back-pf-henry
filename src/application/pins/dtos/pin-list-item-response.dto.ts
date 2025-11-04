import { ApiProperty } from '@nestjs/swagger';
import { FuelType, Transmission } from '@prisma/client';

export class PinListItemResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: '50.00' })
  pricePerDay!: string;

  @ApiProperty({ enum: FuelType })
  fuel!: FuelType;

  @ApiProperty({ example: 5 })
  seats!: number;

  @ApiProperty({ enum: Transmission })
  transmission!: Transmission;

  @ApiProperty({
    example: 'Vehículo en excelente estado...',
    nullable: true,
    maxLength: 100,
  })
  description?: string | null;

  @ApiProperty({
    example: 'https://cdn.com/corolla.jpg',
    nullable: true,
  })
  thumbnailUrl!: string | null;
}
