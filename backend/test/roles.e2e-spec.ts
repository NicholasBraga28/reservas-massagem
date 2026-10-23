import { INestApplication } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import * as request from "supertest";
import { messages } from "../src/messages/catalog";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

describe("User roles (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const createUser = (role: UserRole) =>
    prisma.user.create({ data: { email: `${role.toLowerCase()}@example.com`, name: "Ana Souza", role } });

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(["COLLABORATOR", "SUPPORT"])("TK-01.01: the database rejects the role %s", async (role) => {
    const insert = prisma.$executeRaw`
      INSERT INTO users (id, email, name, role, updated_at)
      VALUES (gen_random_uuid(), 'invalid@example.com', 'Ana Souza', ${role}::user_role, now())`;

    await expect(insert).rejects.toThrow(/invalid input value for enum/);
  });

  it("TK-01.01: lets HR use the user registration route", async () => {
    const hr = await createUser("HR");

    const response = await request(app.getHttpServer()).get("/api/users").set("x-user-id", hr.id).expect(200);

    expect(response.body).toEqual([expect.objectContaining({ id: hr.id, role: "HR" })]);
  });

  it("TK-01.01: lets HR use the legacy indicators route", async () => {
    const hr = await createUser("HR");

    await request(app.getHttpServer())
      .get("/api/admin/kpis")
      .query({ from: "2026-10-01T00:00:00Z", to: "2026-11-01T00:00:00Z" })
      .set("x-user-id", hr.id)
      .expect(200);
  });

  it("TK-01.01: forbids an employee on the user registration route with the catalog message", async () => {
    const employee = await createUser("EMPLOYEE");

    const response = await request(app.getHttpServer()).get("/api/users").set("x-user-id", employee.id).expect(403);

    expect(response.body.message).toBe(messages.errors.accessDenied);
  });
});
