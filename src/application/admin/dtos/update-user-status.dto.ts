import { ApiProperty } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export class UpdateUserStatusDto {
  @ApiProperty({ enum: UserStatus })
  @IsEnum(UserStatus)
  status: UserStatus;

  @ApiProperty({ required: false, description: 'Si SUSPENDES, bloquear también sus vehículos' })
  @IsOptional()
  @IsBoolean()
  blockPins?: boolean = true;
}
