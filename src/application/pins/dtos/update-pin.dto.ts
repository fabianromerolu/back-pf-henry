/* eslint-disable prettier/prettier */
// src/application/pins/dtos/update-pin.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, Length } from 'class-validator';
import { CreatePinDto } from './create-pin.dto';

class PhotoUpdateDto {
  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/.../img.jpg' })
  @IsString()
  url: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isCover?: boolean;
}

export class UpdatePinDto extends PartialType(CreatePinDto) {
  @ApiPropertyOptional({ type: [PhotoUpdateDto] })
  @IsArray()
  @IsOptional()
  photos?: PhotoUpdateDto[];

  @ApiPropertyOptional({ example: 'Toyota Corolla 2020' })
  @IsString()
  @Length(1, 120)
  @IsOptional()
  title?: string;
}
