import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { rerollEntry } from "@/lib/menuService";

type Params = { params: { id: string; entryId: string } };

export async function POST(_req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const menu = await rerollEntry(userId, params.id, params.entryId);
    return NextResponse.json(menu);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Hueco del menú no encontrado" }, { status: 404 });
      }
      if (err.message === "NO_ALTERNATIVES") {
        return NextResponse.json(
          { error: "No hay ningún otro plato disponible de esa categoría para sustituirlo." },
          { status: 409 }
        );
      }
    }
    throw err;
  }
}
