import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
  if (!email || !name)
    throw new Error("BOOTSTRAP_ADMIN_EMAIL e BOOTSTRAP_ADMIN_NAME são obrigatórios para o bootstrap.");
  const admin = await prisma.user.upsert({
    where: { email },
    update: { name, role: "ADMIN", status: "ACTIVE" },
    create: { email, name, role: "ADMIN" },
  });
  console.log(`Administrador inicial disponível: ${admin.email} (${admin.id})`);
}

main().finally(() => prisma.$disconnect());
