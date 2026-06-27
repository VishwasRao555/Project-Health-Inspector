import { promises as fs } from "fs";
import path from "path";
import type { AnalysisContext } from "../context/buildContext";
import type { Issue } from "../types/contract";
import { Analyzer, issue } from "./Analyzer";
import { isTestFile } from "./util";

interface SecretRule {
  id: string;
  regex: RegExp;
  severity: Issue["severity"];
  issue: string;
  rootCause: string;
  impact: string;
  solution: string;
}

const SCAN_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".json", ".env", ".yml", ".yaml", ".py", ".rb", ".go", ".java", ".php",
]);

const SECRET_RULES: SecretRule[] = [
  {
    id: "hardcoded-password",
    regex: /(password|passwd|pwd)\s*[:=]\s*["'][^"'\s]{3,}["']/i,
    severity: "high",
    issue: "Hardcoded password",
    rootCause: "A password literal is committed directly in source.",
    impact: "Anyone with repo access gains the credential; rotation is painful.",
    solution: "Move it to an environment variable and rotate the exposed value.",
  },
  {
    id: "hardcoded-api-key",
    regex: /(api[_-]?key|apikey|secret[_-]?key|access[_-]?token)\s*[:=]\s*["'][^"'\s]{6,}["']/i,
    severity: "high",
    issue: "Hardcoded API key / secret",
    rootCause: "An API key or secret token is embedded in source.",
    impact: "Leaked keys can be abused for billing fraud or data access.",
    solution: "Store secrets in env vars or a secrets manager; revoke the leaked key.",
  },
  {
    id: "weak-jwt-secret",
    regex: /JWT_SECRET\s*[:=]\s*["']?[^"'\s]{1,7}["']?\b/,
    severity: "critical",
    issue: "Weak JWT secret",
    rootCause: "JWT signing secret is short and guessable.",
    impact: "Tokens can be forged, allowing full account takeover.",
    solution: "Use a long (32+ char) random secret from the environment.",
  },
  {
    id: "private-key",
    regex: /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/,
    severity: "critical",
    issue: "Committed private key",
    rootCause: "A private cryptographic key is committed to the repository.",
    impact: "Complete compromise of whatever the key protects.",
    solution: "Remove the key, rotate it, and purge it from git history.",
  },
];

// SQL string concatenation with a variable, e.g. query("... WHERE id=" + id).
const SQL_INJECTION = /\b(query|execute|raw)\s*\(\s*[`"'][^`"']*(SELECT|INSERT|UPDATE|DELETE)[^`"']*[`"']\s*\+/i;
// Template-literal SQL with interpolation.
const SQL_INJECTION_TEMPLATE = /(SELECT|INSERT|UPDATE|DELETE)[^`]*\$\{[^}]+\}/i;
// eval() / new Function(...) of dynamic input.
const EVAL_USAGE = /\beval\s*\(|new\s+Function\s*\(/;
// Shell commands built from interpolated/concatenated input.
const COMMAND_INJECTION = /\b(exec|execSync|spawn)\s*\(\s*(`[^`]*\$\{|[`"'][^`"']*["'`]\s*\+)/;
// Hardcoded insecure (non-TLS) URL, excluding localhost/loopback.
const INSECURE_URL = /['"]http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)[^'"]+['"]/;

/** Detects hardcoded secrets, weak JWT secrets, and SQL-injection-prone query building. */
export class SecurityAnalyzer implements Analyzer {
  readonly name = "SecurityAnalyzer";
  readonly category = "Security" as const;

  async analyze(ctx: AnalysisContext): Promise<Issue[]> {
    const issues: Issue[] = [];

    for (const rel of ctx.allFiles) {
      if (isTestFile(rel)) continue;
      if (rel === ".env.example" || rel === ".env.sample") continue; // example files are expected
      if (!SCAN_EXTENSIONS.has(path.extname(rel)) && !rel.endsWith(".env")) continue;

      let content: string;
      try {
        content = await fs.readFile(path.join(ctx.rootDir, rel), "utf8");
      } catch {
        continue;
      }
      const lines = content.split("\n");

      lines.forEach((line, idx) => {
        for (const rule of SECRET_RULES) {
          if (rule.regex.test(line)) {
            issues.push(
              issue(this, {
                severity: rule.severity,
                issue: rule.issue,
                rootCause: rule.rootCause,
                impact: rule.impact,
                solution: rule.solution,
                file: rel,
                line: idx + 1,
              })
            );
          }
        }
        if (SQL_INJECTION.test(line) || SQL_INJECTION_TEMPLATE.test(line)) {
          issues.push(
            issue(this, {
              severity: "high",
              issue: "Possible SQL injection",
              rootCause: "A SQL query is built by concatenating or interpolating untrusted input.",
              impact: "Attackers can read or destroy database contents.",
              solution: "Use parameterized queries / prepared statements instead of string building.",
              file: rel,
              line: idx + 1,
            })
          );
        }
        if (EVAL_USAGE.test(line)) {
          issues.push(
            issue(this, {
              severity: "high",
              issue: "Use of eval() / new Function()",
              rootCause: "Dynamically evaluating a string as code can execute attacker-controlled input.",
              impact: "Arbitrary code execution if any part of the evaluated string is untrusted.",
              solution: "Avoid eval/new Function; use a safe parser or explicit logic instead.",
              file: rel,
              line: idx + 1,
            })
          );
        }
        if (COMMAND_INJECTION.test(line)) {
          issues.push(
            issue(this, {
              severity: "critical",
              issue: "Possible command injection",
              rootCause: "A shell command is built by concatenating or interpolating untrusted input.",
              impact: "Attackers can execute arbitrary commands on the host.",
              solution: "Use execFile/spawn with an argument array instead of a shell string.",
              file: rel,
              line: idx + 1,
            })
          );
        }
        if (INSECURE_URL.test(line)) {
          issues.push(
            issue(this, {
              severity: "low",
              issue: "Hardcoded insecure (http://) URL",
              rootCause: "A plain-HTTP URL is hardcoded instead of HTTPS.",
              impact: "Traffic to this URL can be intercepted or tampered with in transit.",
              solution: "Use https:// for the endpoint, or make the scheme configurable.",
              file: rel,
              line: idx + 1,
            })
          );
        }
      });
    }

    return issues;
  }
}
