-- AlterTable
ALTER TABLE "game_rounds" ADD COLUMN     "calculationData" JSONB,
ADD COLUMN     "isProfitable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lossAmount" DECIMAL(15,2),
ADD COLUMN     "profit" DECIMAL(15,2),
ADD COLUMN     "profitPercent" DOUBLE PRECISION,
ADD COLUMN     "selectedResultRank" TEXT,
ADD COLUMN     "totalCollection" DECIMAL(15,2),
ADD COLUMN     "totalPayout" DECIMAL(15,2);
