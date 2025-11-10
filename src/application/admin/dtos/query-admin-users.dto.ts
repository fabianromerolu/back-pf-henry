import { ApiPropertyOptional } from '@nestjs/swagger';
import { AppRole, UserStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryAdminUsersDto {
  @ApiPropertyOptional() @IsOptional() @IsString() q?: string;
  @ApiPropertyOptional({ enum: AppRole }) @IsOptional() @IsEnum(AppRole) role?: AppRole;
  @ApiPropertyOptional({ enum: UserStatus }) @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;

  @ApiPropertyOptional({ example: 1 }) @IsOptional() @IsInt() @Min(1) page?: number = 1;
  @ApiPropertyOptional({ example: 20 }) @IsOptional() @IsInt() @Min(1) @Max(100) limit?: number = 20;
}
