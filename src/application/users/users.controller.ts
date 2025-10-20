import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags, ApiOkResponse, ApiCreatedResponse, ApiNoContentResponse, ApiBadRequestResponse, ApiBearerAuth } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { UsersService } from 'src/application/users/users.service';
import { PinsService } from 'src/application/pins/pins.service';
import { CreateUserDto } from 'src/application/auth/dtos/create-user.dto';
import { UserResponseDto } from './dtos/user-response.dto';
import { UpdateProfilePictureDto } from './dtos/update-profile-picture.dto';
import { UpdateUserDto } from './dtos/update-user.dto';
import { AnyJwtGuard } from '../auth/guards/any-jwt.guard';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { Roles } from 'src/application/auth/types/roles.decorator';
import { RolesGuard } from 'src/application/auth/guards/roles.guard';
import { AppRole, UserStatus } from '@prisma/client';
import { PinResponseDto } from '../pins/dtos/pin-response.dto';



@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly pinsService: PinsService,
  ) {}

  @UseGuards(AnyJwtGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get my profile' })
  @ApiOkResponse({ type: UserResponseDto })
  async getMe(@Req() req: any) {
    const id = req.user?.sub;
    const user = await this.usersService.findOne(id);
    return plainToInstance(UserResponseDto, user, { excludeExtraneousValues: true });
  }

  @UseGuards(AnyJwtGuard)
  @ApiBearerAuth()
  @Patch('me')
  @ApiOperation({ summary: 'Update my profile' })
  @ApiOkResponse({ type: UserResponseDto })
  async updateMe(@Req() req: any, @Body() dto: UpdateProfileDto) {
    const id = req.user?.sub;
    const user = await this.usersService.updateMe(id, dto);
    return plainToInstance(UserResponseDto, user, { excludeExtraneousValues: true });
  }

  @UseGuards(AnyJwtGuard)
  @ApiBearerAuth()
  @Patch('me/profile-picture')
  @ApiOperation({ summary: 'Update my profile picture (by Cloudinary publicId)' })
  @ApiOkResponse({ type: UserResponseDto })
  async updateMyProfilePicture(@Req() req: any, @Body() body: UpdateProfilePictureDto) {
    const id = req.user?.sub;
    const user = await this.usersService.uploadProfilePicture(id, body.publicId);
    return plainToInstance(UserResponseDto, user, { excludeExtraneousValues: true });
  }

  @UseGuards(AnyJwtGuard)
  @ApiBearerAuth()
  @Get('me/pins')
  @ApiOperation({ summary: "My pins (paginated)" })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  async getMyPins(
    @Req() req: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const id = req.user?.sub;
    const safeLimit = Math.max(1, Math.min(limit, 50));
    return this.pinsService.getPinsByUserService(id, page, safeLimit);
  }

  @UseGuards(AnyJwtGuard)
  @ApiBearerAuth()
  @Get('me/pins-count')
  @ApiOperation({ summary: "My pins count" })
  async getMyPinsCount(@Req() req: any) {
    const id = req.user?.sub;
    return this.pinsService.getUserPinsCountService(id);
  }

  @UseGuards(AnyJwtGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(AppRole.ADMIN)
  @Get()
  @ApiOperation({ summary: 'List users (paginated + filters)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'q', required: false, description: 'search by email/username/name' })
  @ApiQuery({ name: 'role', required: false, enum: AppRole })
  @ApiQuery({ name: 'status', required: false, enum: UserStatus })
  @ApiQuery({ name: 'city', required: false })
  async list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('q') q?: string,
    @Query('role') role?: AppRole,
    @Query('status') status?: UserStatus,
    @Query('city') city?: string,
  ) {
    const result = await this.usersService.list({ page, limit, q, role, status, city });
    return {
      data: result.data.map(u => plainToInstance(UserResponseDto, u, { excludeExtraneousValues: true })),
      meta: result.meta,
    };
  }


  @UseGuards(AnyJwtGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(AppRole.ADMIN)
  @Get(':id')
  @ApiOperation({ summary: 'Get user by id' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: UserResponseDto })
  async getUser(@Param('id', new ParseUUIDPipe()) id: string) {
    const user = await this.usersService.findOne(id);
    return plainToInstance(UserResponseDto, user, { excludeExtraneousValues: true });
  }


  @UseGuards(AnyJwtGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(AppRole.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create user' })
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiBadRequestResponse()
  async createUser(@Body() dto: CreateUserDto) {
    const user = await this.usersService.createUser(dto);
    return plainToInstance(UserResponseDto, user, { excludeExtraneousValues: true });
  }

  @UseGuards(AnyJwtGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(AppRole.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update user (PATCH)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: UserResponseDto })
  async updateUserPatch(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateUserDto) {
    const user = await this.usersService.updateUser(id, dto);
    return plainToInstance(UserResponseDto, user, { excludeExtraneousValues: true });
  }

  @UseGuards(AnyJwtGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(AppRole.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete user (soft delete)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  async removeUser(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.usersService.removeUser(id);
    return { success: true };
  }

  @Patch(':id/profile-picture')
  @ApiOperation({ summary: 'Update profile picture (Cloudinary publicId → URL)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: UserResponseDto })
  async uploadProfilePicture(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateProfilePictureDto,
  ) {
    const user = await this.usersService.uploadProfilePicture(id, body.publicId);
    return plainToInstance(UserResponseDto, user, { excludeExtraneousValues: true });
  }

  @Get(':id/pins')
  @ApiOperation({ summary: "User's pins (paginated)" })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiOkResponse({ type: PinResponseDto, isArray: true })
  async getUserPins(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const safeLimit = Math.max(1, Math.min(limit, 50));
    return this.pinsService.getPinsByUserService(id, page, safeLimit);
  }

  @Get(':id/pins-count')
  @ApiOperation({ summary: "User's pins count" })
  @ApiParam({ name: 'id', format: 'uuid' })
  async getUserPinsCount(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.pinsService.getUserPinsCountService(id);
  }
}
