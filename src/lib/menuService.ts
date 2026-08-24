import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { entryKey, generateWeek } from "@/lib/menuGenerator";

const menuInclude = {
  entries: {
    include: { dish: { include: { ingredients: true } } },
    orderBy: [{ dayOfWeek: "asc" }, { mealType: "asc" }, { slot: "asc" }] as const,
  },
} satisfies Prisma.WeeklyMenuInclude;

export type WeeklyMenuWithEntries = Prisma.WeeklyMenuGetPayload<{ include: typeof menuInclude }>;

export async function getWeeklyMenu(userId: string, weekStart: Date): Promise<WeeklyMenuWithEntries | null> {
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
 */
export async function createWeeklyMenu(userId: string, weekStart: Date, force: boolean): Promise<WeeklyMenuWithEntries> {
  const existing = await prisma.weeklyMenu.findUnique({ where: { userId_weekStart: { userId, weekStart } } });
  if (existing && !force) {
    throw new Error("ALREADY_EXISTS");
  }

  const dishes = await prisma.dish.findMany({ where: { userId, active: true } });
  const planned = generateWeek(dishes);

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
  const owningMenu = await prisma.weeklyMenu.findUnique({ where: { id: weeklyMenuId }, select: { userId: true } });
  if (!owningMenu || owningMenu.userId !== userId) {
    throw new Error("NOT_FOUND");
  }

  const entry = await prisma.menuEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.weeklyMenuId !== weeklyMenuId) {
    throw new Error("NOT_FOUND");
  }

  if (entry.leftoverOfId) {
    return rerollEntry(userId, weeklyMenuId, entry.leftoverOfId);
  }

  const [allEntries, leftoverCopy, candidates] = await Promise.all([
    prisma.menuEntry.findMany({ where: { weeklyMenuId } }),
    prisma.menuEntry.findFirst({ where: { leftoverOfId: entry.id } }),
    prisma.dish.findMany({
      where: {
        userId,
        active: true,
        category: entry.slot,
        OR: [{ mealType: entry.mealType }, { mealType: "AMBAS" }],
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
