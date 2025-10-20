
import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from 'src/application/auth/dtos/create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {}
