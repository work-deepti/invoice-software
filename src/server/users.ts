import "server-only";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { writeAudit } from "./audit";
import { createSessionToken, hashPassword, verifyPassword, type SessionUser } from "./auth";
import { getDb } from "./db";
import { users } from "./db/schema";
import { conflict, HttpError, notFound } from "./http";
import { loginBodySchema, newUserSchema, updateUserSchema } from "./schemas";

const publicCols = {
  id: users.id,
  name: users.name,
  login: users.login,
  role: users.role,
  active: users.active,
  createdAt: users.createdAt,
};

export async function hasAnyUser(): Promise<boolean> {
  const [{ n }] = await getDb().select({ n: sql<number>`count(*)::int` }).from(users);
  return n > 0;
}

/** First run: create the owner account. Only allowed while no user exists. */
export async function setupOwner(body: unknown) {
  const b = newUserSchema.omit({ role: true }).parse(body);
  const passwordHash = await hashPassword(b.password);
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('gsb:setup'))`);
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(users);
    if (n > 0) throw conflict("Setup is already done. Sign in instead.");
    const [u] = await tx.insert(users).values({ name: b.name, login: b.login, passwordHash, role: "owner" }).returning();
    await tx.update(users).set({ createdBy: u.id, updatedBy: u.id }).where(eq(users.id, u.id));
    await writeAudit(tx, { userId: u.id, entity: "user", entityId: u.id, action: "users", after: { login: u.login, role: u.role } });
    return { user: { id: u.id, name: u.name, login: u.login, role: u.role }, token: await createSessionToken(u) };
  });
}

export async function login(body: unknown) {
  const b = loginBodySchema.parse(body);
  const [u] = await getDb().select().from(users).where(eq(users.login, b.login.toLowerCase())).limit(1);
  // Same message whether the login or the password is wrong.
  if (!u || !u.active || !(await verifyPassword(b.password, u.passwordHash)))
    throw new HttpError(401, { message: "Login or password is not correct." });
  return { user: { id: u.id, name: u.name, login: u.login, role: u.role }, token: await createSessionToken(u) };
}

export async function listUsers() {
  return getDb().select(publicCols).from(users).orderBy(asc(users.createdAt));
}

export async function createUser(body: unknown, actor: SessionUser) {
  const b = newUserSchema.parse(body);
  const passwordHash = await hashPassword(b.password);
  return getDb().transaction(async (tx) => {
    const [exists] = await tx.select({ id: users.id }).from(users).where(eq(users.login, b.login)).limit(1);
    if (exists) throw conflict(`The login "${b.login}" is already taken.`);
    const [u] = await tx
      .insert(users)
      .values({ name: b.name, login: b.login, passwordHash, role: b.role, createdBy: actor.id, updatedBy: actor.id })
      .returning(publicCols);
    await writeAudit(tx, { userId: actor.id, entity: "user", entityId: u.id, action: "users", after: u });
    return u;
  });
}

export async function updateUser(id: string, body: unknown, actor: SessionUser) {
  const b = updateUserSchema.parse(body);
  return getDb().transaction(async (tx) => {
    const [before] = await tx.select().from(users).where(eq(users.id, id)).limit(1).for("update");
    if (!before) throw notFound("User not found.");
    const losesOwner = before.role === "owner" && ((b.role && b.role !== "owner") || b.active === false);
    if (losesOwner) {
      const [{ n }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(users)
        .where(and(eq(users.role, "owner"), eq(users.active, true), ne(users.id, id)));
      if (n === 0) throw conflict("There must always be at least one active owner.");
    }
    const invalidate = b.password !== undefined || b.active === false || (b.role && b.role !== before.role);
    const [u] = await tx
      .update(users)
      .set({
        ...(b.name !== undefined && { name: b.name }),
        ...(b.role !== undefined && { role: b.role }),
        ...(b.active !== undefined && { active: b.active }),
        ...(b.password !== undefined && { passwordHash: await hashPassword(b.password) }),
        ...(invalidate && { sessionVersion: before.sessionVersion + 1 }),
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(eq(users.id, id))
      .returning(publicCols);
    await writeAudit(tx, {
      userId: actor.id,
      entity: "user",
      entityId: id,
      action: "users",
      before: { name: before.name, role: before.role, active: before.active },
      after: { name: u.name, role: u.role, active: u.active, passwordChanged: b.password !== undefined },
    });
    return u;
  });
}
