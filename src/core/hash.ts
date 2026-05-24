import { createHash } from "node:crypto";

export function createDailyUniqueKey(input: {
  date: string;
  ipAddress: string;
  siteId: string;
  userAgent: string;
  uniqueVisitorSalt: string;
}): string {
  return createHash("sha256")
    .update(input.uniqueVisitorSalt)
    .update(":")
    .update(input.siteId)
    .update(":")
    .update(input.date)
    .update(":")
    .update(input.ipAddress)
    .update(":")
    .update(input.userAgent)
    .digest("hex")
    .slice(0, 32);
}
