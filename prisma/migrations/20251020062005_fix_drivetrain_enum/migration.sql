-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended');

-- CreateEnum
CREATE TYPE "AppRole" AS ENUM ('ADMIN', 'RENTER', 'USER');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('male', 'female', 'other', 'undisclosed');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "VehicleCategory" AS ENUM ('ECONOMY', 'COMPACT', 'MIDSIZE', 'SUV', 'PICKUP', 'VAN', 'PREMIUM', 'ELECTRIC');

-- CreateEnum
CREATE TYPE "BodyType" AS ENUM ('SEDAN', 'HATCHBACK', 'SUV', 'PICKUP', 'VAN', 'COUPE', 'CONVERTIBLE');

-- CreateEnum
CREATE TYPE "Transmission" AS ENUM ('MANUAL', 'AUTOMATIC');

-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('GASOLINE', 'DIESEL', 'HYBRID', 'ELECTRIC');

-- CreateEnum
CREATE TYPE "Drivetrain" AS ENUM ('FWD', 'RWD', 'AWD', 'WD4');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(120) NOT NULL,
    "name" VARCHAR(50),
    "username" VARCHAR(50) NOT NULL,
    "auth0Id" TEXT,
    "password" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "role" "AppRole" NOT NULL DEFAULT 'USER',
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMPTZ(6),
    "sex" "Sex" NOT NULL DEFAULT 'undisclosed',
    "city" VARCHAR(80),
    "state" VARCHAR(80),
    "country" VARCHAR(80),
    "birthDate" DATE,
    "documentType" VARCHAR(30),
    "documentNumber" VARCHAR(60),
    "address" VARCHAR(120),
    "phone" VARCHAR(20),
    "profilePicture" TEXT,
    "biography" VARCHAR(150),
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "pinsCount" INTEGER NOT NULL DEFAULT 0,
    "blockedReason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pin" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "make" VARCHAR(60) NOT NULL,
    "model" VARCHAR(60) NOT NULL,
    "year" INTEGER NOT NULL,
    "trim" VARCHAR(60),
    "bodyType" "BodyType" NOT NULL,
    "category" "VehicleCategory" NOT NULL,
    "transmission" "Transmission" NOT NULL,
    "fuel" "FuelType" NOT NULL,
    "drivetrain" "Drivetrain",
    "color" VARCHAR(40),
    "licensePlate" VARCHAR(20),
    "vin" VARCHAR(30),
    "city" VARCHAR(80) NOT NULL,
    "state" VARCHAR(80) NOT NULL,
    "country" VARCHAR(80) NOT NULL,
    "lat" DECIMAL(10,6),
    "lng" DECIMAL(10,6),
    "pricePerHour" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pricePerDay" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pricePerWeek" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deposit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "kmIncludedPerDay" INTEGER NOT NULL DEFAULT 0,
    "pricePerExtraKm" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "minHours" INTEGER NOT NULL DEFAULT 1,
    "minDriverAge" INTEGER NOT NULL DEFAULT 18,
    "insuranceIncluded" BOOLEAN NOT NULL DEFAULT true,
    "rules" TEXT,
    "description" TEXT,
    "status" "VehicleStatus" NOT NULL DEFAULT 'DRAFT',
    "viewsCount" INTEGER NOT NULL DEFAULT 0,
    "favoritesCount" INTEGER NOT NULL DEFAULT 0,
    "bookingsCount" INTEGER NOT NULL DEFAULT 0,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Pin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PinPhoto" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "pinId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PinPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "File" (
    "id" SERIAL NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_auth0Id_key" ON "User"("auth0Id");

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

-- CreateIndex
CREATE INDEX "User_city_idx" ON "User"("city");

-- CreateIndex
CREATE INDEX "Pin_status_city_category_idx" ON "Pin"("status", "city", "category");

-- CreateIndex
CREATE INDEX "Pin_ownerId_status_idx" ON "Pin"("ownerId", "status");

-- CreateIndex
CREATE INDEX "PinPhoto_pinId_idx" ON "PinPhoto"("pinId");

-- AddForeignKey
ALTER TABLE "Pin" ADD CONSTRAINT "Pin_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PinPhoto" ADD CONSTRAINT "PinPhoto_pinId_fkey" FOREIGN KEY ("pinId") REFERENCES "Pin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
