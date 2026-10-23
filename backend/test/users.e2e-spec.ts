import { INestApplication } from "@nestjs/common";
import { UserRole, UserStatus } from "@prisma/client";
import * as request from "supertest";
import { messages } from "../src/messages/catalog";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

describe("Users (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let hrId: string;

  const createUser = (name: string, role: UserRole, status: UserStatus = "ACTIVE") =>
    prisma.user.create({
      data: { email: `${name.toLowerCase().replace(/\s/g, ".")}@example.com`, name, role, status },
    });

  const postUser = (body: Record<string, string>) =>
    request(app.getHttpServer()).post("/api/users").set("x-user-id", hrId).send(body);

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
    hrId = (await createUser("Helena Rocha", "HR")).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("TK-03.01 RF-20: creates an active therapist with its therapist profile and an audit event", async () => {
    const response = await postUser({
      email: "marina.costa@empresa.com",
      name: "Marina Costa",
      role: "THERAPIST",
    }).expect(201);

    const therapist = await prisma.therapist.findUniqueOrThrow({ where: { userId: response.body.id } });
    expect(response.body).toEqual({
      id: expect.any(String),
      email: "marina.costa@empresa.com",
      name: "Marina Costa",
      role: "THERAPIST",
      status: "ACTIVE",
      therapistId: therapist.id,
      createdAt: expect.any(String),
    });
    const events = await prisma.auditEvent.findMany({ where: { entityId: response.body.id } });
    expect(events).toEqual([expect.objectContaining({ actorId: hrId, action: "USER_CREATED", entityType: "User" })]);
  });

  it("TK-03.01 RF-20: refuses an e-mail already in use and records nothing", async () => {
    await createUser("Marina Costa", "EMPLOYEE");

    const response = await postUser({
      email: "marina.costa@example.com",
      name: "Marina Souza",
      role: "THERAPIST",
    }).expect(409);

    expect(response.body.message).toBe(messages.errors.userEmailAlreadyExists);
    expect(await prisma.user.count()).toBe(2);
    expect(await prisma.therapist.count()).toBe(0);
    expect(await prisma.auditEvent.count()).toBe(0);
  });

  it("TK-03.01 RF-20: treats an e-mail with other capitals or surrounding spaces as already in use", async () => {
    await createUser("Marina Costa", "EMPLOYEE");

    const response = await postUser({
      email: " Marina.Costa@Example.com ",
      name: "Marina Souza",
      role: "EMPLOYEE",
    }).expect(409);

    expect(response.body.message).toBe(messages.errors.userEmailAlreadyExists);
  });

  it("TK-03.01 RF-20: stores the e-mail in lower case and the name without surrounding spaces", async () => {
    const response = await postUser({
      email: "Paula.Reis@Empresa.com",
      name: "  Paula Reis  ",
      role: "EMPLOYEE",
    }).expect(201);

    expect(response.body).toEqual(expect.objectContaining({ email: "paula.reis@empresa.com", name: "Paula Reis" }));
  });

  describe("listing", () => {
    const listUsers = (query: Record<string, string> = {}) =>
      request(app.getHttpServer()).get("/api/users").query(query).set("x-user-id", hrId).expect(200);

    const namesOf = (body: { name: string }[]) => body.map(({ name }) => name);

    beforeEach(async () => {
      await createUser("Bruno Lima", "EMPLOYEE");
      await createUser("Álvaro Nunes", "EMPLOYEE", "INACTIVE");
      await createUser("Carla Dias", "ADMIN");
      await postUser({ email: "tereza.alves@example.com", name: "Tereza Alves", role: "THERAPIST" }).expect(201);
    });

    it("TK-03.01 RF-20: lists every user in alphabetical order by name", async () => {
      const response = await listUsers();

      expect(namesOf(response.body)).toEqual([
        "Álvaro Nunes",
        "Bruno Lima",
        "Carla Dias",
        "Helena Rocha",
        "Tereza Alves",
      ]);
      expect(response.body.find(({ name }: { name: string }) => name === "Tereza Alves")).toEqual({
        id: expect.any(String),
        email: "tereza.alves@example.com",
        name: "Tereza Alves",
        role: "THERAPIST",
        status: "ACTIVE",
        therapistId: expect.any(String),
        createdAt: expect.any(String),
      });
    });

    it("TK-03.01 RF-20: filters by role", async () => {
      const response = await listUsers({ role: "EMPLOYEE" });

      expect(namesOf(response.body)).toEqual(["Álvaro Nunes", "Bruno Lima"]);
    });

    it("TK-03.01 RF-20: filters by status", async () => {
      const response = await listUsers({ status: "INACTIVE" });

      expect(namesOf(response.body)).toEqual(["Álvaro Nunes"]);
    });

    it("TK-03.01 RF-20: searches by part of the name or e-mail, ignoring case", async () => {
      const byName = await listUsers({ search: "lima" });
      const byEmail = await listUsers({ search: "TEREZA.ALVES@" });

      expect(namesOf(byName.body)).toEqual(["Bruno Lima"]);
      expect(namesOf(byEmail.body)).toEqual(["Tereza Alves"]);
    });

    it("TK-03.01 RF-20: combines the filters", async () => {
      const response = await listUsers({ role: "EMPLOYEE", status: "ACTIVE", search: "a" });

      expect(namesOf(response.body)).toEqual(["Bruno Lima"]);
    });

    it("TK-03.01 RF-20: refuses an unknown role or status", async () => {
      await request(app.getHttpServer())
        .get("/api/users")
        .query({ role: "MANAGER" })
        .set("x-user-id", hrId)
        .expect(400);
      await request(app.getHttpServer()).get("/api/users").query({ status: "GONE" }).set("x-user-id", hrId).expect(400);
    });
  });

  describe("activation", () => {
    const MISSING_USER_ID = "8b0e2f51-7c1a-4d55-9b0e-2f517c1a4d55";

    const changeStatus = (userId: string, status: string) =>
      request(app.getHttpServer()).patch(`/api/users/${userId}/status`).set("x-user-id", hrId).send({ status });

    const demoUserIds = async (): Promise<string[]> => {
      const response = await request(app.getHttpServer()).get("/api/auth/demo-users").expect(200);
      return response.body.map(({ id }: { id: string }) => id);
    };

    it("TK-03.01 RF-20: deactivates an employee, who leaves the demo users and is no longer recognized", async () => {
      const employee = await createUser("Bruno Lima", "EMPLOYEE");

      const response = await changeStatus(employee.id, "INACTIVE").expect(200);

      expect(response.body).toEqual(expect.objectContaining({ id: employee.id, status: "INACTIVE" }));
      expect(await demoUserIds()).not.toContain(employee.id);
      const refused = await request(app.getHttpServer()).get("/api/me").set("x-user-id", employee.id).expect(401);
      expect(refused.body.message).toBe(messages.errors.identificationNotRecognized);
      const events = await prisma.auditEvent.findMany({ where: { entityId: employee.id } });
      expect(events).toEqual([
        expect.objectContaining({ actorId: hrId, action: "USER_DEACTIVATED", entityType: "User" }),
      ]);
    });

    it("TK-03.01 RF-20: reactivates an inactive user, who returns to the demo users", async () => {
      const employee = await createUser("Bruno Lima", "EMPLOYEE", "INACTIVE");

      const response = await changeStatus(employee.id, "ACTIVE").expect(200);

      expect(response.body).toEqual(expect.objectContaining({ id: employee.id, status: "ACTIVE" }));
      expect(await demoUserIds()).toContain(employee.id);
      await request(app.getHttpServer()).get("/api/me").set("x-user-id", employee.id).expect(200);
      const events = await prisma.auditEvent.findMany({ where: { entityId: employee.id } });
      expect(events).toEqual([
        expect.objectContaining({ actorId: hrId, action: "USER_ACTIVATED", entityType: "User" }),
      ]);
    });

    it("TK-03.01 RF-20: answers an unknown user with what to do", async () => {
      const response = await changeStatus(MISSING_USER_ID, "INACTIVE").expect(404);

      expect(response.body.message).toBe(messages.errors.userNotFound);
      expect(await prisma.auditEvent.count()).toBe(0);
    });

    it("TK-03.01 RF-20: refuses an unknown status", async () => {
      const employee = await createUser("Bruno Lima", "EMPLOYEE");

      await changeStatus(employee.id, "DELETED").expect(400);
    });
  });

  it("TK-03.01 RF-20: refuses an invalid e-mail or an empty name", async () => {
    await postUser({ email: "not-an-email", name: "Marina Costa", role: "EMPLOYEE" }).expect(400);
    await postUser({ email: "marina.costa@empresa.com", name: "", role: "EMPLOYEE" }).expect(400);
    await postUser({ email: "marina.costa@empresa.com", name: "   ", role: "EMPLOYEE" }).expect(400);
  });
});
