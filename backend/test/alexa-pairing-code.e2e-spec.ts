import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { PairingCodeSource } from "../src/alexa/pairing-code-source";
import { FakeClock } from "../src/common/clock/fake-clock";
import { messages } from "../src/messages/catalog";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

const MISSING_THERAPIST_ID = "5d2c8e41-9b7a-4f36-8c1d-2e5f7a9b0c3d";
const NOW = new Date("2026-10-22T13:00:00.000Z");
const TEN_MINUTES_LATER = new Date("2026-10-22T13:10:00.000Z");
const ONE_HOUR_LATER = new Date("2026-10-22T14:00:00.000Z");
const SEVENTY_MINUTES_LATER = new Date("2026-10-22T14:10:00.000Z");

class ScriptedPairingCodeSource implements PairingCodeSource {
  private queue: string[] = [];

  script(...codes: string[]): void {
    this.queue = [...codes];
  }

  next(): string {
    const code = this.queue.shift();
    if (!code) throw new RangeError("No scripted pairing code left");
    return code;
  }
}

describe("Alexa pairing code (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let hrId: string;
  let therapistId: string;
  const codes = new ScriptedPairingCodeSource();
  const clock = new FakeClock(NOW);

  const generateCode = (id: string) =>
    request(app.getHttpServer()).post(`/api/therapists/${id}/alexa-pairing-code`).set("x-user-id", hrId);

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp({ clock, pairingCodeSource: codes }));
  });

  beforeEach(async () => {
    clock.set(NOW);
    await truncateAllTables(prisma);
    hrId = (await prisma.user.create({ data: { email: "hr@example.com", name: "Helena Rocha", role: "HR" } })).id;
    const therapistUser = await prisma.user.create({
      data: { email: "bruno@example.com", name: "Bruno Lima", role: "THERAPIST" },
    });
    therapistId = (await prisma.therapist.create({ data: { userId: therapistUser.id } })).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("TK-03.08 RF-17: stores and returns a six-digit code valid for 60 minutes", async () => {
    codes.script("842915");

    const response = await generateCode(therapistId).expect(201);

    expect(response.body).toEqual({ code: "842915", therapistId, expiresAt: ONE_HOUR_LATER.toISOString() });
    expect(await prisma.alexaPairingCode.findMany()).toEqual([
      expect.objectContaining({
        code: "842915",
        therapistId,
        createdById: hrId,
        expiresAt: ONE_HOUR_LATER,
        consumedAt: null,
      }),
    ]);
  });

  it("TK-03.08 RF-17: refuses an inactive therapist and stores nothing", async () => {
    codes.script("842915");
    await prisma.user.updateMany({ where: { role: "THERAPIST" }, data: { status: "INACTIVE" } });

    const response = await generateCode(therapistId).expect(400);

    expect(response.body.message).toBe(messages.errors.therapistInactive);
    expect(await prisma.alexaPairingCode.count()).toBe(0);
    expect(await prisma.auditEvent.count()).toBe(0);
  });

  it("TK-03.08 RF-17: refuses a therapist that does not exist and stores nothing", async () => {
    codes.script("842915");

    const response = await generateCode(MISSING_THERAPIST_ID).expect(404);

    expect(response.body.message).toBe(messages.errors.therapistNotFound);
    expect(await prisma.alexaPairingCode.count()).toBe(0);
  });

  it("TK-03.08 RF-17: draws another code when the drawn one is already waiting to be used", async () => {
    const otherTherapistUser = await prisma.user.create({
      data: { email: "diana@example.com", name: "Diana Rocha", role: "THERAPIST" },
    });
    const otherTherapistId = (await prisma.therapist.create({ data: { userId: otherTherapistUser.id } })).id;
    codes.script("842915");
    await generateCode(otherTherapistId).expect(201);
    codes.script("842915", "315407");

    const response = await generateCode(therapistId).expect(201);

    expect(response.body.code).toBe("315407");
  });

  it("TK-03.08 RF-17: expires the therapist's previous unused code when a new one is generated", async () => {
    codes.script("842915");
    await generateCode(therapistId).expect(201);
    clock.advanceMinutes(10);
    codes.script("315407");

    await generateCode(therapistId).expect(201);

    const stored = await prisma.alexaPairingCode.findMany({ orderBy: { createdAt: "asc" } });
    expect(stored).toEqual([
      expect.objectContaining({ code: "842915", expiresAt: TEN_MINUTES_LATER }),
      expect.objectContaining({ code: "315407", expiresAt: SEVENTY_MINUTES_LATER }),
    ]);
  });

  it("TK-03.08 RF-17: leaves one active code when two generations for the same therapist run at once", async () => {
    codes.script("842915", "315407");

    await Promise.all([generateCode(therapistId).expect(201), generateCode(therapistId).expect(201)]);

    const active = await prisma.alexaPairingCode.count({ where: { consumedAt: null, expiresAt: { gt: NOW } } });
    expect(active).toBe(1);
  });

  it("TK-03.08 RNF-04: audits the generation without the code", async () => {
    codes.script("842915");

    await generateCode(therapistId).expect(201);

    const events = await prisma.auditEvent.findMany();
    expect(events).toEqual([
      expect.objectContaining({
        actorId: hrId,
        action: "ALEXA_PAIRING_CODE_GENERATED",
        entityType: "AlexaPairingCode",
        data: { therapistId, expiresAt: ONE_HOUR_LATER.toISOString(), expiredPreviousCodes: 0 },
      }),
    ]);
    expect(JSON.stringify(events)).not.toContain("842915");
  });
});
