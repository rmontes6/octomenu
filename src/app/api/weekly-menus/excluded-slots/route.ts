import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/session";
import { getExcludedSlots, setExcludedSlots } from "@/lib/menuService";
import { mondayOf, parseDateOnly } from "@/lib/dates";

export async function GET(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const weekStartParam = req.nextUrl.searchParams.get("weekStart");
  if (!weekStartParam) {
    return NextResponse.json({ error: "Falta el parámetro weekStart" }, { status: 400 });
  }

  const weekStart = mondayOf(parseDateOnly(weekStartParam));
  const slots = await getExcludedSlots(userId, weekStart);
  return NextResponse.json(slots);
}

const putSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slots: z.array(z.object({ dayOfWeek: z.number().int().min(0).max(6), mealType: z.enum(["COMIDA", "CENA"]) })),
});

export async function PUT(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const weekStart = mondayOf(parseDateOnly(parsed.data.weekStart));
  await setExcludedSlots(userId, weekStart, parsed.data.slots);
  const slots = await getExcludedSlots(userId, weekStart);
  return NextResponse.json(slots);
}
