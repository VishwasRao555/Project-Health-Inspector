import express from "express";
import type { Server } from "http";
import { afterEach, describe, expect, it } from "vitest";
import type { AuthResult, AuthService } from "../src/auth/AuthService";
import type { Inspector } from "../src/inspector/Inspector";
import { analyzeRouter } from "../src/routes/analyze";
import type { ReportStore } from "../src/store/ReportStore";
import type { AuthUser, HealthReport, ReportSummary } from "../src/types/contract";

const FAKE_USER: AuthUser = { id: "u1", email: "u1@example.com" };

/** Always authenticates as FAKE_USER; the other AuthService methods aren't exercised here. */
const fakeAuth: AuthService = {
  register: () => Promise.reject(new Error("not used")),
  login: () => Promise.reject(new Error("not used")) as Promise<AuthResult>,
  requestPasswordReset: () => Promise.resolve(),
  resetPassword: () => Promise.resolve(),
  verify: () => Promise.resolve(FAKE_USER),
};

/** A store that always rejects, simulating a dropped DB connection / corrupt row. */
const throwingStore: ReportStore = {
  save: () => Promise.reject(new Error("db down")),
  get: (): Promise<HealthReport | null> => Promise.reject(new Error("db down")),
  list: (): Promise<ReportSummary[]> => Promise.reject(new Error("db down")),
};

let server: Server | null = null;

function startServer(store: ReportStore): Promise<string> {
  const app = express();
  app.use(express.json());
  app.use("/api", analyzeRouter({} as Inspector, store, fakeAuth));
  return new Promise((resolve) => {
    server = app.listen(0, () => {
      const addr = server!.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

afterEach(() => {
  server?.close();
  server = null;
});

describe("GET /api/reports and /api/reports/:id", () => {
  it("returns 500 JSON instead of hanging when the store throws", async () => {
    const base = await startServer(throwingStore);
    const headers = { Authorization: "Bearer anything" };

    const listRes = await fetch(`${base}/api/reports`, { headers });
    expect(listRes.status).toBe(500);
    expect((await listRes.json()).error).toBeTruthy();

    const getRes = await fetch(`${base}/api/reports/some-id`, { headers });
    expect(getRes.status).toBe(500);
    expect((await getRes.json()).error).toBeTruthy();
  });
});
