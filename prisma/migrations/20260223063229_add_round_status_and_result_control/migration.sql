/*
  Warnings:

  - The `status` column on the `game_rounds` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('OPEN', 'PAUSED', 'CLOSED', 'CANCELLED', 'RESULT_DECLARED');

-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('PENDING', 'DECLARED');

-- CreateEnum
CREATE TYPE "ResultDeclaredBy" AS ENUM ('ADMIN', 'SYSTEM');

-- AlterTable
ALTER TABLE "game_rounds" ADD COLUMN     "declaredAt" TIMESTAMP(3),
ADD COLUMN     "declaredByAdminId" TEXT,
ADD COLUMN     "resultDeclaredBy" "ResultDeclaredBy",
ADD COLUMN     "resultStatus" "ResultStatus" NOT NULL DEFAULT 'PENDING',
DROP COLUMN "status",
ADD COLUMN     "status" "RoundStatus" NOT NULL DEFAULT 'OPEN';

-- DropEnum
DROP TYPE "GameStatus";
