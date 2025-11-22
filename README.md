# 🚗 Volantia – Backend

Plataforma de alquiler de vehículos entre usuarios (peer‑to‑peer).  
Backend desarrollado con **NestJS**, **Prisma**, **PostgreSQL**, **JWT**, **Cloudinary** y **Mercado Pago**.

---

## 🧱 Tecnologías principales
- NestJS 11
- Prisma ORM
- PostgreSQL
- JWT Authentication
- Cloudinary
- Mercado Pago Checkout Pro
- Swagger / OpenAPI
- Railway Deploy

---

## 📦 Scripts disponibles
```
npm run start:dev
npm run start
npm run build
```

---

## 📂 Estructura
```
src/
├── application/
│ ├── auth/ # Registro, login, JWT, guards
│ ├── users/ # CRUD de usuarios y perfiles
│ ├── admin/ # Funciones exclusivas de administradores
│ ├── renter/ # Funciones exclusivas del propietario (RENTER)
│ ├── standard-user/ # Funciones para usuarios comunes
│ ├── pins/ # Vehículos (creación, fotos, filtrado, etc.)
│ ├── reviews/ # Reseñas entre usuarios
│ ├── bookings/ # Reservas de vehículos con fechas
│ ├── payments/ # Mercado Pago (preferencias, webhook, redirect)
│ ├── files/ # Subida de imágenes (Cloudinary)
│ ├── mailer/ # Mails, plantillas HBS, notificaciones
│ ├── cron/ # Tareas automáticas programadas
│ └── common/ # Helpers, decoradores y utilidades compartidas
│
├── infra/
│ ├── prisma/ # Schema, migraciones, seeders, PrismaClient
│ └── cloudinary/ # Configuración y adaptador de Cloudinary
│
├── utils/ # Funciones generales de utilidad
│
├── app.module.ts # Módulo raíz
├── app.controller.ts # Controlador principal
├── app.service.ts # Servicio base
└── main.ts # Punto de entrada de la aplicación

---

## 🔐 Autenticación (JWT)

### Signup
`POST /auth/signup`

### Signin
`POST /auth/signin`

### AuthGuard
Usa:
```
Authorization: Bearer <token>
```

---

## 🚗 Pins (Vehículos)
- Crear vehículos (solo renter/admin)
- Filtrado: categoría, ciudad, estado
- Paginación
- Fotos con Cloudinary
- Seeder (`/pins/seeder`)

---

## 📸 Cloudinary
- Subida de imágenes  
- Manejo de portada  
- Guardado en tabla `PinPhoto`

---

## 🛒 Bookings
DTO:
```
userId: string;
pinId: string;
start_date: Date;
end_date: Date;
```

---

## 💳 Mercado Pago
Endpoints:
```
POST /payments
POST /payments/webhook
```

Incluye:
- back_urls  
- notifications  
- external_reference  

---

## 🌐 Variables de entorno
```
# -------------------------
# 🔵 Base de datos
# -------------------------
DATABASE_URL=
PORT=3000

# -------------------------
# 🔐 JWT
# -------------------------
JWT_SECRET=

# -------------------------
# ☁️ Cloudinary
# -------------------------
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# -------------------------
# 🌐 CORS
# -------------------------
CORS_ORIGINS=

# -------------------------
# 📩 Resend (Mailer)
# -------------------------
RESEND_API_KEY=

# -------------------------
# 🔑 Auth0
# -------------------------
AUTH0_AUDIENCE=
AUTH0_CLIENT_ID=
AUTH0_BASE_URL=
AUTH0_CLIENT_SECRET=
AUTH0_SECRET=

# -------------------------
# 💳 Mercado Pago
# -------------------------
MP_PUBLIC_KEY=
MP_ACCESS_TOKEN=
MP_BACKEND_URL=
FRONTEND_URL=
MP_CURRENCY_ID=

# -------------------------
# 📬 Mailer (Gmail OAuth)
# -------------------------
MAILER_CLIENT_ID=
MAILER_CLIENT_SECRET=
MAILER_REFRESH_TOKEN=
MAILER_USER=

---

## 🧪 Swagger
Disponible en `/api/docs`

---

## ▶️ Ejecutar proyecto
```
npm install
npx prisma migrate dev
npm run start:dev
```

---

## 🚀 Deploy
Railway + Prisma Migrate:
```
npx prisma migrate deploy
```

---

## 👥 Autores
Proyecto final Henry — Backend  
Integrante:
- Rafa Ibarra
-
-
-
-
-
