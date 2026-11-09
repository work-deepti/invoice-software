import "server-only";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";
import { getDb } from "./db";
import { users, type Role, type User } from "./db/schema";
import { forbidden, unauthorized } from "./http";

export const SESSION_COOKIE = "gsb_session";
/** NFR-03: session timeout 12 h. */
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

const SCRYPT = { N: 16384, r: 8, p: 1 };

function scrypt(password: string, salt: Buffer, keylen: number, N: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, keylen, { N, r: SCRYPT.r, p: SCRYPT.p }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/** NFR-03: hashed passwords (scrypt with a per-user salt). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64, SCRYPT.N);
  return `scrypt$${SCRYPT.N}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, saltB64, hashB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, Number(n));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET must be set (16+ characters) — see .env.example");
  return new TextEncoder().encode(s);
}

export async function createSessionToken(user: Pick<User, "id" | "sessionVersion">): Promise<string> {
  return new SignJWT({ v: user.sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret());
}

export function sessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function readToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  const cookie = req.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === SESSION_COOKIE) return v.join("=");
  }
  return null;
}

export type SessionUser = Pick<User, "id" | "name" | "login" | "role">;

export async function getSessionUser(req: Request): Promise<SessionUser | null> {
  const token = readToken(req);
  if (!token) return null;
  let sub: string | undefined;
  let v: unknown;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    sub = payload.sub;
    v = payload.v;
  } catch {
    return null;
  }
  if (!sub) return null;
  const [u] = await getDb().select().from(users).where(eq(users.id, sub)).limit(1);
  if (!u || !u.active || u.sessionVersion !== v) return null;
  return { id: u.id, name: u.name, login: u.login, role: u.role };
}

/** ROLE-02 / NFR-03: the server checks the role on every API call. */
export async function requireUser(req: Request, roles?: readonly Role[]): Promise<SessionUser> {
  const user = await getSessionUser(req);
  if (!user) throw unauthorized();
  if (roles && !roles.includes(user.role)) throw forbidden();
  return user;
}

export const ANY_ROLE: readonly Role[] = ["owner", "staff", "viewer"];
export const CAN_BILL: readonly Role[] = ["owner", "staff"];
export const OWNER_ONLY: readonly Role[] = ["owner"];
