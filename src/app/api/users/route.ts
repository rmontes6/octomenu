import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId, isAdminUser } from "@/lib/session";

const createSchema = z.object({
  username: z.string().trim().toLowerCase().min(3, "El usuario debe tener al menos 3 caracteres").max(30),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").max(72),
});

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = await isAdminUser(userId);
  const users = await prisma.user.findMany({
    where: admin ? undefined : { id: userId },
    select: { id: true, username: true, createdAt: true, isAdmin: true },
    orderBy: { username: "asc" },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!(await isAdminUser(userId))) {
    return NextResponse.json({ error: "Solo un administrador puede crear usuarios." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const { username, password } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const created = await prisma.user.create({
      data: { username, passwordHash },
      select: { id: true, username: true, createdAt: true, isAdmin: true },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "Ya existe un usuario con ese nombre." }, { status: 409 });
    }
    throw err;
  }
}
