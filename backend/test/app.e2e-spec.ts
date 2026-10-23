import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { messages } from "../src/messages/catalog";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

describe("App (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it("answers the liveness check under the /api prefix", async () => {
    await request(app.getHttpServer()).get("/api/health").expect(200, { status: "ok" });
  });

  it("reports ready when the test database is reachable", async () => {
    await request(app.getHttpServer()).get("/api/health/ready").expect(200, { status: "ready" });
  });

  it("returns the request id it received", async () => {
    const response = await request(app.getHttpServer()).get("/api/health").set("x-request-id", "e2e-request");

    expect(response.headers["x-request-id"]).toBe("e2e-request");
  });

  it("rejects a protected route without x-user-id with the catalog message", async () => {
    const response = await request(app.getHttpServer()).get("/api/me").expect(401);

    expect(response.body.message).toBe(messages.errors.notIdentified);
  });

  it("identifies a user stored in the test database by x-user-id", async () => {
    const user = await prisma.user.create({
      data: { email: "ana@example.com", name: "Ana Souza", role: "EMPLOYEE" },
    });

    const response = await request(app.getHttpServer()).get("/api/me").set("x-user-id", user.id).expect(200);

    expect(response.body).toMatchObject({ id: user.id, name: "Ana Souza" });
  });

  it("starts each test with empty tables", async () => {
    await expect(prisma.user.count()).resolves.toBe(0);
  });
});
