import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { VehicleCategory, VehicleStatus } from '@prisma/client';


export class QueryPinsDto {
  @ApiPropertyOptional({ example: 1 }) @IsInt() @Min(1) @IsOptional() page?: number;
  @ApiPropertyOptional({ example: 20 }) @IsInt() @Min(1) @Max(50) @IsOptional() limit?: number;

  @ApiPropertyOptional({ example: 'Montería' }) @IsString() @IsOptional() city?: string;
  @ApiPropertyOptional({ enum: VehicleCategory }) @IsEnum(VehicleCategory) @IsOptional() category?: VehicleCategory;
  @ApiPropertyOptional({ enum: VehicleStatus }) @IsEnum(VehicleStatus) @IsOptional() status?: VehicleStatus;

  @ApiPropertyOptional({ example: 'corolla' }) @IsString() @IsOptional() q?: string;

  @ApiPropertyOptional({ example: 10 }) @IsNumber() @IsOptional() priceMin?: number;
  @ApiPropertyOptional({ example: 200 }) @IsNumber() @IsOptional() priceMax?: number;

  @ApiPropertyOptional({ example: 2015 }) @IsInt() @IsOptional() yearMin?: number;
  @ApiPropertyOptional({ example: 2024 }) @IsInt() @IsOptional() yearMax?: number;

  @ApiPropertyOptional({ format: 'uuid' }) @IsUUID(4) @IsOptional() ownerId?: string;
}
