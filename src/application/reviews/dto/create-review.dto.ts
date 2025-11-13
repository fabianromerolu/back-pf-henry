import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({ example: 5, description: 'Puntuación de 1 a 5' })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({
    example:
      'Excelente experiencia, el auto estaba limpio y el dueño fue puntual',
    required: false,
  })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({
    description: 'ID de la reserva asociada',
    example: 'uuid-booking',
  })
  @IsUUID()
  bookingId: string;
}
