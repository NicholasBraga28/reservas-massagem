import { randomInt } from "node:crypto";
import { Injectable } from "@nestjs/common";

export interface PairingCodeSource {
  next(): string;
}

export const PAIRING_CODE_SOURCE = Symbol("PAIRING_CODE_SOURCE");

export const PAIRING_CODE_DIGITS = 6;

@Injectable()
export class CryptoPairingCodeSource implements PairingCodeSource {
  next(): string {
    return randomInt(0, 10 ** PAIRING_CODE_DIGITS)
      .toString()
      .padStart(PAIRING_CODE_DIGITS, "0");
  }
}
