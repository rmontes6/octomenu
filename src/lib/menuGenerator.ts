import { DishCategory, DishMealType, MealSlot } from "@prisma/client";

export type DishForGeneration = {
  id: string;
  category: DishCategory;
  mealType: DishMealType;
  yieldsTwoMeals: boolean;
};

export type PlannedEntry = {
  dayOfWeek: number;
  mealType: MealSlot;
  slot: DishCategory;
  dishId: string;
  /** Clave de la entrada original de la que esta es copia de sobras, o null si es una elección nueva. */
  sourceKey: string | null;
};

const DAYS = 7;
const MEAL_TYPES: MealSlot[] = ["COMIDA", "CENA"];

export function entryKey(dayOfWeek: number, mealType: MealSlot, slot: DishCategory) {
  return `${dayOfWeek}-${mealType}-${slot}`;
}

function isDishEligible(dish: DishForGeneration, mealType: MealSlot) {
  return dish.mealType === "AMBAS" || dish.mealType === mealType;
}

function pickRandom<T>(arr: T[], rng: () => number): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(rng() * arr.length)];
}

type CarryOver = { slot: DishCategory; dishId: string; sourceKey: string };

/**
 * Genera una semana completa a partir del catálogo de platos activos.
 * Función pura (sin acceso a BD) para que sea fácil de razonar y probar:
 * toma la lista de platos y devuelve la lista de huecos a rellenar.
 */
export function generateWeek(dishes: DishForGeneration[], rng: () => number = Math.random): PlannedEntry[] {
  const entries: PlannedEntry[] = [];
  const usedDishIds = new Set<string>();
  let carryOver: Partial<Record<MealSlot, CarryOver>> = {};

  function pool(category: DishCategory, mealType: MealSlot) {
    return dishes.filter(
      (d) => d.category === category && isDishEligible(d, mealType) && !usedDishIds.has(d.id)
    );
  }

  for (let day = 0; day < DAYS; day++) {
    const nextCarryOver: Partial<Record<MealSlot, CarryOver>> = {};

    for (const mealType of MEAL_TYPES) {
      const carried = carryOver[mealType];
      if (carried) {
        // Plato que "rinde 2 tomas": se repite en la misma franja del día
        // siguiente sin volver a tirar el dado, y no se re-propaga más allá.
        entries.push({ dayOfWeek: day, mealType, slot: carried.slot, dishId: carried.dishId, sourceKey: carried.sourceKey });
        continue;
      }

      const unicoPool = pool("PLATO_UNICO", mealType);
      const primeroPool = pool("PRIMERO", mealType);
      const segundoPool = pool("SEGUNDO", mealType);
      const acompPool = pool("ACOMPANAMIENTO", mealType);

      const canUnico = unicoPool.length > 0;
      const canPrimeroSegundo = primeroPool.length > 0 && segundoPool.length > 0;

      let structure: "UNICO" | "PRIMERO_SEGUNDO" | "PRIMERO_ONLY" | "SEGUNDO_ONLY" | null = null;
      if (canUnico && canPrimeroSegundo) {
        structure = rng() < 0.5 ? "UNICO" : "PRIMERO_SEGUNDO";
      } else if (canUnico) {
        structure = "UNICO";
      } else if (canPrimeroSegundo) {
        structure = "PRIMERO_SEGUNDO";
      } else if (primeroPool.length > 0) {
        structure = "PRIMERO_ONLY";
      } else if (segundoPool.length > 0) {
        structure = "SEGUNDO_ONLY";
      }

      if (!structure) continue; // no hay platos disponibles para esta franja: se deja vacía

      const chosen: { slot: DishCategory; dish: DishForGeneration }[] = [];
      if (structure === "UNICO") {
        chosen.push({ slot: "PLATO_UNICO", dish: pickRandom(unicoPool, rng)! });
      } else if (structure === "PRIMERO_SEGUNDO") {
        chosen.push({ slot: "PRIMERO", dish: pickRandom(primeroPool, rng)! });
        chosen.push({ slot: "SEGUNDO", dish: pickRandom(segundoPool, rng)! });
      } else if (structure === "PRIMERO_ONLY") {
        chosen.push({ slot: "PRIMERO", dish: pickRandom(primeroPool, rng)! });
      } else if (structure === "SEGUNDO_ONLY") {
        chosen.push({ slot: "SEGUNDO", dish: pickRandom(segundoPool, rng)! });
      }

      for (const { dish } of chosen) usedDishIds.add(dish.id);

      if (acompPool.length > 0 && rng() < 0.5) {
        const acomp = pickRandom(acompPool, rng)!;
        usedDishIds.add(acomp.id);
        chosen.push({ slot: "ACOMPANAMIENTO", dish: acomp });
      }

      for (const { slot, dish } of chosen) {
        const k = entryKey(day, mealType, slot);
        entries.push({ dayOfWeek: day, mealType, slot, dishId: dish.id, sourceKey: null });

        if (dish.yieldsTwoMeals && day + 1 < DAYS) {
          nextCarryOver[mealType] = { slot, dishId: dish.id, sourceKey: k };
        }
      }
    }

    carryOver = nextCarryOver;
  }

  return entries;
}
