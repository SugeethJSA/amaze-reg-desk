import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1).default("postgres://postgres:postgres@localhost:5432/amaze_reg_desk"),
  JWT_SECRET: z.string().min(24).default("dev-only-change-this-jwt-secret"),
  QR_MASTER_SECRET: z.string().min(24).default("dev-only-change-this-qr-master-secret"),
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  SMTP_FROM: z.string().default("Amaze Reg Desk <noreply@example.com>"),
  APP_PUBLIC_URL: z.string().url().default("http://localhost:5173"),
  API_PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:5173")
});

export const config = EnvSchema.parse(process.env);
