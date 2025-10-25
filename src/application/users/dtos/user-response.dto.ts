import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';
import { AppRole, Sex, UserStatus } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty() @Expose() id: string;

  @ApiProperty() @Expose() email: string;

  @ApiProperty({ required: false }) @Expose() name?: string | null;
  @ApiProperty({ required: false }) @Expose() username?: string | null;

  @ApiProperty({ enum: AppRole }) @Expose() role: AppRole;
  @ApiProperty({ enum: UserStatus }) @Expose() status: UserStatus;

  @ApiProperty({ enum: Sex }) @Expose() sex: Sex;
  @ApiProperty({ required: false }) @Expose() city?: string | null;
  @ApiProperty({ required: false }) @Expose() state?: string | null;
  @ApiProperty({ required: false }) @Expose() country?: string | null;

  @ApiProperty({ required: false }) @Expose() profilePicture?: string | null;
  @ApiProperty({ required: false, maxLength: 150 }) @Expose() biography?:
    | string
    | null;

  @ApiProperty({ example: 0 }) @Expose() pinsCount: number;

  @ApiProperty({ type: String })
  @Expose()
  @Transform(({ value }) =>
    value instanceof Date ? value.toISOString() : (value ?? null),
  )
  createdAt: string;

  @ApiProperty({ type: String })
  @Expose()
  @Transform(({ value }) =>
    value instanceof Date ? value.toISOString() : (value ?? null),
  )
  updatedAt: string;
}
