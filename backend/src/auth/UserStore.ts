import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getPool } from "../db/mysql";

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
}

export interface ResetRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  used: boolean;
}

/** Persistence for users + password reset tokens (collaborator of AuthService). */
export interface UserStore {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  createUser(user: UserRecord): Promise<void>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;

  createReset(reset: ResetRecord): Promise<void>;
  findResetByTokenHash(tokenHash: string): Promise<ResetRecord | null>;
  /**
   * Atomically transitions a reset record from unused -> used. Returns false (without
   * effect) if it was already used, so two concurrent redemptions of the same token
   * can't both succeed -- the loser must fail instead of also updating the password.
   */
  markResetUsed(id: string): Promise<boolean>;
}

// ---------------- In-memory adapter (tests + no-DB fallback) ----------------

export class InMemoryUserStore implements UserStore {
  private readonly users = new Map<string, UserRecord>();
  private readonly resets = new Map<string, ResetRecord>();

  async findByEmail(email: string): Promise<UserRecord | null> {
    for (const u of this.users.values()) if (u.email === email.toLowerCase()) return u;
    return null;
  }
  async findById(id: string): Promise<UserRecord | null> {
    return this.users.get(id) ?? null;
  }
  async createUser(user: UserRecord): Promise<void> {
    this.users.set(user.id, { ...user, email: user.email.toLowerCase() });
  }
  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    const u = this.users.get(userId);
    if (u) u.passwordHash = passwordHash;
  }
  async createReset(reset: ResetRecord): Promise<void> {
    this.resets.set(reset.id, { ...reset });
  }
  async findResetByTokenHash(tokenHash: string): Promise<ResetRecord | null> {
    for (const r of this.resets.values()) if (r.tokenHash === tokenHash) return r;
    return null;
  }
  async markResetUsed(id: string): Promise<boolean> {
    // No `await` between the read and the write, so this body runs to completion
    // without yielding to another request's microtask -- the check-and-set is atomic.
    const r = this.resets.get(id);
    if (!r || r.used) return false;
    r.used = true;
    return true;
  }
}

// ---------------- MySQL adapter ----------------

export class MySqlUserStore implements UserStore {
  async findByEmail(email: string): Promise<UserRecord | null> {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT id, email, password_hash FROM users WHERE email = :email LIMIT 1`,
      { email: email.toLowerCase() }
    );
    return rows.length ? toUser(rows[0]) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT id, email, password_hash FROM users WHERE id = :id LIMIT 1`,
      { id }
    );
    return rows.length ? toUser(rows[0]) : null;
  }

  async createUser(user: UserRecord): Promise<void> {
    await getPool().query(
      `INSERT INTO users (id, email, password_hash) VALUES (:id, :email, :hash)`,
      { id: user.id, email: user.email.toLowerCase(), hash: user.passwordHash }
    );
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await getPool().query(`UPDATE users SET password_hash = :hash WHERE id = :id`, {
      hash: passwordHash,
      id: userId,
    });
  }

  async createReset(reset: ResetRecord): Promise<void> {
    await getPool().query(
      `INSERT INTO password_resets (id, user_id, token_hash, expires_at, used)
       VALUES (:id, :userId, :tokenHash, :expiresAt, 0)`,
      { id: reset.id, userId: reset.userId, tokenHash: reset.tokenHash, expiresAt: reset.expiresAt }
    );
  }

  async findResetByTokenHash(tokenHash: string): Promise<ResetRecord | null> {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT id, user_id, token_hash, expires_at, used FROM password_resets
       WHERE token_hash = :tokenHash LIMIT 1`,
      { tokenHash }
    );
    if (!rows.length) return null;
    const r = rows[0];
    return {
      id: r.id,
      userId: r.user_id,
      tokenHash: r.token_hash,
      expiresAt: new Date(r.expires_at),
      used: Boolean(r.used),
    };
  }

  async markResetUsed(id: string): Promise<boolean> {
    // Gate the UPDATE on `used = 0` so it's an atomic claim at the database level:
    // only the first of two concurrent callers gets affectedRows > 0.
    const [result] = await getPool().query<ResultSetHeader>(
      `UPDATE password_resets SET used = 1 WHERE id = :id AND used = 0`,
      { id }
    );
    return result.affectedRows > 0;
  }
}

function toUser(r: RowDataPacket): UserRecord {
  return { id: r.id, email: r.email, passwordHash: r.password_hash };
}
