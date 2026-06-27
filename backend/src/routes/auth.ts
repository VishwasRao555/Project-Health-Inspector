import { Router } from "express";
import { AuthError, type AuthService } from "../auth/AuthService";

/** /api/auth — register, login, forgot/reset password. */
export function authRouter(auth: AuthService): Router {
  const router = Router();

  router.post("/register", async (req, res) => {
    try {
      const { email, password } = req.body ?? {};
      res.json(await auth.register(email, password));
    } catch (err) {
      sendAuthError(res, err);
    }
  });

  router.post("/login", async (req, res) => {
    try {
      const { email, password } = req.body ?? {};
      res.json(await auth.login(email, password));
    } catch (err) {
      sendAuthError(res, err);
    }
  });

  router.post("/forgot-password", async (req, res) => {
    try {
      await auth.requestPasswordReset(req.body?.email ?? "");
    } catch (err) {
      // Never leak whether the email exists; only surface validation errors.
      if (err instanceof AuthError && err.status === 400) {
        return sendAuthError(res, err);
      }
    }
    // Uniform response regardless of account existence.
    res.json({ message: "If an account exists for that email, a reset link has been sent." });
  });

  router.post("/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body ?? {};
      await auth.resetPassword(token, password);
      res.json({ message: "Password updated. You can now sign in." });
    } catch (err) {
      sendAuthError(res, err);
    }
  });

  return router;
}

function sendAuthError(res: import("express").Response, err: unknown): void {
  if (err instanceof AuthError) {
    res.status(err.status).json({ error: err.message });
  } else {
    console.error("[auth] unexpected error:", err);
    res.status(500).json({ error: "Something went wrong." });
  }
}
