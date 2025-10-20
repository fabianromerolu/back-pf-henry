import {
  Controller, Get, Req, Post, Body, Res, HttpCode, HttpStatus, Query, UseGuards
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBody, ApiOkResponse, ApiUnauthorizedResponse,
  ApiBadRequestResponse, ApiCreatedResponse, ApiFoundResponse, ApiQuery, ApiResponse
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AnyJwtGuard } from './guards/any-jwt.guard';
import { CreateUserDto } from './dtos/create-user.dto';
import { LoginUserDto } from './dtos/login-user.dto';


function frontBase(): string {
  return (
    process.env.FRONTEND_URL ||
    process.env.FRONTEND_REDIRECT ||
    'http://localhost:3001'
  ).replace(/\/+$/, '');
}

function absolutizeReturnTo(rt?: string): string {
  const base = frontBase();
  if (!rt) return `${base}/login`;
  if (rt.startsWith('/')) return `${base}${rt}`;
  return rt;
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @ApiOperation({ summary: 'Who am I (session-based)' })
  @ApiOkResponse({ description: 'Usuario autenticado si hay sesión OIDC' })
  @ApiUnauthorizedResponse({ description: 'No logged in' })
  async me(@Req() req: any) {
    const oidcUser = req.oidc?.user;
    if (!oidcUser) return { message: 'No logged in' };
    const user = await this.authService.validateUser({
      sub: oidcUser.sub,
      email: oidcUser.email,
      name: oidcUser.name,
    });
    return { user, oidcUser };
  }

  @UseGuards(AnyJwtGuard)
  @Get('me/jwt')
  @ApiOperation({ summary: 'Who am I (JWT local/Auth0)' })
  @ApiOkResponse({ description: 'Usuario autenticado vía JWT' })
  whoAmIWithJwt(@Req() req: any) {
    return { user: req.user }; // normalizado con sub en el guard
  }

  @Get('logout')
  @ApiOperation({ summary: 'Logout (Auth0 OIDC)' })
  async logoutGet(@Res() res: any, @Query('returnTo') rt?: string) {
    res.clearCookie('volantia_token', { path: '/' });
    res.clearCookie('volantia_role', { path: '/' });
    const returnTo = absolutizeReturnTo(rt);
    return (res as any).oidc.logout({ returnTo });
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout (redirección Auth0)' })
  async logoutPost(@Res() res: any, @Query('returnTo') rt?: string) {
    res.clearCookie('volantia_token', { path: '/' });
    res.clearCookie('volantia_role', { path: '/' });

    const returnTo = absolutizeReturnTo(rt);
    const url =
      `${process.env.AUTH0_BASE_URL}/v2/logout` +
      `?client_id=${encodeURIComponent(process.env.AUTH0_CLIENT_ID || '')}` +
      `&returnTo=${encodeURIComponent(returnTo)}`;
    return res.redirect(url);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register (local)' })
  @ApiBody({ type: CreateUserDto })
  @ApiCreatedResponse({ description: 'Usuario creado.' })
  @ApiBadRequestResponse({ description: 'Datos inválidos.' })
  async register(@Body() dto: CreateUserDto, @Res({ passthrough: true }) res: any) {
    const out = await this.authService.register(dto);

    res.cookie('volantia_token', out.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 15,
      path: '/',
    });

    if (out?.user?.role) {
      res.cookie('volantia_role', out.user.role, {
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24 * 7,
        path: '/',
      });
    }

    return out;
  }

  @Post('login')
  @ApiOperation({ summary: 'Login (local)' })
  @ApiBody({ type: LoginUserDto })
  @ApiOkResponse({ description: 'Login exitoso.' })
  @ApiUnauthorizedResponse({ description: 'Credenciales inválidas.' })
  async login(@Body() dto: LoginUserDto, @Res({ passthrough: true }) res: any) {
    const out = await this.authService.login(dto);

    res.cookie('volantia_token', out.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 15,
      path: '/',
    });

    if (out?.user?.role) {
      res.cookie('volantia_role', out.user.role, {
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24 * 7,
        path: '/',
      });
    }

    return out;
  }
}
