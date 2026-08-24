import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/session";
import { moveEntry, removeEntry } from "@/lib/menuService";

type Params = { params: { id: string; entryId: string } };

const moveSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  mealType: z.enum(["COMIDA", "CENA"]),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = moveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const menu = await moveEntry(userId, params.id, params.entryId, parsed.data);
    return NextResponse.json(menu);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Hueco del menú no encontrado" }, { status: 404 });
      }
      if (err.message === "IS_LEFTOVER_COPY") {
        return NextResponse.json(
          { error: "Es la 2ª toma de otro día: resortea o quita el plato original en vez de moverla." },
          { status: 409 }
        );
      }
      if (err.message === "HAS_LEFTOVER_COPY") {
        return NextResponse.json(
          { error: "Este plato tiene una 2ª toma al día siguiente; quítala o cámbialo por otro antes de moverlo." },
          { status: 409 }
        );
      }
      if (err.message === "TARGET_IS_LEFTOVER_COPY" || err.message === "TARGET_HAS_LEFTOVER_COPY") {
        return NextResponse.json(
          { error: "El hueco de destino tiene una 2ª toma vinculada; no se puede intercambiar." },
          { status: 409 }
        );
      }
    }
    throw err;
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const menu = await removeEntry(userId, params.id, params.entryId);
    return NextResponse.json(menu);
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Hueco del menú no encontrado" }, { status: 404 });
    }
    throw err;
  }
}
