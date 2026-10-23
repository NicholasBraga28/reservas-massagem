import { randomUUID } from "node:crypto";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { CLOCK, Clock } from "../common/clock/clock";
import { messages } from "../messages/catalog";
import { PrismaService } from "../prisma/prisma.service";
import { CreateRoomDto } from "./dto/create-room.dto";
import { QueryRoomsDto } from "./dto/query-rooms.dto";
import { RegeneratedTokenDto } from "./dto/regenerated-token.dto";
import { RoomDto } from "./dto/room.dto";
import { RoomNameAlreadyExistsException } from "./room-name-already-exists.exception";

const UNIQUE_VIOLATION = "P2002";
const RECORD_NOT_FOUND = "P2025";

const hasPrismaCode = (error: unknown, code: string): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

const isUniqueViolation = (error: unknown): boolean => hasPrismaCode(error, UNIQUE_VIOLATION);

const isRecordNotFound = (error: unknown): boolean => hasPrismaCode(error, RECORD_NOT_FOUND);

const ROOM_SELECT = {
  id: true,
  name: true,
  locationId: true,
  active: true,
  checkInToken: true,
  location: { select: { code: true } },
} satisfies Prisma.RoomSelect;

type SelectedRoom = Prisma.RoomGetPayload<{ select: typeof ROOM_SELECT }>;

const NAME_LOCALE = "pt-BR";

const byName = (first: SelectedRoom, second: SelectedRoom): number =>
  first.name.localeCompare(second.name, NAME_LOCALE);

const toRoomDto = ({ location, ...room }: SelectedRoom): RoomDto => ({ ...room, locationCode: location.code });

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async list({ locationCode, active }: QueryRoomsDto): Promise<RoomDto[]> {
    const rooms = await this.prisma.room.findMany({
      where: { active, location: locationCode ? { code: locationCode } : undefined },
      select: ROOM_SELECT,
    });
    return rooms.sort(byName).map(toRoomDto);
  }

  async create(actorId: string, input: CreateRoomDto): Promise<RoomDto> {
    await this.assertLocationExists(input.locationId);
    const room = await this.createWithNewToken(input);
    await this.audit.record(actorId, "ROOM_CREATED", "Room", room.id, { locationId: room.locationId });
    return toRoomDto(room);
  }

  async regenerateToken(actorId: string, roomId: string): Promise<RegeneratedTokenDto> {
    const room = await this.replaceTokenOrFail(roomId);
    await this.audit.record(actorId, "ROOM_TOKEN_REGENERATED", "Room", room.id);
    return { id: room.id, name: room.name, checkInToken: room.checkInToken, updatedAt: this.clock.now() };
  }

  private async assertLocationExists(locationId: string): Promise<void> {
    const location = await this.prisma.location.findUnique({ where: { id: locationId }, select: { id: true } });
    if (!location) throw new NotFoundException(messages.errors.locationNotFound);
  }

  private async createWithNewToken(input: CreateRoomDto): Promise<SelectedRoom> {
    try {
      return await this.prisma.room.create({ data: { ...input, checkInToken: randomUUID() }, select: ROOM_SELECT });
    } catch (error) {
      if (isUniqueViolation(error)) throw new RoomNameAlreadyExistsException();
      throw error;
    }
  }

  private async replaceTokenOrFail(roomId: string): Promise<SelectedRoom> {
    try {
      return await this.prisma.room.update({
        where: { id: roomId },
        data: { checkInToken: randomUUID() },
        select: ROOM_SELECT,
      });
    } catch (error) {
      if (isRecordNotFound(error)) throw new NotFoundException(messages.errors.roomNotFound);
      throw error;
    }
  }
}
