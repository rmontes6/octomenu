-- CreateEnum
CREATE TYPE "DishSeason" AS ENUM ('VERANO', 'INVIERNO', 'AMBAS');

-- AlterTable
ALTER TABLE "Dish" ADD COLUMN     "season" "DishSeason" NOT NULL DEFAULT 'AMBAS';
