import { PrismaClient } from "@prisma/client";

const DOCKER_COMPOSE_TEST_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5433/pausa_massoterapia_test?schema=public";
const TEST_DATABASE_SUFFIX = "_test";
const MIGRATIONS_TABLE = "_prisma_migrations";

export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL?.trim() || DOCKER_COMPOSE_TEST_DATABASE_URL;
  assertIsTestDatabase(url);
  return url;
}

export function assertIsTestDatabase(url: string): void {
  const databaseName = new URL(url).pathname.slice(1);
  if (!databaseName.endsWith(TEST_DATABASE_SUFFIX)) {
    throw new Error(
      `O banco dos testes e2e precisa terminar em "${TEST_DATABASE_SUFFIX}"; recebido "${databaseName}".`,
    );
  }
}

export async function truncateAllTables(prisma: PrismaClient): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> ${MIGRATIONS_TABLE}`;
  if (tables.length === 0) return;
  const names = tables.map(({ tablename }) => `"public"."${tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
}
