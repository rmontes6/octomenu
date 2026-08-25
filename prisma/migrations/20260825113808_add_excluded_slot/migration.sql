-- CreateTable
CREATE TABLE "ExcludedSlot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "mealType" "MealSlot" NOT NULL,

    CONSTRAINT "ExcludedSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExcludedSlot_userId_weekStart_idx" ON "ExcludedSlot"("userId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "ExcludedSlot_userId_weekStart_dayOfWeek_mealType_key" ON "ExcludedSlot"("userId", "weekStart", "dayOfWeek", "mealType");

-- AddForeignKey
ALTER TABLE "ExcludedSlot" ADD CONSTRAINT "ExcludedSlot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
