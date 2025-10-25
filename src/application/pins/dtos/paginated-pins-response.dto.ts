import { ApiProperty } from '@nestjs/swagger';
import { PinListItemResponseDto } from './pin-list-item-response.dto';

export class PaginatedPinsResponseDto {
  @ApiProperty({ type: () => [PinListItemResponseDto] })
  data: PinListItemResponseDto[];

  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() total: number;
  @ApiProperty() hasNextPage: boolean;
}
