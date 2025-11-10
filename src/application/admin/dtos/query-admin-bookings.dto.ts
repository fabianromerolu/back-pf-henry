import { ApiPropertyOptional } from '@nestjs/swagger';
import { BookingsStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class QueryAdminBookingsDto {
  @ApiPropertyOptional({ enum: BookingsStatus }) @IsOptional() @IsEnum(BookingsStatus) status?: BookingsStatus;
  @ApiPropertyOptional({ description: 'Filter by renter userId (who booked)' }) @IsOptional() @IsUUID() userId?: string;
  @ApiPropertyOptional({ description: 'Filter by vehicle ownerId' }) @IsOptional() @IsUUID() ownerId?: string;

  @ApiPropertyOptional({ description: 'ISO date' }) @IsOptional() @IsString() from?: string;
  @ApiPropertyOptional({ description: 'ISO date' }) @IsOptional() @IsString() to?: string;

  @ApiPropertyOptional({ example: 1 }) @IsOptional() @IsInt() @Min(1) page?: number = 1;
  @ApiPropertyOptional({ example: 20 }) @IsOptional() @IsInt() @Min(1) @Max(100) limit?: number = 20;
}
