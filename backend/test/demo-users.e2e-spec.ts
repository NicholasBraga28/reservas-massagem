import { INestApplication } from "@nestjs/common";
import { UserRole, UserStatus } from "@prisma/client";
import * as request from "supertest";
import { seedDemoData } from "../prisma/demo-seed";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

type DemoUserItem = Readonly<{
  id: string;
  name: string;
  firstName: string;
  role: UserRole;
  roleLabel: string;
  spokenText: string;
}>;

describe("GET /auth/demo-users (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userCount = 0;

  const createUser = (role: UserRole, name: string, status: UserStatus = "ACTIVE") => {
    userCount += 1;
    return prisma.user.create({ data: { email: `user-${userCount}@example.com`, name, role, status } });
  };

  const listDemoUsers = async (): Promise<DemoUserItem[]> =>
    (await request(app.getHttpServer()).get("/api/auth/demo-users").expect(200)).body;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it("D-12: lists active users grouped by role, then by name in pt-BR order, without identification", async () => {
    await createUser("ADMIN", "Eduardo Santos");
    await createUser("HR", "Juliana Ramos");
    await createUser("THERAPIST", "Marina Castro");
    await createUser("EMPLOYEE", "Rafael Pires");
    await createUser("THERAPIST", "Felipe Nogueira");
    await createUser("EMPLOYEE", "Álvaro Dias");
    await createUser("EMPLOYEE", "Beatriz Lima");

    const users = await listDemoUsers();

    expect(users.map(({ name, role }) => [role, name])).toEqual([
      ["EMPLOYEE", "Álvaro Dias"],
      ["EMPLOYEE", "Beatriz Lima"],
      ["EMPLOYEE", "Rafael Pires"],
      ["THERAPIST", "Felipe Nogueira"],
      ["THERAPIST", "Marina Castro"],
      ["HR", "Juliana Ramos"],
      ["ADMIN", "Eduardo Santos"],
    ]);
  });

  it("D-12: leaves inactive users out", async () => {
    await createUser("EMPLOYEE", "Beatriz Lima");
    await createUser("EMPLOYEE", "Rafael Pires", "INACTIVE");

    const users = await listDemoUsers();

    expect(users.map(({ name }) => name)).toEqual(["Beatriz Lima"]);
  });

  it("RNF-04: describes each user without email, Google subject or dates", async () => {
    const therapist = await prisma.user.create({
      data: { email: "marina@example.com", name: "Marina Castro", role: "THERAPIST", googleSubject: "google-123" },
    });

    const users = await listDemoUsers();

    expect(users).toEqual([
      {
        id: therapist.id,
        name: "Marina Castro",
        firstName: "Marina",
        role: "THERAPIST",
        roleLabel: "Massoterapeuta",
        spokenText: "Marina Castro, massoterapeuta.",
      },
    ]);
    expect(JSON.stringify(users)).not.toMatch(/@example\.com|google-123|email|createdAt|updatedAt/);
  });

  it.each<[UserRole, string, string]>([
    ["EMPLOYEE", "Colaborador", "Beatriz Lima, colaborador."],
    ["THERAPIST", "Massoterapeuta", "Beatriz Lima, massoterapeuta."],
    ["HR", "RH", "Beatriz Lima, RH."],
    ["ADMIN", "Suporte", "Beatriz Lima, suporte."],
  ])("D-12: labels %s as %s and speaks the name first", async (role, roleLabel, spokenText) => {
    await createUser(role, "Beatriz Lima");

    const [user] = await listDemoUsers();

    expect(user).toMatchObject({ roleLabel, spokenText });
    expect(user.spokenText.startsWith(user.name)).toBe(true);
    expect(user.spokenText.match(/\./g)).toHaveLength(1);
    expect(user.spokenText).toMatch(/\.$/);
  });

  it("D-12: shows a user created after the first call", async () => {
    await createUser("EMPLOYEE", "Beatriz Lima");
    await listDemoUsers();

    await createUser("HR", "Juliana Ramos");

    expect((await listDemoUsers()).map(({ name }) => name)).toEqual(["Beatriz Lima", "Juliana Ramos"]);
  });

  it("D-12: lists the seven demonstration users of the seed with their roles", async () => {
    await seedDemoData(prisma);

    const users = await listDemoUsers();

    expect(users.map(({ id, role }) => [role, id])).toEqual([
      ["EMPLOYEE", "00000000-0000-4000-8000-000000000103"],
      ["EMPLOYEE", "00000000-0000-4000-8000-000000000105"],
      ["EMPLOYEE", "00000000-0000-4000-8000-000000000104"],
      ["THERAPIST", "00000000-0000-4000-8000-000000000102"],
      ["THERAPIST", "00000000-0000-4000-8000-000000000101"],
      ["HR", "00000000-0000-4000-8000-000000000106"],
      ["ADMIN", "00000000-0000-4000-8000-000000000107"],
    ]);
  });

  describe("with AUTH_MODE=google", () => {
    let googleApp: INestApplication;

    beforeAll(async () => {
      ({ app: googleApp } = await createTestApp({ authMode: "google" }));
    });

    afterAll(async () => {
      await googleApp.close();
    });

    it("D-12: answers 404, like a route that does not exist", async () => {
      await createUser("EMPLOYEE", "Beatriz Lima");

      const server = googleApp.getHttpServer();

      const response = await request(server).get("/api/auth/demo-users").expect(404);
      const missingRoute = await request(server).get("/api/auth/route-that-does-not-exist").expect(404);

      expect(response.body).toEqual({
        ...missingRoute.body,
        message: "Cannot GET /api/auth/demo-users",
      });
      expect(missingRoute.body.message).toBe("Cannot GET /api/auth/route-that-does-not-exist");
    });
  });
});
