import { config as dotenvConfig } from 'dotenv';

// Solo cargar .env.development en dev
if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
  dotenvConfig({ path: '.env.development' });
} else {
  dotenvConfig(); // en prod que use las envs del host
}

// 👉 Usa SIEMPRE el backend real que estás desplegando
const backendBaseURL =
  process.env.AUTH_BASE_URL // <--- agrega esta env en Railway
  || process.env.API_BASE_URL
  || process.env.BACKEND_URL
  || (process.env.NODE_ENV === 'production'
      ? 'https://volantia.up.railway.app'
      : 'http://localhost:3000');

const frontendRedirect =
  process.env.FRONTEND_URL     // origen del front, sin path (ver paso 2)
  || 'http://localhost:3001';

export const config = {
  authRequired: false,
  auth0Logout: true,
  secret: process.env.AUTH0_SECRET,
  baseURL: backendBaseURL,                 // 👈 aquí el backend correcto
  clientID: process.env.AUTH0_CLIENT_ID,
  issuerBaseURL: process.env.AUTH0_BASE_URL?.replace(/\/+$/, ''),
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  authorizationParams: {
    response_type: 'code',
    scope: 'openid profile email',
  },
  routes: {
    callback: '/auth/callback',
  },
  session: {
    rolling: true,
    rollingDuration: 60 * 60 * 24 * 7,
    cookie: {
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production',
    },
  },
};

console.log('🔍 Auth0 Config:', {
  backendBaseURL,
  callback: `${backendBaseURL}/auth/callback`,
  frontendRedirect,
});
