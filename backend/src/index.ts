import "dotenv/config";
import cors from "cors";
import express from "express";
import { JwtAuthService } from "./auth/AuthService";
import { InMemoryUserStore, MySqlUserStore, type UserStore } from "./auth/UserStore";
import { initSchema, isMysqlConfigured } from "./db/mysql";
import { Inspector } from "./inspector/Inspector";
import { createMailer } from "./mail/Mailer";
import { analyzeRouter } from "./routes/analyze";
import { authRouter } from "./routes/auth";
import { InMemoryReportStore } from "./store/InMemoryReportStore";
import { MySqlReportStore } from "./store/MySqlReportStore";
import type { ReportStore } from "./store/ReportStore";

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? 4000);
  const appUrl = process.env.APP_URL ?? "http://localhost:5173";
  const jwtSecret = process.env.JWT_SECRET ?? "dev-only-insecure-secret-change-me";

  // Pick MySQL or in-memory adapters based on configuration.
  let userStore: UserStore;
  let reportStore: ReportStore;
  if (isMysqlConfigured()) {
    await initSchema();
    userStore = new MySqlUserStore();
    reportStore = new MySqlReportStore();
    console.log("[phi] Using MySQL persistence.");
  } else {
    userStore = new InMemoryUserStore();
    reportStore = new InMemoryReportStore();
    console.log("[phi] DB not configured — using in-memory stores (data resets on restart).");
  }

  const auth = new JwtAuthService(userStore, createMailer(), { jwtSecret, appUrl });
  const inspector = new Inspector();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRouter(auth));
  app.use("/api", analyzeRouter(inspector, reportStore, auth));

  app.listen(port, () => console.log(`[phi] API listening on http://localhost:${port}`));
}

main().catch((err) => {
  console.error("[phi] fatal startup error:", err);
  process.exit(1);
});
