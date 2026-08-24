import { DishCategory, MealSlot, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addDaysUTC, mondayOf, seasonOf } from "@/lib/dates";
import { entryKey, generateWeek } from "@/lib/menuGenerator";

const menuInclude = {
  entries: {
    include: { dish: { include: { ingredients: true } } },
    orderBy: [{ dayOfWeek: "asc" }, { mealType: "asc" }, { slot: "asc" }] as const,
  },
} satisfies Prisma.WeeklyMenuInclude;

export type WeeklyMenuWithEntries = Prisma.WeeklyMenuGetPayload<{ include: typeof menuInclude }>;

/**
 * Borra los menús semanales de un usuario anteriores a la semana pasada
 * (se conservan: semana pasada + actual + futuras). El usuario ha decidido
 * expresamente no guardar histórico más allá de eso; la semana pasada se
 * conserva porque `createWeeklyMenu` la necesita para `recentDishIds` (evitar
 * repetir platos de una semana a la siguiente) — es la única profundidad que
 * el generador consulta. El corte se calcula sobre la fecha real de hoy, no
 * sobre la semana que se esté consultando, así que da igual qué semana pidas:
 * la limpieza siempre es la misma. El cascade de `MenuEntry`/`ShoppingListCheck`
 * ya está declarado en el esquema (`onDelete: Cascade`), así que un solo
 * `deleteMany` sobre `WeeklyMenu` basta.
 */
async function pruneOldWeeklyMenus(userId: string): Promise<void> {
  const cutoff = addDaysUTC(mondayOf(new Date()), -7);
  await prisma.weeklyMenu.deleteMany({ where: { userId, weekStart: { lt: cutoff } } });
}

/**
 * Borra el estado de checks de la lista de la compra (`ShoppingListCheck`)
 * de cualquier semana anterior a la actual. Es más estricto que
 * `pruneOldWeeklyMenus`: ahí se conservaba la semana pasada porque el
 * generador la necesita, pero los checks de la compra no le sirven a nadie
 * más que al propio usuario mirando esa lista, y ha decidido explícitamente
 * que no le interesa lo que ya compró la semana pasada. El `WeeklyMenu` y
 * sus `MenuEntry` de la semana pasada siguen intactos (`pruneOldWeeklyMenus`
 * los conserva); esto solo vacía la tabla de checks.
 */
export async function pruneOldShoppingListChecks(userId: string): Promise<void> {
  const cutoff = mondayOf(new Date());
  await prisma.shoppingListCheck.deleteMany({ where: { weeklyMenu: { userId, weekStart: { lt: cutoff } } } });
}

export async function getWeeklyMenu(userId: string, weekStart: Date): Promise<WeeklyMenuWithEntries | null> {
  await pruneOldWeeklyMenus(userId);
  return prisma.weeklyMenu.findUnique({ where: { userId_weekStart: { userId, weekStart } }, include: menuInclude });
}

export async function getWeeklyMenuById(userId: string, id: string): Promise<WeeklyMenuWithEntries | null> {
  const menu = await prisma.weeklyMenu.findUnique({ where: { id }, include: menuInclude });
  if (!menu || menu.userId !== userId) return null;
  return menu;
}

/**
 * Crea el menú de una semana. Si ya existe uno para esa semana, solo lo
 * sustituye cuando `force` es true (borra entradas y checks previos).
 * `excludedSlots` (claves `${dayOfWeek}-${mealType}`) son huecos que el
 * usuario ha marcado a propósito para no generar nada (p. ej. "como fuera
 * ese día"): no persisten en BD, solo se usan como entrada puntual para esta
 * generación en concreto.
 */
export async function createWeeklyMenu(
  userId: string,
  weekStart: Date,
  force: boolean,
  excludedSlots: Set<string> = new Set()
): Promise<WeeklyMenuWithEntries> {
  await pruneOldWeeklyMenus(userId);

  const existing = await prisma.weeklyMenu.findUnique({ where: { userId_weekStart: { userId, weekStart } } });
  if (existing && !force) {
    throw new Error("ALREADY_EXISTS");
  }

  const [dishes, previousWeek] = await Promise.all([
    prisma.dish.findMany({ where: { userId } }),
    prisma.weeklyMenu.findUnique({
      where: { userId_weekStart: { userId, weekStart: addDaysUTC(weekStart, -7) } },
      include: { entries: true },
    }),
  ]);
  const recentDishIds = new Set(previousWeek?.entries.map((e) => e.dishId) ?? []);
  const planned = generateWeek(dishes, { recentDishIds, season: seasonOf(weekStart), excludedSlots });

  const menuId = await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.weeklyMenu.delete({ where: { id: existing.id } });
    }
    const menu = await tx.weeklyMenu.create({ data: { userId, weekStart } });

    const idByKey = new Map<string, string>();
    const originals = planned.filter((p) => p.sourceKey === null);
    const leftovers = planned.filter((p) => p.sourceKey !== null);

    for (const p of originals) {
      const created = await tx.menuEntry.create({
        data: { weeklyMenuId: menu.id, dayOfWeek: p.dayOfWeek, mealType: p.mealType, slot: p.slot, dishId: p.dishId },
      });
      idByKey.set(entryKey(p.dayOfWeek, p.mealType, p.slot), created.id);
    }

    for (const p of leftovers) {
      const sourceId = idByKey.get(p.sourceKey!);
      if (!sourceId) continue;
      await tx.menuEntry.create({
        data: {
          weeklyMenuId: menu.id,
          dayOfWeek: p.dayOfWeek,
          mealType: p.mealType,
          slot: p.slot,
          dishId: p.dishId,
          leftoverOfId: sourceId,
        },
      });
    }

    return menu.id;
  });

  const menu = await getWeeklyMenuById(userId, menuId);
  if (!menu) throw new Error("No se pudo cargar el menú recién creado");
  return menu;
}

/**
 * Reelige el plato de un hueco concreto, respetando su categoría/franja y
 * sin repetir ningún plato ya usado esa semana. Si el hueco es una copia de
 * sobras, se reelige la entrada original de la que proviene. Si el plato
 * elegido pasa a rendir/no rendir 2 tomas, se crea/actualiza/borra en
 * cascada su copia del día siguiente.
 */
export async function rerollEntry(userId: string, weeklyMenuId: string, entryId: string): Promise<WeeklyMenuWithEntries> {
  // Comprobación de propiedad antes de tocar nada: entryId/weeklyMenuId por
  // sí solos no prueban que el menú sea del usuario que llama.
  const owningMenu = await prisma.weeklyMenu.findUnique({ where: { id: weeklyMenuId }, select: { userId: true, weekStart: true } });
  if (!owningMenu || owningMenu.userId !== userId) throw new Error("NOT_FOUND");

  const entry = await prisma.menuEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.weeklyMenuId !== weeklyMenuId) {
    throw new Error("NOT_FOUND");
  }

  if (entry.leftoverOfId) {
    return rerollEntry(userId, weeklyMenuId, entry.leftoverOfId);
  }

  const season = seasonOf(owningMenu.weekStart);
  const [allEntries, leftoverCopy, candidates] = await Promise.all([
    prisma.menuEntry.findMany({ where: { weeklyMenuId } }),
    prisma.menuEntry.findFirst({ where: { leftoverOfId: entry.id } }),
    prisma.dish.findMany({
      where: {
        userId,
        category: entry.slot,
        OR: [{ mealType: entry.mealType }, { mealType: "AMBAS" }],
        AND: { OR: [{ season }, { season: "AMBAS" }] },
      },
    }),
  ]);

  const usedDishIds = new Set(
    allEntries.filter((e) => e.id !== entry.id && e.id !== leftoverCopy?.id).map((e) => e.dishId)
  );
  const pool = candidates.filter((d) => !usedDishIds.has(d.id) && d.id !== entry.dishId);
  const finalPool = pool.length > 0 ? pool : candidates.filter((d) => !usedDishIds.has(d.id));
  if (finalPool.length === 0) {
    throw new Error("NO_ALTERNATIVES");
  }

  const newDish = finalPool[Math.floor(Math.random() * finalPool.length)];
  const day = entry.dayOfWeek;
  const mealType = entry.mealType;
  const slot = entry.slot;

  await prisma.$transaction(async (tx) => {
    await tx.menuEntry.update({ where: { id: entry.id }, data: { dishId: newDish.id } });

    if (newDish.yieldsTwoMeals && day + 1 < 7) {
      if (leftoverCopy) {
        await tx.menuEntry.update({ where: { id: leftoverCopy.id }, data: { dishId: newDish.id } });
      } else {
        const occupied = await tx.menuEntry.findUnique({
          where: { weeklyMenuId_dayOfWeek_mealType_slot: { weeklyMenuId, dayOfWeek: day + 1, mealType, slot } },
        });
        if (!occupied) {
          await tx.menuEntry.create({
            data: { weeklyMenuId, dayOfWeek: day + 1, mealType, slot, dishId: newDish.id, leftoverOfId: entry.id },
          });
        }
      }
    } else if (leftoverCopy) {
      await tx.menuEntry.delete({ where: { id: leftoverCopy.id } });
    }
  });

  const menu = await getWeeklyMenuById(userId, weeklyMenuId);
  if (!menu) throw new Error("No se pudo recargar el menú");
  return menu;
}

async function requireOwnedMenu(userId: string, weeklyMenuId: string) {
  const owningMenu = await prisma.weeklyMenu.findUnique({ where: { id: weeklyMenuId }, select: { userId: true } });
  if (!owningMenu || owningMenu.userId !== userId) throw new Error("NOT_FOUND");
}

/**
 * Añade manualmente un plato a un hueco (día/franja/categoría) del menú.
 * No comprueba repeticiones con el resto de la semana a propósito: es una
 * elección explícita del usuario, no una generación automática.
 */
export async function addEntry(
  userId: string,
  weeklyMenuId: string,
  data: { dayOfWeek: number; mealType: MealSlot; slot: DishCategory; dishId: string }
): Promise<WeeklyMenuWithEntries> {
  await requireOwnedMenu(userId, weeklyMenuId);

  const dish = await prisma.dish.findFirst({ where: { id: data.dishId, userId } });
  if (!dish) throw new Error("DISH_NOT_FOUND");
  if (dish.category !== data.slot) throw new Error("CATEGORY_MISMATCH");

  const existing = await prisma.menuEntry.findUnique({
    where: {
      weeklyMenuId_dayOfWeek_mealType_slot: {
        weeklyMenuId,
        dayOfWeek: data.dayOfWeek,
        mealType: data.mealType,
        slot: data.slot,
      },
    },
  });
  if (existing) throw new Error("SLOT_OCCUPIED");

  await prisma.menuEntry.create({
    data: { weeklyMenuId, dayOfWeek: data.dayOfWeek, mealType: data.mealType, slot: data.slot, dishId: data.dishId },
  });

  const menu = await getWeeklyMenuById(userId, weeklyMenuId);
  if (!menu) throw new Error("No se pudo recargar el menú");
  return menu;
}

/**
 * Quita un hueco del menú. Si es una entrada original con una copia de
 * "sobras" en el día siguiente, la copia se borra en cascada (a nivel de
 * BD, `MenuEntry_leftoverOfId_fkey` es ON DELETE CASCADE); si es la propia
 * copia, solo desaparece ella.
 */
export async function removeEntry(userId: string, weeklyMenuId: string, entryId: string): Promise<WeeklyMenuWithEntries> {
  await requireOwnedMenu(userId, weeklyMenuId);

  const entry = await prisma.menuEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.weeklyMenuId !== weeklyMenuId) throw new Error("NOT_FOUND");

  await prisma.menuEntry.delete({ where: { id: entryId } });

  const menu = await getWeeklyMenuById(userId, weeklyMenuId);
  if (!menu) throw new Error("No se pudo recargar el menú");
  return menu;
}

/**
 * Mueve una entrada a otro día/franja, manteniendo su categoría (slot). Si
 * el hueco de destino ya está ocupado, se intercambian las dos entradas en
 * vez de rechazar el movimiento. Las copias de "sobras" (y las entradas que
 * tienen una vinculada) no se pueden mover directamente: hay que quitarlas
 * o resortear el plato original primero, para no dejar una copia huérfana
 * en un día que ya no es "el día siguiente" del original.
 */
export async function moveEntry(
  userId: string,
  weeklyMenuId: string,
  entryId: string,
  target: { dayOfWeek: number; mealType: MealSlot }
): Promise<WeeklyMenuWithEntries> {
  await requireOwnedMenu(userId, weeklyMenuId);

  const entry = await prisma.menuEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.weeklyMenuId !== weeklyMenuId) throw new Error("NOT_FOUND");
  if (entry.leftoverOfId) throw new Error("IS_LEFTOVER_COPY");

  const ownCopy = await prisma.menuEntry.findFirst({ where: { leftoverOfId: entry.id }, select: { id: true } });
  if (ownCopy) throw new Error("HAS_LEFTOVER_COPY");

  if (target.dayOfWeek === entry.dayOfWeek && target.mealType === entry.mealType) {
    const menu = await getWeeklyMenuById(userId, weeklyMenuId);
    if (!menu) throw new Error("No se pudo recargar el menú");
    return menu;
  }

  const targetEntry = await prisma.menuEntry.findUnique({
    where: {
      weeklyMenuId_dayOfWeek_mealType_slot: {
        weeklyMenuId,
        dayOfWeek: target.dayOfWeek,
        mealType: target.mealType,
        slot: entry.slot,
      },
    },
  });

  if (targetEntry) {
    if (targetEntry.leftoverOfId) throw new Error("TARGET_IS_LEFTOVER_COPY");
    const targetHasCopy = await prisma.menuEntry.findFirst({
      where: { leftoverOfId: targetEntry.id },
      select: { id: true },
    });
    if (targetHasCopy) throw new Error("TARGET_HAS_LEFTOVER_COPY");

    // Se pasa por un dayOfWeek temporal fuera de rango (-1) para no chocar
    // con la restricción única (weeklyMenuId, dayOfWeek, mealType, slot)
    // mientras las dos entradas intercambian posición.
    await prisma.$transaction([
      prisma.menuEntry.update({ where: { id: entry.id }, data: { dayOfWeek: -1 } }),
      prisma.menuEntry.update({
        where: { id: targetEntry.id },
        data: { dayOfWeek: entry.dayOfWeek, mealType: entry.mealType },
      }),
      prisma.menuEntry.update({
        where: { id: entry.id },
        data: { dayOfWeek: target.dayOfWeek, mealType: target.mealType },
      }),
    ]);
  } else {
    await prisma.menuEntry.update({
      where: { id: entry.id },
      data: { dayOfWeek: target.dayOfWeek, mealType: target.mealType },
    });
  }

  const menu = await getWeeklyMenuById(userId, weeklyMenuId);
  if (!menu) throw new Error("No se pudo recargar el menú");
  return menu;
}
