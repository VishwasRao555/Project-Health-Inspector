import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { v4 as uuid } from "uuid";
import type { AuthResult, AuthUser } from "../types/contract";
import type { Mailer } from "../mail/Mailer";
import type { UserStore } from "./UserStore";

export interface AuthService {
  register(email: string, password: string): Promise<AuthResult>;
  login(email: string, password: string): Promise<AuthResult>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(resetToken: string, newPassword: string): Promise<void>;
  verify(token: string): Promise<AuthUser>;
}

export class AuthError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

const RESET_TTL_MS = 1000 * 60 * 30; // 30 minutes

/**
 * Hides bcrypt, JWT, and the reset-token lifecycle behind a small interface.
 * Forgot-password responses are uniform so they never reveal whether an email exists.
 */
export class JwtAuthService implements AuthService {
  constructor(
    private readonly users: UserStore,
    private readonly mailer: Mailer,
    private readonly opts: { jwtSecret: string; appUrl: string }
  ) {}

  async register(email: string, password: string): Promise<AuthResult> {
    const normalized = normalizeEmail(email);
    validatePassword(password);
    if (await this.users.findByEmail(normalized)) {
      throw new AuthError("An account with this email already exists.", 409);
    }
    const user = {
      id: uuid(),
      email: normalized,
      passwordHash: await bcrypt.hash(password, 10),
    };
    await this.users.createUser(user);
    return this.toResult(user);
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.users.findByEmail(normalizeEmail(email));
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AuthError("Invalid email or password.", 401);
    }
    return this.toResult(user);
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.users.findByEmail(normalizeEmail(email));
    // Always behave the same way regardless of whether the user exists.
    if (!user) return;

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    await this.users.createReset({
      id: uuid(),
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
      used: false,
    });

    const link = `${this.opts.appUrl}/reset-password?token=${rawToken}`;
    await this.mailer.send({
      to: user.email,
      subject: "Reset your Project Health Inspector password",
      body:
        `We received a request to reset your password.\n\n` +
        `Open this link to choose a new password (valid for 30 minutes):\n${link}\n\n` +
        `If you did not request this, you can ignore this email.`,
    });
  }

  async resetPassword(resetToken: string, newPassword: string): Promise<void> {
    validatePassword(newPassword);
    const record = await this.users.findResetByTokenHash(hashToken(resetToken));
    if (!record || record.used || record.expiresAt.getTime() < Date.now()) {
      throw new AuthError("This reset link is invalid or has expired.", 400);
    }
    // Claim the token before touching the password: this is the atomic step, so if two
    // requests race on the same token, only the winner proceeds and the loser fails here
    // instead of both redeeming it and one password silently clobbering the other.
    const claimed = await this.users.markResetUsed(record.id);
    if (!claimed) {
      throw new AuthError("This reset link is invalid or has expired.", 400);
    }
    await this.users.updatePassword(record.userId, await bcrypt.hash(newPassword, 10));
  }

  async verify(token: string): Promise<AuthUser> {
    try {
      const payload = jwt.verify(token, this.opts.jwtSecret) as { sub: string; email: string };
      return { id: payload.sub, email: payload.email };
    } catch {
      throw new AuthError("Invalid or expired token.", 401);
    }
  }

  private toResult(user: { id: string; email: string }): AuthResult {
    const token = jwt.sign({ sub: user.id, email: user.email }, this.opts.jwtSecret, {
      expiresIn: "7d",
    });
    return { user: { id: user.id, email: user.email }, token };
  }
}

function normalizeEmail(email: string): string {
  const e = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new AuthError("Please enter a valid email.");
  return e;
}

function validatePassword(password: string): void {
  if (!password || password.length < 8) {
    throw new AuthError("Password must be at least 8 characters.");
  }
}

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}
