import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return null;

  // La sesión es un JWT firmado de larga duración; sigue siendo "válida"
  // aunque el usuario ya no exista en la base de datos (p.ej. tras un reset).
  // Se trata como no autenticado en vez de dejar que fallen las escrituras.
  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  return exists ? userId : null;
}
