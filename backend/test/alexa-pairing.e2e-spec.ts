import { INestApplication } from "@nestjs/common";
import { AlexaDevice, Therapist, User } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

const AMAZON_DEVICE_ID = "amzn1.ask.device.AAAA";
const OTHER_AMAZON_DEVICE_ID = "amzn1.ask.device.BBBB";
const PAIRING_CODE = "482913";
const FAR_FUTURE_EXPIRY = new Date("2099-01-01T00:00:00Z");

describe("Alexa pairing tables (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let therapist: Therapist;
  let hrUser: User;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
    therapist = await createTherapist("bruno@example.com", "Bruno Lima");
    hrUser = await prisma.user.create({ data: { email: "carla@example.com", name: "Carla Dias", role: "HR" } });
  });

  afterAll(async () => {
    await app.close();
  });

  const createTherapist = async (email: string, name: string) => {
    const user = await prisma.user.create({ data: { email, name, role: "THERAPIST" } });
    return prisma.therapist.create({ data: { userId: user.id } });
  };

  const pairDevice = (deviceId: string, owner: Therapist) =>
    prisma.alexaDevice.create({ data: { deviceId, therapistId: owner.id } });

  const createPairingCode = (code: string) =>
    prisma.alexaPairingCode.create({
      data: { code, therapistId: therapist.id, createdById: hrUser.id, expiresAt: FAR_FUTURE_EXPIRY },
    });

  it("RF-17: rejects a second device with an already paired device_id", async () => {
    const diana = await createTherapist("diana@example.com", "Diana Rocha");
    await pairDevice(AMAZON_DEVICE_ID, therapist);

    const duplicate = pairDevice(AMAZON_DEVICE_ID, diana);

    await expect(duplicate).rejects.toThrow(/Unique constraint failed on the fields: \(`device_id`\)/);
  });

  it("RF-17: accepts a second device for a therapist who already has one", async () => {
    await pairDevice(AMAZON_DEVICE_ID, therapist);

    const secondDevice = pairDevice(OTHER_AMAZON_DEVICE_ID, therapist);

    await expect(secondDevice).resolves.toEqual(expect.objectContaining({ therapistId: therapist.id }));
  });

  it("RF-17: rejects a second unused pairing code with the same value", async () => {
    await createPairingCode(PAIRING_CODE);

    const duplicate = createPairingCode(PAIRING_CODE);

    await expect(duplicate).rejects.toThrow(/Unique constraint failed on the fields: \(`code`\)/);
  });

  it("RF-17: accepts a new pairing code with the value of an already consumed one", async () => {
    const device = await pairDevice(AMAZON_DEVICE_ID, therapist);
    const consumed = await createPairingCode(PAIRING_CODE);
    await prisma.alexaPairingCode.update({
      where: { id: consumed.id },
      data: { consumedAt: new Date(), consumedByDeviceId: device.id },
    });

    const reused = createPairingCode(PAIRING_CODE);

    await expect(reused).resolves.toEqual(expect.objectContaining({ code: PAIRING_CODE, consumedAt: null }));
  });

  it("RF-17: only one of two concurrent conditional updates consumes an unused, valid code", async () => {
    const [firstDevice, secondDevice] = await Promise.all([
      pairDevice(AMAZON_DEVICE_ID, therapist),
      pairDevice(OTHER_AMAZON_DEVICE_ID, therapist),
    ]);
    const pairingCode = await createPairingCode(PAIRING_CODE);
    const consumeBy = (device: AlexaDevice) => {
      const now = new Date();
      return prisma.alexaPairingCode.updateMany({
        where: { id: pairingCode.id, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now, consumedByDeviceId: device.id },
      });
    };

    const results = await Promise.all([consumeBy(firstDevice), consumeBy(secondDevice)]);

    const affectedRows = results.reduce((total, { count }) => total + count, 0);
    expect(affectedRows).toBe(1);
  });
});
