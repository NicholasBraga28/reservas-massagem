export type ScheduleSlotDto = Readonly<{
  id: string;
  therapistId: string;
  roomId: string;
  startsAt: Date;
  endsAt: Date;
  createdAt: Date;
}>;
