import { INestApplication } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import * as request from "supertest";
import { messages } from "../src/messages/catalog";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

const ROLES = Object.values(UserRole);

describe("GET /me (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const createUser = (role: UserRole, name = "Ana Souza") =>
    prisma.user.create({ data: { email: `${role.toLowerCase()}@example.com`, name, role } });

  const getMe = (userId?: string) => {
    const pending = request(app.getHttpServer()).get("/api/me");
    return userId ? pending.set("x-user-id", userId) : pending;
  };

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it("TK-02.02: describes a therapist with profile, effective roles and the therapist ID", async () => {
    const user = await createUser("THERAPIST", "Marina Castro");
    const therapist = await prisma.therapist.create({ data: { userId: user.id } });

    const response = await getMe(user.id).expect(200);

    expect(response.body).toEqual({
      id: user.id,
      role: "THERAPIST",
      effectiveRoles: ["THERAPIST"],
      name: "Marina Castro",
      firstName: "Marina",
      therapistId: therapist.id,
      spokenText: "Você entrou como Marina, massoterapeuta.",
    });
  });

  it("TK-02.02: gives ADMIN the inherited HR role and no therapist ID", async () => {
    const admin = await createUser("ADMIN", "Carlos Mendes");

    const response = await getMe(admin.id).expect(200);

    expect(response.body).toEqual({
      id: admin.id,
      role: "ADMIN",
      effectiveRoles: ["ADMIN", "HR"],
      name: "Carlos Mendes",
      firstName: "Carlos",
      therapistId: null,
      spokenText: "Você entrou como Carlos, suporte.",
    });
  });

  it("RNF-04: treats an employee by the first name and leaves the email out", async () => {
    const employee = await createUser("EMPLOYEE", "Beatriz Lima");

    const response = await getMe(employee.id).expect(200);

    expect(response.body.firstName).toBe("Beatriz");
    expect(response.body.spokenText).toBe("Você entrou como Beatriz, colaborador.");
    expect(response.body).not.toHaveProperty("email");
    expect(JSON.stringify(response.body)).not.toContain("@example.com");
  });

  it("TK-02.02: names HR as RH in the spoken text", async () => {
    const hr = await createUser("HR", "Paula Reis");

    const response = await getMe(hr.id).expect(200);

    expect(response.body).toMatchObject({ effectiveRoles: ["HR"], therapistId: null });
    expect(response.body.spokenText).toBe("Você entrou como Paula, RH.");
  });

  it.each(ROLES)("TK-02.02: answers 200 to %s", async (role) => {
    const user = await createUser(role);

    await getMe(user.id).expect(200);
  });

  it.each(ROLES)("TK-02.02: speaks one sentence starting with the first name only for %s", async (role) => {
    const user = await createUser(role, " Ana  Souza ");

    const { spokenText } = (await getMe(user.id).expect(200)).body as { spokenText: string };

    expect(spokenText.startsWith("Você entrou como Ana, ")).toBe(true);
    expect(spokenText).not.toContain("Souza");
    expect(spokenText.match(/\./g)).toHaveLength(1);
    expect(spokenText).toMatch(/\.$/);
  });

  it("TK-02.02: asks an anonymous caller to identify", async () => {
    const response = await getMe().expect(401);

    expect(response.body.message).toBe(messages.errors.notIdentified);
  });

  it("TK-02.02: removes the legacy GET /booking/me", async () => {
    const employee = await createUser("EMPLOYEE");

    await request(app.getHttpServer()).get("/api/booking/me").set("x-user-id", employee.id).expect(404);
  });
});
