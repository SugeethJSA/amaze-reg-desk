import cors from "cors";
import express from "express";
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

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "amaze-reg-desk-api" });
});

app.use("/api/auth", authRouter);
app.use("/api/categories", categoriesRouter);
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
    return res.status(400).json({
      error: "validation_error",
      message: "Request validation failed.",
      issues: error.issues
    });
  }
  const message = error instanceof Error ? error.message : "Unexpected error.";
  return res.status(500).json({ error: "internal_error", message });
});

app.listen(config.API_PORT, () => {
  console.log(`Amaze Reg Desk API listening on http://localhost:${config.API_PORT}`);
});
