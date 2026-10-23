export type PairingCodeDto = Readonly<{
  code: string;
  therapistId: string;
  expiresAt: Date;
}>;
