// src/application/auth/config/auth0.config.ts
import { config as dotenvConfig } from 'dotenv';
import type { ConfigParams } from 'express-openid-connect';

dotenvConfig();

function stripSlash(s?: string | null): string | undefined {
  if (!s) return undefined;
  return s.replace(/\/+$/, '');
}

const backendBaseURL =
  process.env.AUTH_BASE_URL ||
  process.env.API_BASE_URL ||
  process.env.BACKEND_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://back-pf-henry-production-03d3.up.railway.app'
    : 'http://localhost:3000');

const issuerBase = stripSlash(
  process.env.AUTH0_ISSUER_BASE_URL || process.env.AUTH0_BASE_URL
);
if (!issuerBase) {
  throw new Error('AUTH0_ISSUER_BASE_URL es obligatorio (dominio raíz de tu tenant)');
}

const sameSite =
  process.env.CROSS_SITE_COOKIES === '1' ? ('none' as const) : ('lax' as const);

export const config: ConfigParams = {
  authRequired: false,
  auth0Logout: true,
  secret: process.env.AUTH0_SECRET!,       // clave larga aleatoria
  baseURL: stripSlash(backendBaseURL)!,    // origen del BACK
  clientID: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
  issuerBaseURL: issuerBase,               // p.ej. https://dev-xxx.us.auth0.com
  authorizationParams: {
    response_type: 'code',
    scope: 'openid profile email',
    // audience opcional si usas APIs de Auth0
    // audience: process.env.AUTH0_AUDIENCE,
  },
  routes: {
    login: '/login',
    callback: '/auth/callback',
  },
  session: {
    rolling: true,
    rollingDuration: 60 * 60 * 24 * 7,
    cookie: {
      sameSite,                             // 'none' en cross-site
      secure: process.env.NODE_ENV === 'production',
    },
  },
};

console.log('🔍 OIDC:', {
  baseURL: stripSlash(backendBaseURL),
  callback: `${stripSlash(backendBaseURL)}/auth/callback`,
  issuerBaseURL: issuerBase,
  sameSite,
});
