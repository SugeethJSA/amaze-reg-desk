import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import { ZodError } from "zod";
import { config } from "./config.js";
import { attendeesRouter } from "./routes/attendees.js";
import { categoriesRouter } from "./routes/categories.js";
import { authRouter } from "./routes/auth.js";
import { formFieldsRouter } from "./routes/formFields.js";
import { importsRouter } from "./routes/imports.js";
import { qrRouter } from "./routes/qr.js";
import { rulesRouter } from "./routes/rules.js";
import { scansRouter } from "./routes/scans.js";
import { statsRouter } from "./routes/stats.js";

const app = express();

app.use(cors({ origin: config.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "2mb" }));

// Trust Vercel/proxy headers to get the correct client IP
app.set("trust proxy", 1);

// General API rate limiter (100 requests per 15 minutes per IP)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "too_many_requests", message: "Too many requests from this IP, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiter for Authentication/Login routes (20 requests per 15 minutes)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "too_many_requests", message: "Too many login attempts from this IP, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general limiter to all API routes
app.use("/api/", apiLimiter);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "amaze-reg-desk-api" });
});

app.get("/api/version", (_req, res) => {
  res.json({ version: "1.1.0" });
});

import { settingsRouter } from "./routes/settings.js";

app.use("/api/auth", authLimiter, authRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/attendees", attendeesRouter);
app.use("/api/form-fields", formFieldsRouter);
app.use("/api/imports", importsRouter);
app.use("/api/qr", qrRouter);
app.use("/api/scans", scansRouter);
app.use("/api/rules", rulesRouter);
app.use("/api/stats", statsRouter);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  if (error instanceof ZodError) {
    const issueMessages = error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join(", ");
    return res.status(400).json({
      error: "validation_error",
      message: `Validation failed - ${issueMessages}`,
      issues: error.issues
    });
  }
  const message = error instanceof Error ? error.message : "Unexpected error.";
  return res.status(500).json({ error: "internal_error", message });
});

if (process.env.VERCEL !== "1") {
  app.listen(config.API_PORT, () => {
    console.log(`Amaze Reg Desk API listening on http://localhost:${config.API_PORT}`);
  });
}

export default app;

