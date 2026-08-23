import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const username = process.env.SEED_USERNAME;
  const password = process.env.SEED_PASSWORD;

  if (!username || !password) {
    console.log("SEED_USERNAME / SEED_PASSWORD no definidos, se omite el seed de usuario.");
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Se hace upsert en cada arranque para que el usuario se autorepare si se
  // borró la base de datos, igual que en trip2millionaire.
  const user = await prisma.user.upsert({
    where: { username },
    update: {},
    create: { username, passwordHash },
  });

  console.log(`Usuario listo: ${user.username} (id ${user.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
