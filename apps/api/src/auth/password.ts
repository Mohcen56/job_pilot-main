import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(scrypt);
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt, 64) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string | null) {
  const [salt, hex] = (stored ?? "00000000000000000000000000000000:" + "00".repeat(64)).split(":");
  const key = await derive(password, salt, 64) as Buffer;
  const expected = Buffer.from(hex, "hex");
  return stored !== null && expected.length === key.length && timingSafeEqual(expected, key);
}
