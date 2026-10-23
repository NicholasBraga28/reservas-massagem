import { Prisma } from "@prisma/client";

export function isRetryableTransactionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code === "P2034";
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return error.message.includes("40P01") || error.message.toLowerCase().includes("deadlock detected");
  }
  if (typeof error !== "object" || error === null || !("message" in error) || typeof error.message !== "string")
    return false;
  return error.message.includes("40P01") || error.message.toLowerCase().includes("deadlock detected");
}
