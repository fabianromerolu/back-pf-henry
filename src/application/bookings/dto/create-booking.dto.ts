import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsNotEmpty, IsString } from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({
    description: 'Codigo de identificacion unico de usuario tipo UUID',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Codigo de identificacion unico de vehiculo tipo UUID',
  })
  @IsString()
  @IsNotEmpty()
  pinId: string;

  @ApiProperty({ description: 'Fecha de inicio de alquiler' })
  @IsDate()
  @IsNotEmpty()
  start_date: Date;

  @ApiProperty({ description: 'Fecha de fin de alquiler' })
  @IsDate()
  @IsNotEmpty()
  end_date: Date;
}
