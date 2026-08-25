-- CreateEnum
CREATE TYPE "DishFoodGroup" AS ENUM ('CARNE', 'PESCADO', 'VERDURA', 'PASTA_ARROZ', 'LEGUMBRE', 'HUEVO', 'OTRO');

-- AlterTable
ALTER TABLE "Dish" ADD COLUMN     "foodGroup" "DishFoodGroup" NOT NULL DEFAULT 'OTRO';
