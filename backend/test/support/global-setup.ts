import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import { testDatabaseUrl } from "./test-database";

const PRISMA_CLI = require.resolve("prisma/build/index.js");

export default async function globalSetup(): Promise<void> {
  const url = testDatabaseUrl();
  await recreatePublicSchema(url);
  applyAllMigrations(url);
}

async function recreatePublicSchema(url: string): Promise<void> {
  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    await prisma.$executeRawUnsafe("DROP SCHEMA IF EXISTS public CASCADE");
    await prisma.$executeRawUnsafe("CREATE SCHEMA public");
  } catch (error) {
    throw new Error(
      `Banco dos testes e2e indisponível. Suba o container com "npm run test:db" e tente de novo. ${String(error)}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

function applyAllMigrations(url: string): void {
  execFileSync(process.execPath, [PRISMA_CLI, "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });
}
