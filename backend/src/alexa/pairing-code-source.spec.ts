import { CryptoPairingCodeSource } from "./pairing-code-source";

const DRAWS = 2_000;

describe("CryptoPairingCodeSource", () => {
  it("D-18 RF-17: always draws six digits, keeping leading zeros", () => {
    const source = new CryptoPairingCodeSource();

    const codes = Array.from({ length: DRAWS }, () => source.next());

    expect(codes.every((code) => /^\d{6}$/.test(code))).toBe(true);
    expect(codes.some((code) => code.startsWith("0"))).toBe(true);
  });
});
