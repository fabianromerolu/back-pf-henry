import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsPhoneNumber, IsString, MaxLength, IsDateString } from 'class-validator';
import { Sex } from '@prisma/client';


export class UpdateProfileDto {
  @ApiPropertyOptional({ maxLength: 50 })
  @IsString() @IsOptional() @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @IsString() @IsOptional() @MaxLength(50)
  username?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional() @MaxLength(80)
  city?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional() @MaxLength(80)
  state?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional() @MaxLength(80)
  country?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional() @MaxLength(120)
  address?: string;

  @ApiPropertyOptional({ enum: Sex })
  @IsEnum(Sex) @IsOptional()
  sex?: Sex;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD' })
  @IsDateString() @IsOptional()
  birthDate?: string;

  @ApiPropertyOptional({ maxLength: 150 })
  @IsString() @IsOptional() @MaxLength(150)
  biography?: string;

  @ApiPropertyOptional({ description: 'E.164 si aplica' })
  @IsOptional()
  @IsString()
  phone?: string; // o @IsPhoneNumber() si quieres validación estricta
}
