// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import type { ConfigParams } from 'express-openid-connect';
import { auth } from 'express-openid-connect';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { AuthService } from './application/auth/auth.service';
import { config as oidcConfig } from './application/auth/config/auth0.config';

function isProd() {
  return process.env.NODE_ENV === 'production';
}
function cookieSameSite(): 'lax' | 'none' {
  return process.env.CROSS_SITE_COOKIES === '1' ? 'none' : 'lax';
}
function frontBase(): string {
  const base =
    process.env.FRONTEND_URL ||
    process.env.FRONTEND_REDIRECT ||
    (isProd() ? 'https://front-pf-henry-bb42.vercel.app' : 'http://localhost:3001');
  return base.replace(/\/+$/, '');
}
function parseOrigins(env?: string): string[] {
  if (!env) return ['http://localhost:3001'];
  return env.split(',').map((s) => s.trim()).filter(Boolean);
}
type AppRole = 'ADMIN' | 'RENTER' | 'USER';
function roleDashboardPath(role?: string, isAdmin?: boolean): string {
  if (isAdmin || role === 'ADMIN') return '/dashboard/admin';
  if (role === 'RENTER') return '/dashboard/renter';
  return '/dashboard';
}
function toSafePath(urlLike?: string): string | null {
  if (!urlLike) return null;
  try {
    const u = new URL(urlLike);
    return u.pathname + u.search + u.hash;
  } catch {
    return urlLike.startsWith('/') ? urlLike : null;
  }
}

async function bootstrap() {
  // 1) rawBody nativo (para verificar firmas de webhooks)
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const authService = app.get(AuthService);

  // 2) CORS configurable por ENV
  const origins = parseOrigins(process.env.CORS_ORIGINS);
  app.enableCors({
    origin: (origin, cb) => {
      const ok =
        !origin ||
        origins.includes(origin) ||
        /^https?:\/\/.*\.vercel\.app$/.test(origin);
      cb(ok ? null : new Error('Not allowed by CORS'), ok);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'x-signature',
      'x-request-id',
      'accept',
      'accept-language',
    ],
    exposedHeaders: ['Location'],
  });

  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // 3) afterCallback: genera tu JWT, setea cookies y redirige
  const afterCb: NonNullable<ConfigParams['afterCallback']> = async (req, res, session, state: any) => {
    // Express OIDC ya dejó al user en req.oidc.user desde el id_token
    const oidcUser = (req as any).oidc?.user as { sub?: string; email?: string; name?: string } | undefined;

    const sub = oidcUser?.sub;
    const email = oidcUser?.email;
    const name = oidcUser?.name;

    if (!sub) {
      const url = new URL(`${frontBase()}/login`);
      url.searchParams.set('error', 'no_user_sub');
      (req as any).openidState = { ...(req as any).openidState, returnTo: url.toString() };
      return session;
    }

    const { user, created } = await authService.validateUser({ sub, email, name });
    const role: AppRole = (user.role as AppRole) ?? (user.isAdmin ? 'ADMIN' : 'USER');

    // Emails (no bloquean)
    if (created) await authService.sendWelcomeForSso(user);
    else await authService.sendLoginForSso(user);

    const token = await authService.generateToken({
      sub: user.id,
      email: user.email,
      name: user.name ?? user.username ?? user.email,
      role,
    });

    // Cookie httpOnly con el JWT del back
    (res as any).cookie('volantia_token', token, {
      httpOnly: true,
      sameSite: cookieSameSite(), // 'none' en prod si puedes
      secure: isProd(),
      maxAge: 1000 * 60 * 15,
      path: '/',
    });

    // Cookie legible por el front con el rol
    (res as any).cookie('volantia_role', role, {
      httpOnly: false,
      sameSite: cookieSameSite(),
      secure: isProd(),
      maxAge: 1000 * 60 * 60 * 24 * 7,
      path: '/',
    });

    // Redirección de vuelta al front
    const desired = toSafePath(state?.returnTo); // p.ej. "/auth/sso"
    const fallbackPath = roleDashboardPath(role, user.isAdmin);
    const path = desired && desired !== '/login' ? desired : fallbackPath;

    const sendToken = process.env.SEND_TOKEN_IN_QUERY === '1';
    const returnUrl = new URL(`${frontBase()}${path}`);
    if (sendToken) returnUrl.searchParams.set('token', token);

    (req as any).openidState = { ...(req as any).openidState, returnTo: returnUrl.toString() };
    return session;
  };

  // 3.1) Montar Auth0 OIDC (Universal Login)
  app.use(auth({ ...(oidcConfig as any), afterCallback: afterCb } as any));

  // 4) Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Volantia API')
    .setDescription('API de Volantia')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  const docsPath = 'docs';
  SwaggerModule.setup(docsPath, app, document, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'Volantia API Docs',
  });

  // 5) Proxy (cookies secure)
  if (process.env.TRUST_PROXY === '1') {
    // @ts-ignore
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');

  const hostLog = process.env.SWAGGER_HOST ?? 'localhost';
  Logger.log(`📚 Swagger: http://${hostLog}:${port}/${docsPath}`);
}

bootstrap();
