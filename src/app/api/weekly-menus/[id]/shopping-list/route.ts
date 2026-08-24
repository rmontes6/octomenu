import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { getWeeklyMenuById, pruneOldShoppingListChecks } from "@/lib/menuService";
import { buildShoppingList } from "@/lib/shoppingList";

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await pruneOldShoppingListChecks(userId);

  const menu = await getWeeklyMenuById(userId, params.id);
  if (!menu) return NextResponse.json({ error: "Menú no encontrado" }, { status: 404 });

  const checks = await prisma.shoppingListCheck.findMany({ where: { weeklyMenuId: params.id } });
  const checkedByKey = new Map(checks.map((c) => [c.itemKey, c.checked]));

  const items = buildShoppingList(menu.entries).map((item) => ({
    ...item,
    checked: checkedByKey.get(item.itemKey) ?? false,
  }));

  return NextResponse.json(items);
}

const patchSchema = z.object({
  itemKey: z.string().min(1),
  checked: z.boolean(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const menu = await getWeeklyMenuById(userId, params.id);
  if (!menu) return NextResponse.json({ error: "Menú no encontrado" }, { status: 404 });

  const check = await prisma.shoppingListCheck.upsert({
    where: { weeklyMenuId_itemKey: { weeklyMenuId: params.id, itemKey: parsed.data.itemKey } },
    update: { checked: parsed.data.checked },
    create: { weeklyMenuId: params.id, itemKey: parsed.data.itemKey, checked: parsed.data.checked },
  });

  return NextResponse.json(check);
}
