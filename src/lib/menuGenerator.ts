import { DishCategory, DishMealType, DishSeason, MealSlot } from "@prisma/client";

export type DishForGeneration = {
  id: string;
  category: DishCategory;
  mealType: DishMealType;
  season: DishSeason;
  yieldsTwoMeals: boolean;
};

export type GenerateWeekOptions = {
  rng?: () => number;
  /** Platos usados la semana anterior: se evitan mientras haya alternativa. */
  recentDishIds?: Set<string>;
  /** Temporada de la semana a generar; si se omite, no se filtra por temporada. */
  season?: DishSeason;
  /**
   * Huecos que el usuario ha marcado a propósito para no generar nada (p.
   * ej. "como fuera ese día"), como claves `${dayOfWeek}-${mealType}`. Se
   * dejan vacíos sin ni siquiera intentar elegir plato, y cortan cualquier
   * "2ª toma" pendiente para esa franja en vez de dejarla saltar al día
   * siguiente.
   */
  excludedSlots?: Set<string>;
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

function isDishEligible(dish: DishForGeneration, mealType: MealSlot, season: DishSeason | undefined) {
  const mealOk = dish.mealType === "AMBAS" || dish.mealType === mealType;
  const seasonOk = !season || dish.season === "AMBAS" || dish.season === season;
  return mealOk && seasonOk;
}

function pickRandom<T>(arr: T[], rng: () => number): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Elige de `pool` evitando `recentDishIds` cuando sea posible (platos usados
 * la semana anterior): si queda al menos un plato "fresco" se sortea solo
 * entre esos, y solo se recurre a un plato reciente cuando es la única
 * opción disponible para ese hueco.
 */
function pickPreferringFresh<T extends { id: string }>(
  pool: T[],
  recentDishIds: Set<string>,
  rng: () => number
): T | undefined {
  const fresh = pool.filter((d) => !recentDishIds.has(d.id));
  return pickRandom(fresh.length > 0 ? fresh : pool, rng);
}

type CarryOver = { slot: DishCategory; dishId: string; sourceKey: string };

/**
 * Genera una semana completa a partir del catálogo de platos activos.
 * Función pura (sin acceso a BD) para que sea fácil de razonar y probar:
 * toma la lista de platos y devuelve la lista de huecos a rellenar.
 *
 * `recentDishIds` (p. ej. los platos de la semana anterior) se evitan mientras
 * haya alternativa, pero no están prohibidos: si son la única opción para un
 * hueco, se usan igualmente en vez de dejarlo vacío. `season`, si se pasa,
 * excluye del todo los platos etiquetados para la otra temporada (a
 * diferencia de `recentDishIds`, esto sí es una restricción dura: un plato
 * de invierno nunca se cuela en un menú de verano). `excludedSlots` deja
 * huecos concretos vacíos a propósito (p. ej. "ese día como fuera"), sin
 * intentar elegir plato para ellos en absoluto.
 */
export function generateWeek(dishes: DishForGeneration[], options: GenerateWeekOptions = {}): PlannedEntry[] {
  const { rng = Math.random, recentDishIds = new Set<string>(), season, excludedSlots = new Set<string>() } = options;
  const entries: PlannedEntry[] = [];
  const usedDishIds = new Set<string>();
  let carryOver: Partial<Record<MealSlot, CarryOver>> = {};

  function pool(category: DishCategory, mealType: MealSlot) {
    return dishes.filter(
      (d) => d.category === category && isDishEligible(d, mealType, season) && !usedDishIds.has(d.id)
    );
  }

  for (let day = 0; day < DAYS; day++) {
    const nextCarryOver: Partial<Record<MealSlot, CarryOver>> = {};

    for (const mealType of MEAL_TYPES) {
      if (excludedSlots.has(`${day}-${mealType}`)) {
        // Hueco excluido a propósito: no se genera nada aquí y se descarta
        // cualquier "2ª toma" pendiente para esta franja (no salta al día
        // siguiente: ese día tampoco se cocina en casa).
        continue;
      }

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
        chosen.push({ slot: "PLATO_UNICO", dish: pickPreferringFresh(unicoPool, recentDishIds, rng)! });
      } else if (structure === "PRIMERO_SEGUNDO") {
        chosen.push({ slot: "PRIMERO", dish: pickPreferringFresh(primeroPool, recentDishIds, rng)! });
        chosen.push({ slot: "SEGUNDO", dish: pickPreferringFresh(segundoPool, recentDishIds, rng)! });
      } else if (structure === "PRIMERO_ONLY") {
        chosen.push({ slot: "PRIMERO", dish: pickPreferringFresh(primeroPool, recentDishIds, rng)! });
      } else if (structure === "SEGUNDO_ONLY") {
        chosen.push({ slot: "SEGUNDO", dish: pickPreferringFresh(segundoPool, recentDishIds, rng)! });
      }

      for (const { dish } of chosen) usedDishIds.add(dish.id);

      // El acompañamiento solo tiene sentido junto a un segundo plato: con la estructura
      // completa (primero + segundo) o con segundo-solo. Nunca con plato único ni con
      // primero-solo (ahí no hay segundo al que acompañar).
      if ((structure === "PRIMERO_SEGUNDO" || structure === "SEGUNDO_ONLY") && acompPool.length > 0 && rng() < 0.5) {
        const acomp = pickPreferringFresh(acompPool, recentDishIds, rng)!;
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
