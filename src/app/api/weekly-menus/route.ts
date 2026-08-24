import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/session";
import { createWeeklyMenu, getWeeklyMenu } from "@/lib/menuService";
import { mondayOf, parseDateOnly } from "@/lib/dates";

export async function GET(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const weekStartParam = req.nextUrl.searchParams.get("weekStart");
  if (!weekStartParam) {
    return NextResponse.json({ error: "Falta el parámetro weekStart" }, { status: 400 });
  }

  const weekStart = mondayOf(parseDateOnly(weekStartParam));
  const menu = await getWeeklyMenu(userId, weekStart);
  if (!menu) return NextResponse.json(null);
  return NextResponse.json(menu);
}

const createSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  force: z.boolean().optional(),
  excludedSlots: z
    .array(z.object({ dayOfWeek: z.number().int().min(0).max(6), mealType: z.enum(["COMIDA", "CENA"]) }))
    .optional(),
});

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const weekStart = mondayOf(parseDateOnly(parsed.data.weekStart));
  const excludedSlots = new Set(
    (parsed.data.excludedSlots ?? []).map((s) => `${s.dayOfWeek}-${s.mealType}`)
  );

  try {
    const menu = await createWeeklyMenu(userId, weekStart, parsed.data.force ?? false, excludedSlots);
    return NextResponse.json(menu, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "ALREADY_EXISTS") {
      return NextResponse.json({ error: "Ya existe un menú para esa semana." }, { status: 409 });
    }
    throw err;
  }
}
