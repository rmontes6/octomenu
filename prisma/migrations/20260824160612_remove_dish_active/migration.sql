-- DropIndex
DROP INDEX "Dish_userId_category_mealType_active_idx";

-- AlterTable
ALTER TABLE "Dish" DROP COLUMN "active";

-- CreateIndex
CREATE INDEX "Dish_userId_category_mealType_idx" ON "Dish"("userId", "category", "mealType");
