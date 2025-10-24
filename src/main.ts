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

function frontBase(): string {
  return (
    process.env.FRONTEND_URL ||
    process.env.FRONTEND_REDIRECT ||
    'http://localhost:3001'
  ).replace(/\/+$/, '');
}

function parseOrigins(env?: string): string[] {
  if (!env) return ['http://localhost:3001'];
  return env.split(',').map(s => s.trim()).filter(Boolean);
}

type AppRole = 'ADMIN' | 'RENTER' | 'USER';

function roleDashboardPath(role?: string, isAdmin?: boolean): string {
  if (isAdmin || role === 'ADMIN') return '/dashboard/admin';
  if (role === 'RENTER') return '/dashboard/renter';
  return '/dashboard';
}

async function bootstrap() {
  // 1) rawBody nativo (para verificar firmas de webhooks)
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const authService = app.get(AuthService);

  // app.use(cookieParser()); // opcional

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
      'Content-Type', 'Authorization', 'X-Requested-With',
      'x-signature', 'x-request-id', 'accept', 'accept-language'
    ],
    exposedHeaders: ['Location']
  });

  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // app.setGlobalPrefix('api'); // opcional

  const toSafePath = (urlLike?: string): string | null => {
    if (!urlLike) return null;
    try {
      const u = new URL(urlLike);
      return u.pathname + u.search + u.hash;
    } catch {
      return urlLike.startsWith('/') ? urlLike : null;
    }
  };

  // 3) Evitar token en query → set cookie httpOnly (afterCallback de Auth0)
  const afterCb: NonNullable<ConfigParams['afterCallback']> =
    async (req, res, session, state: any) => {
      const oidc = (req as any).oidc || {};
      let sub: string | undefined;
      let email: string | undefined;
      let name: string | undefined;

      if (oidc.user?.sub) ({ sub, email, name } = oidc.user as any);

      if (!sub && typeof oidc.fetchUserInfo === 'function') {
        try {
          const ui = await oidc.fetchUserInfo();
          sub = ui?.sub; email = ui?.email; name = ui?.name;
        } catch (e) { Logger.warn(`fetchUserInfo failed: ${e}`); }
      }

      if (!sub && (session as any)?.id_token) {
        try {
          const b64 = (session as any).id_token.split('.')[1];
          const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
          sub = payload?.sub; email = payload?.email; name = payload?.name;
        } catch (e) { Logger.warn(`id_token decode failed: ${e}`); }
      }

      if (!sub) {
        const url = new URL(`${frontBase()}/login`);
        url.searchParams.set('error', 'no_user_sub');
        (req as any).openidState = { ...(req as any).openidState, returnTo: url.toString() };
        return session;
      }

      // Upsert/role en tu base
      const user = await authService.validateUser({ sub, email, name });
      const role: AppRole = (user.role as AppRole) ?? (user.isAdmin ? 'ADMIN' : 'USER');

      const token = await authService.generateToken({
        sub: user.id,
        email: user.email,
        name: user.name ?? user.username ?? user.email,
        role,
      });

      // Cookie segura con el JWT
      (res as any).cookie('volantia_token', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 15, // 15 min
        path: '/',
      });

      // Cookie legible por el front con el rol (opcional)
      (res as any).cookie('volantia_role', role, {
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 días
        path: '/',
      });

      const desired = toSafePath(state?.returnTo);
      const fallbackPath = roleDashboardPath(role, user.isAdmin);
      const path = desired && desired !== '/login' ? desired : fallbackPath;

      (req as any).openidState = {
        ...(req as any).openidState,
        returnTo: `${frontBase()}${path}`, // sin token en la URL
      };
      return session;
    };

  // 3.1) Montar Auth0 OIDC (Universal Login) en Express
  // Nota: casteamos a any para evitar roces de tipos si la versión de tipos difiere.
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

  // 5) Producción detrás de proxy (cookies secure)
  if (process.env.TRUST_PROXY === '1') {
    // @ts-ignore
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');

  // Forzar log con "localhost" (en vez de 127.0.0.1/::1)
  const hostLog = process.env.SWAGGER_HOST ?? 'localhost';
  Logger.log(`📚 Swagger: http://${hostLog}:${port}/${docsPath}`);
}

