import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

const ingredientSchema = z.object({
  name: z.string().trim().min(1).max(80),
  quantity: z.number().positive().nullable().optional(),
  unit: z.string().trim().max(20).nullable().optional(),
});

const dishSchema = z.object({
  name: z.string().trim().min(1).max(100),
  category: z.enum(["PLATO_UNICO", "PRIMERO", "SEGUNDO", "ACOMPANAMIENTO"]),
  mealType: z.enum(["COMIDA", "CENA", "AMBAS"]),
  yieldsTwoMeals: z.boolean().default(false),
  active: z.boolean().default(true),
  ingredients: z.array(ingredientSchema).default([]),
});

const activeSchema = z.object({ active: z.boolean() });

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const dish = await prisma.dish.findFirst({
    where: { id: params.id, userId },
    include: { ingredients: { orderBy: { order: "asc" } } },
  });
  if (!dish) return NextResponse.json({ error: "Plato no encontrado" }, { status: 404 });
  return NextResponse.json(dish);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null);

  // Toggle rápido de disponibilidad (solo { active }) sin tener que reenviar
  // el plato entero.
  const activeOnly = activeSchema.safeParse(body);
  if (activeOnly.success && body && Object.keys(body).length === 1) {
    const { count } = await prisma.dish.updateMany({
      where: { id: params.id, userId },
      data: { active: activeOnly.data.active },
    });
    if (count === 0) return NextResponse.json({ error: "Plato no encontrado" }, { status: 404 });
    const dish = await prisma.dish.findUnique({
      where: { id: params.id },
      include: { ingredients: { orderBy: { order: "asc" } } },
    });
    return NextResponse.json(dish);
  }

  const parsed = dishSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const { ingredients, ...data } = parsed.data;

  const owned = await prisma.dish.findFirst({ where: { id: params.id, userId }, select: { id: true } });
  if (!owned) return NextResponse.json({ error: "Plato no encontrado" }, { status: 404 });

  try {
    const dish = await prisma.$transaction(async (tx) => {
      await tx.dishIngredient.deleteMany({ where: { dishId: params.id } });
      return tx.dish.update({
        where: { id: params.id },
        data: {
          ...data,
          ingredients: { create: ingredients.map((ing, i) => ({ ...ing, order: i })) },
        },
        include: { ingredients: { orderBy: { order: "asc" } } },
      });
    });
    return NextResponse.json(dish);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Plato no encontrado" }, { status: 404 });
    }
    throw err;
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const owned = await prisma.dish.findFirst({ where: { id: params.id, userId }, select: { id: true } });
  if (!owned) return NextResponse.json({ error: "Plato no encontrado" }, { status: 404 });

  try {
    await prisma.dish.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") return NextResponse.json({ error: "Plato no encontrado" }, { status: 404 });
      if (err.code === "P2003") {
        return NextResponse.json(
          { error: "No se puede eliminar: el plato aparece en algún menú semanal ya generado." },
          { status: 409 }
        );
      }
    }
    throw err;
  }
}
