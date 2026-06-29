import { describe, expect, it } from "vitest";
import { JwtAuthService } from "../src/auth/AuthService";
import { InMemoryUserStore } from "../src/auth/UserStore";
import type { MailMessage, Mailer } from "../src/mail/Mailer";

/** Captures the last sent message so the test can pull the raw reset token out of it. */
class CapturingMailer implements Mailer {
  last: MailMessage | null = null;
  async send(message: MailMessage): Promise<void> {
    this.last = message;
  }
}

function rawTokenFrom(mailer: CapturingMailer): string {
  const match = mailer.last?.body.match(/token=([^\s&]+)/);
  if (!match) throw new Error("No reset link found in captured email.");
  return match[1];
}

describe("InMemoryUserStore.markResetUsed", () => {
  it("lets only one of two concurrent claims on the same reset id succeed", async () => {
    const store = new InMemoryUserStore();
    await store.createReset({
      id: "r1",
      userId: "u1",
      tokenHash: "h",
      expiresAt: new Date(Date.now() + 1000),
      used: false,
    });
    const [a, b] = await Promise.all([store.markResetUsed("r1"), store.markResetUsed("r1")]);
    expect([a, b].filter(Boolean).length).toBe(1);
  });
});

describe("JwtAuthService.resetPassword", () => {
  it("only lets one of two concurrent requests with the same token succeed", async () => {
    const mailer = new CapturingMailer();
    const auth = new JwtAuthService(new InMemoryUserStore(), mailer, {
      jwtSecret: "test-secret",
      appUrl: "http://localhost:5173",
    });

    await auth.register("racer@example.com", "original-password");
    await auth.requestPasswordReset("racer@example.com");
    const token = rawTokenFrom(mailer);

    const results = await Promise.allSettled([
      auth.resetPassword(token, "password-from-request-a"),
      auth.resetPassword(token, "password-from-request-b"),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    // The token is now consumed either way -- a third attempt must also fail.
    await expect(auth.resetPassword(token, "password-from-request-c")).rejects.toThrow();
  });
});
