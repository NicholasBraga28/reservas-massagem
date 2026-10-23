import type { LocationCode } from "@prisma/client";

export type RoomDto = Readonly<{
  id: string;
  name: string;
  locationId: string;
  locationCode: LocationCode;
  active: boolean;
  checkInToken: string;
}>;
