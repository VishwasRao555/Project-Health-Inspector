import { Router } from "express";
import multer from "multer";
import type { AuthService } from "../auth/AuthService";
import { requireAuth } from "../auth/requireAuth";
import type { Inspector } from "../inspector/Inspector";
import { GitHubCloneSource } from "../sources/GitHubCloneSource";
import type { RepositorySource } from "../sources/RepositorySource";
import { ZipUploadSource } from "../sources/ZipUploadSource";
import type { ReportStore } from "../store/ReportStore";
import type { SourceRef } from "../types/contract";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

/** /api — analyze (URL or ZIP) and read past reports. All routes require auth. */
export function analyzeRouter(
  inspector: Inspector,
  store: ReportStore,
  auth: AuthService
): Router {
  const router = Router();
  router.use(requireAuth(auth));

  // POST /api/analyze — multipart (zip file) OR JSON ({ repoUrl }).
  router.post("/analyze", upload.single("file"), async (req, res) => {
    const userId = req.user!.id;
    try {
      let source: RepositorySource;
      let sourceRef: SourceRef;

      if (req.file) {
        if (!/\.zip$/i.test(req.file.originalname)) {
          return res.status(400).json({ error: "Only .zip files are supported." });
        }
        source = new ZipUploadSource(req.file.buffer);
        sourceRef = { type: "zip", ref: req.file.originalname };
      } else if (req.body?.repoUrl) {
        const url = String(req.body.repoUrl).trim();
        if (!GitHubCloneSource.isValidUrl(url)) {
          return res.status(400).json({ error: "Enter a valid GitHub repository URL." });
        }
        source = new GitHubCloneSource(url);
        sourceRef = { type: "github", ref: url };
      } else {
        return res.status(400).json({ error: "Provide a GitHub URL or upload a .zip file." });
      }

      const report = await inspector.inspect(source, sourceRef);
      await store.save(userId, report);
      res.json(report);
    } catch (err) {
      console.error("[analyze] failed:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Analysis failed.",
      });
    }
  });

  router.get("/reports", async (req, res) => {
    try {
      res.json(await store.list(req.user!.id));
    } catch (err) {
      console.error("[reports] list failed:", err);
      res.status(500).json({ error: "Failed to load reports." });
    }
  });

  router.get("/reports/:id", async (req, res) => {
    try {
      const report = await store.get(req.user!.id, req.params.id);
      if (!report) return res.status(404).json({ error: "Report not found." });
      res.json(report);
    } catch (err) {
      console.error("[reports] get failed:", err);
      res.status(500).json({ error: "Failed to load report." });
    }
  });

  return router;
}
