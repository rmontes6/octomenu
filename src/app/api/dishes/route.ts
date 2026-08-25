import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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
  season: z.enum(["VERANO", "INVIERNO", "AMBAS"]).default("AMBAS"),
  foodGroup: z.enum(["CARNE", "PESCADO", "VERDURA", "PASTA_ARROZ", "LEGUMBRE", "HUEVO", "OTRO"]).default("OTRO"),
  yieldsTwoMeals: z.boolean().default(false),
  wantsAcompanamiento: z.boolean().default(true),
  ingredients: z.array(ingredientSchema).default([]),
});

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const dishes = await prisma.dish.findMany({
    where: { userId },
    include: { ingredients: { orderBy: { order: "asc" } } },
    orderBy: [{ name: "asc" }],
  });
  return NextResponse.json(dishes);
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = dishSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const { ingredients, ...data } = parsed.data;
  const dish = await prisma.dish.create({
    data: {
      ...data,
      userId,
      ingredients: {
        create: ingredients.map((ing, i) => ({ ...ing, order: i })),
      },
    },
    include: { ingredients: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json(dish, { status: 201 });
}
