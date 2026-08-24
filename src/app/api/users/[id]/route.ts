import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId, isAdminUser } from "@/lib/session";

type Params = { params: { id: string } };

const patchSchema = z.object({
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").max(72),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (userId !== params.id && !(await isAdminUser(userId))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.user.update({ where: { id: params.id }, data: { passwordHash } });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!(await isAdminUser(userId))) {
    return NextResponse.json({ error: "Solo un administrador puede eliminar usuarios." }, { status: 403 });
  }

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const total = await prisma.user.count();
  if (total <= 1) {
    return NextResponse.json({ error: "No se puede eliminar el último usuario." }, { status: 409 });
  }

  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
