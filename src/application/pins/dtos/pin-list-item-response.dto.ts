import { ApiProperty } from '@nestjs/swagger';

export class PinListItemResponseDto {
  @ApiProperty() id: string;

  @ApiProperty({ example: 'Toyota Corolla 2020' })
  title: string;

  @ApiProperty({ example: '70.00' })
  pricePerDay: string;

  @ApiProperty()
  thumbnailUrl: string | null;

  @ApiProperty()
  city: string;

  @ApiProperty()
  country: string;
}
