import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class MetricsSeriesQueryDto {
  @ApiPropertyOptional({ description: 'YYYY-MM-DD' })
  @IsOptional() @IsString() from?: string;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD' })
  @IsOptional() @IsString() to?: string;

  @ApiPropertyOptional({ enum: ['day', 'month'], default: 'day' })
  @IsOptional() @IsIn(['day', 'month'])
  granularity?: 'day' | 'month' = 'day';
}

export type SeriesPoint = { date: string; bookings: number; revenue: number };
