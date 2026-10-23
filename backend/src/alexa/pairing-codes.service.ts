import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, UserStatus } from "@prisma/client";
import { CLOCK, Clock } from "../common/clock/clock";
import { messages } from "../messages/catalog";
import { PrismaService } from "../prisma/prisma.service";
import { PairingCodeDto } from "./dto/pairing-code.dto";
import { PAIRING_CODE_SOURCE, PairingCodeSource } from "./pairing-code-source";
import { TherapistInactiveException } from "./therapist-inactive.exception";

const PAIRING_CODE_VALIDITY_MS = 60 * 60_000;
const MAX_CODE_DRAWS = 5;
const UNIQUE_VIOLATION = "P2002";
const AUDIT_ACTION = "ALEXA_PAIRING_CODE_GENERATED";
const AUDIT_ENTITY = "AlexaPairingCode";

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION;

type PairingCodeRequest = Readonly<{ actorId: string; therapistId: string }>;

@Injectable()
export class PairingCodesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(PAIRING_CODE_SOURCE) private readonly codeSource: PairingCodeSource,
  ) {}

  generate(actorId: string, therapistId: string): Promise<PairingCodeDto> {
    return this.storeWithUniqueCode({ actorId, therapistId });
  }

  private async storeWithUniqueCode(request: PairingCodeRequest, draw = 1): Promise<PairingCodeDto> {
    try {
      return await this.store(request, this.codeSource.next());
    } catch (error) {
      const canDrawAgain = isUniqueViolation(error) && draw < MAX_CODE_DRAWS;
      if (!canDrawAgain) throw error;
      return this.storeWithUniqueCode(request, draw + 1);
    }
  }

  private store({ actorId, therapistId }: PairingCodeRequest, code: string): Promise<PairingCodeDto> {
    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + PAIRING_CODE_VALIDITY_MS);
    return this.prisma.$transaction(async (transaction) => {
      await this.lockActiveTherapist(therapistId, transaction);
      const expired = await transaction.alexaPairingCode.updateMany({
        where: { therapistId, consumedAt: null, expiresAt: { gt: now } },
        data: { expiresAt: now },
      });
      const { id, ...pairingCode } = await transaction.alexaPairingCode.create({
        data: { code, therapistId, createdById: actorId, expiresAt },
        select: { id: true, code: true, therapistId: true, expiresAt: true },
      });
      await transaction.auditEvent.create({
        data: {
          actorId,
          action: AUDIT_ACTION,
          entityType: AUDIT_ENTITY,
          entityId: id,
          data: { therapistId, expiresAt: expiresAt.toISOString(), expiredPreviousCodes: expired.count },
        },
      });
      return pairingCode;
    });
  }

  private async lockActiveTherapist(id: string, transaction: Prisma.TransactionClient): Promise<void> {
    await transaction.$queryRaw`SELECT id FROM therapists WHERE id = ${id}::uuid FOR UPDATE`;
    const therapist = await transaction.therapist.findUnique({ where: { id }, select: { user: true } });
    if (!therapist) throw new NotFoundException(messages.errors.therapistNotFound);
    if (therapist.user.status !== UserStatus.ACTIVE) throw new TherapistInactiveException();
  }
}
