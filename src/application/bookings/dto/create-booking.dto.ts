import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsNotEmpty, IsString } from 'class-validator';

export class CreateBookingDto {
  // @ApiProperty({
  //   description: 'Codigo de identificacion unico de usuario tipo UUID',
  // })
  // @IsString()
  // @IsNotEmpty()
  // userId: string;

  @ApiProperty({
    description: 'Codigo de identificacion unico de vehiculo tipo UUID',
  })
  @IsString()
  @IsNotEmpty()
  pinId: string;

  @ApiProperty({ description: 'Fecha de inicio de alquiler' })
  @IsDate()
  @IsNotEmpty()
  @Type(() => Date)
  start_date: Date;

  @ApiProperty({ description: 'Fecha de fin de alquiler' })
  @IsDate()
  @IsNotEmpty()
  @Type(() => Date)
  end_date: Date;
}
