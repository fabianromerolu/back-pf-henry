import { ApiProperty } from '@nestjs/swagger';

export class MetricsOverviewDto {
  @ApiProperty() usersTotal: number;
  @ApiProperty() usersActive: number;
  @ApiProperty() usersSuspended: number;

  @ApiProperty() pinsTotal: number;
  @ApiProperty() pinsPublished: number;
  @ApiProperty() pinsBlocked: number;

  @ApiProperty() bookingsTotal: number;
  @ApiProperty() bookingsActive: number;
  @ApiProperty() bookingsComplete: number;

  @ApiProperty({ description: 'Suma en COP como string' }) revenueTotal: string;
  @ApiProperty({ description: 'Últimos 30 días en COP como string' }) revenueLast30d: string;

  @ApiProperty({ type: [String], description: 'Top ciudades por cantidad de vehículos' })
  topCities: string[];
}
