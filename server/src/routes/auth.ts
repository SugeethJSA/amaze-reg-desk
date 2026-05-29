import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAdmin, requireAuth, signUser } from "../middleware/auth.js";
import { exportQrDecryptKey } from "../services/crypto.js";

export const authRouter = Router();

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const input = LoginSchema.parse(req.body);
    const result = await pool.query("SELECT * FROM users WHERE email = $1 AND active = TRUE", [input.email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(input.password, user.password_hash))) {
      return res.status(401).json({ error: "invalid_credentials", message: "Email or password is incorrect." });
    }

    const signedUser = { id: user.id, email: user.email, name: user.name, role: user.role };
    return res.json({ token: signUser(signedUser), user: signedUser, qrDecryptKey: exportQrDecryptKey() });
  } catch (error) {
    return next(error);
  }
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

authRouter.post("/users", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const input = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(8),
      role: z.enum(["admin", "volunteer"]),
      stations: z.array(z.enum(["entry", "food", "kit", "custom"])).default([])
    }).parse(req.body);
    const passwordHash = await bcrypt.hash(input.password, 12);

    const result = await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, active",
      [input.name, input.email, passwordHash, input.role]
    );

    if (input.role === "volunteer") {
      await pool.query(
        "INSERT INTO volunteer_keys (user_id, key_label, public_hint, station_permissions) VALUES ($1, $2, $3, $4::station_type[])",
        [result.rows[0].id, "default", "managed-by-admin", input.stations]
      );
    }

    res.status(201).json({ user: result.rows[0] });
  } catch (error) {
    next(error);
  }
});
