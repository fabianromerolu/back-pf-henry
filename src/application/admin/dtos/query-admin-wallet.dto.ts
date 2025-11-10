import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class QueryAdminWalletDto {
  @ApiPropertyOptional({ description: 'OwnerId para filtrar créditos/débitos del propietario' })
  @IsOptional() @IsUUID() ownerId?: string;

  @ApiPropertyOptional({ description: 'CREDIT | DEBIT' })
  @IsOptional() @IsIn(['CREDIT', 'DEBIT']) type?: 'CREDIT' | 'DEBIT';

  @ApiPropertyOptional({ description: 'AVAILABLE | PENDING | PAID' })
  @IsOptional() @IsIn(['AVAILABLE', 'PENDING', 'PAID']) status?: 'AVAILABLE' | 'PENDING' | 'PAID';

  @ApiPropertyOptional({ example: 1 }) @IsOptional() @IsInt() @Min(1) page?: number = 1;
  @ApiPropertyOptional({ example: 20 }) @IsOptional() @IsInt() @Min(1) @Max(100) limit?: number = 20;
}
