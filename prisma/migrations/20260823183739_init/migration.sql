-- CreateEnum
CREATE TYPE "DishCategory" AS ENUM ('PLATO_UNICO', 'PRIMERO', 'SEGUNDO', 'ACOMPANAMIENTO');

-- CreateEnum
CREATE TYPE "DishMealType" AS ENUM ('COMIDA', 'CENA', 'AMBAS');

-- CreateEnum
CREATE TYPE "MealSlot" AS ENUM ('COMIDA', 'CENA');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dish" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "DishCategory" NOT NULL,
    "mealType" "DishMealType" NOT NULL,
    "yieldsTwoMeals" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DishIngredient" (
    "id" TEXT NOT NULL,
    "dishId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DishIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyMenu" (
    "id" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyMenu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuEntry" (
    "id" TEXT NOT NULL,
    "weeklyMenuId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "mealType" "MealSlot" NOT NULL,
    "slot" "DishCategory" NOT NULL,
    "dishId" TEXT NOT NULL,
    "leftoverOfId" TEXT,

    CONSTRAINT "MenuEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoppingListCheck" (
    "id" TEXT NOT NULL,
    "weeklyMenuId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ShoppingListCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Dish_category_mealType_active_idx" ON "Dish"("category", "mealType", "active");

-- CreateIndex
CREATE INDEX "DishIngredient_dishId_idx" ON "DishIngredient"("dishId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyMenu_weekStart_key" ON "WeeklyMenu"("weekStart");

-- CreateIndex
CREATE INDEX "MenuEntry_weeklyMenuId_idx" ON "MenuEntry"("weeklyMenuId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuEntry_weeklyMenuId_dayOfWeek_mealType_slot_key" ON "MenuEntry"("weeklyMenuId", "dayOfWeek", "mealType", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "ShoppingListCheck_weeklyMenuId_itemKey_key" ON "ShoppingListCheck"("weeklyMenuId", "itemKey");

-- AddForeignKey
ALTER TABLE "DishIngredient" ADD CONSTRAINT "DishIngredient_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuEntry" ADD CONSTRAINT "MenuEntry_weeklyMenuId_fkey" FOREIGN KEY ("weeklyMenuId") REFERENCES "WeeklyMenu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuEntry" ADD CONSTRAINT "MenuEntry_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuEntry" ADD CONSTRAINT "MenuEntry_leftoverOfId_fkey" FOREIGN KEY ("leftoverOfId") REFERENCES "MenuEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingListCheck" ADD CONSTRAINT "ShoppingListCheck_weeklyMenuId_fkey" FOREIGN KEY ("weeklyMenuId") REFERENCES "WeeklyMenu"("id") ON DELETE CASCADE ON UPDATE CASCADE;
