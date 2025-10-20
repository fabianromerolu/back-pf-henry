import { IsEmail, IsString, IsOptional, MinLength, MaxLength, Matches, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppRole } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'John Doe' }) @IsString() name: string;
  @ApiProperty({ example: 'johndoe' }) @IsString() username: string;
  @ApiProperty({ example: 'john@insspira.com' }) @IsEmail() email: string;

  @ApiPropertyOptional({ example: '+573001112233' })
  @IsString() @IsOptional() phone?: string;

  // usar SIEMPRE el enum de la entidad
  @ApiPropertyOptional({ enum: AppRole, example: AppRole.USER })
  @IsEnum(AppRole) @IsOptional() role?: AppRole;

  @ApiPropertyOptional({ minLength: 8 })
  @IsString() @IsOptional()
  @MinLength(8) @MaxLength(100)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).+$/)
  password?: string;

  @ApiPropertyOptional({ minLength: 8 })
  @IsString() @IsOptional()
  @MinLength(8) @MaxLength(100)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).+$/)
  confirmPassword?: string;
}
