-- AlterTable: isAdmin has a default, safe to add directly
ALTER TABLE "User" ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- The sole account that existed before multi-user support becomes the
-- first admin. Safe because this app has never supported more than one
-- account until this migration; later admin changes are made through the
-- users panel, not by re-running this one-time migration.
UPDATE "User" SET "isAdmin" = true;

-- AlterTable: add userId as nullable first so existing rows can be backfilled
ALTER TABLE "Dish" ADD COLUMN     "userId" TEXT;
ALTER TABLE "WeeklyMenu" ADD COLUMN     "userId" TEXT;

-- Backfill: attach every pre-existing row to the sole user that existed
-- before multi-user support. Safe because this app has never supported
-- more than one account until this migration.
UPDATE "Dish" SET "userId" = (SELECT "id" FROM "User" LIMIT 1) WHERE "userId" IS NULL;
UPDATE "WeeklyMenu" SET "userId" = (SELECT "id" FROM "User" LIMIT 1) WHERE "userId" IS NULL;

-- Now that every row has a value, enforce NOT NULL
ALTER TABLE "Dish" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "WeeklyMenu" ALTER COLUMN "userId" SET NOT NULL;

-- DropIndex
DROP INDEX "Dish_category_mealType_active_idx";

-- DropIndex
DROP INDEX "WeeklyMenu_weekStart_key";

-- CreateIndex
CREATE INDEX "Dish_userId_category_mealType_active_idx" ON "Dish"("userId", "category", "mealType", "active");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyMenu_userId_weekStart_key" ON "WeeklyMenu"("userId", "weekStart");

-- AddForeignKey
ALTER TABLE "Dish" ADD CONSTRAINT "Dish_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyMenu" ADD CONSTRAINT "WeeklyMenu_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
