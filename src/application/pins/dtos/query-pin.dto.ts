import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { VehicleCategory, VehicleStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class QueryPinsDto {
  @ApiProperty({ example: 1, description: 'Page number (pagination)' })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiProperty({ example: 12, description: 'Items per page (pagination)' })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 12;

  @ApiPropertyOptional({ description: 'Filter by city' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    enum: VehicleCategory,
    description: 'Filter by vehicle category',
  })
  @IsOptional()
  @IsEnum(VehicleCategory)
  category?: VehicleCategory;

  @ApiPropertyOptional({ enum: VehicleStatus, description: 'Filter by status' })
  @IsOptional()
  @IsEnum(VehicleStatus)
  status?: VehicleStatus;

  @ApiPropertyOptional({ description: 'Search keyword (title, model...)' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Minimum rental price per day' })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  priceMin?: number;

  @ApiPropertyOptional({ description: 'Maximum rental price per day' })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  priceMax?: number;

  @ApiPropertyOptional({ description: 'Minimum manufacturing year' })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  yearMin?: number;

  @ApiPropertyOptional({ description: 'Maximum manufacturing year' })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  yearMax?: number;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by owner' })
  @IsOptional()
  @IsUUID(4)
  ownerId?: string;
}
