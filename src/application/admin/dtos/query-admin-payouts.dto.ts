import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class QueryAdminPayoutsDto {
  @ApiPropertyOptional({ description: 'OwnerId' })
  @IsOptional() @IsUUID() ownerId?: string;

  @ApiPropertyOptional({ description: 'REQUESTED | PROCESSING | PAID | REJECTED' })
  @IsOptional() @IsString() status?: string;

  @ApiPropertyOptional({ example: 1 }) @IsOptional() @IsInt() @Min(1) page?: number = 1;
  @ApiPropertyOptional({ example: 20 }) @IsOptional() @IsInt() @Min(1) @Max(100) limit?: number = 20;
}
