import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/session";
import { addEntry } from "@/lib/menuService";

type Params = { params: { id: string } };

const addSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  mealType: z.enum(["COMIDA", "CENA"]),
  slot: z.enum(["PLATO_UNICO", "PRIMERO", "SEGUNDO", "ACOMPANAMIENTO"]),
  dishId: z.string().min(1),
});

export async function POST(req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const menu = await addEntry(userId, params.id, parsed.data);
    return NextResponse.json(menu, { status: 201 });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Menú no encontrado" }, { status: 404 });
      }
      if (err.message === "DISH_NOT_FOUND") {
        return NextResponse.json({ error: "Plato no encontrado" }, { status: 404 });
      }
      if (err.message === "CATEGORY_MISMATCH") {
        return NextResponse.json({ error: "El plato elegido no pertenece a esa categoría" }, { status: 400 });
      }
      if (err.message === "SLOT_OCCUPIED") {
        return NextResponse.json({ error: "Ese hueco ya tiene un plato asignado" }, { status: 409 });
      }
    }
    throw err;
  }
}
