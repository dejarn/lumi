-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "Protocol" AS ENUM ('HUE', 'LUMI', 'ZIGBEE');

-- CreateEnum
CREATE TYPE "DeviceKind" AS ENUM ('LIGHT', 'SENSOR');

-- CreateEnum
CREATE TYPE "TriggerType" AS ENUM ('CRON', 'SENSOR');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "hashedPassword" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invites" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "protocol" "Protocol" NOT NULL,
    "externalId" TEXT NOT NULL,
    "kind" "DeviceKind" NOT NULL,
    "zone" INTEGER NOT NULL DEFAULT 0,
    "reachable" BOOLEAN NOT NULL DEFAULT true,
    "protoVersion" INTEGER,
    "lastSeen" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "power" BOOLEAN,
    "brightness" INTEGER,
    "hue" INTEGER,
    "saturation" INTEGER,
    "colorBrightness" INTEGER,
    "animId" INTEGER DEFAULT 0,
    "sensorActive" BOOLEAN,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scene_devices" (
    "sceneId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "power" BOOLEAN NOT NULL,
    "brightness" INTEGER NOT NULL,
    "hue" INTEGER NOT NULL,
    "saturation" INTEGER NOT NULL,
    "colorBrightness" INTEGER NOT NULL,
    "animId" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "scene_devices_pkey" PRIMARY KEY ("sceneId","deviceId")
);

-- CreateTable
CREATE TABLE "triggers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TriggerType" NOT NULL,
    "sceneId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cronExpr" TEXT,
    "sensorDeviceId" TEXT,
    "sensorState" BOOLEAN,
    "lastFiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "triggers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "invites_tokenHash_key" ON "invites"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "devices_protocol_externalId_key" ON "devices"("protocol", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "scenes_name_key" ON "scenes"("name");

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_devices" ADD CONSTRAINT "scene_devices_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_devices" ADD CONSTRAINT "scene_devices_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "triggers" ADD CONSTRAINT "triggers_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "triggers" ADD CONSTRAINT "triggers_sensorDeviceId_fkey" FOREIGN KEY ("sensorDeviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
