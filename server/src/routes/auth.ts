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

authRouter.get("/users", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT u.id,
              u.name,
              u.email,
              u.role,
              u.active,
              COALESCE(v.station_permissions, ARRAY[]::station_type[]) AS stations,
              u.created_at AS "createdAt"
         FROM users u
         LEFT JOIN LATERAL (
           SELECT station_permissions
             FROM volunteer_keys
            WHERE user_id = u.id
              AND revoked_at IS NULL
            ORDER BY created_at DESC
            LIMIT 1
         ) v ON TRUE
        ORDER BY u.created_at DESC`
    );
    res.json({
      users: result.rows,
      scopes: ["entry", "food", "kit", "custom"]
    });
  } catch (error) {
    next(error);
  }
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

authRouter.put("/users/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const input = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(8).optional().or(z.literal("")),
      role: z.enum(["admin", "volunteer"]),
      active: z.boolean(),
      stations: z.array(z.enum(["entry", "food", "kit", "custom"])).default([])
    }).parse(req.body);

    const passwordHash = input.password ? await bcrypt.hash(input.password, 12) : null;
    const result = await pool.query(
      `UPDATE users
          SET name = $2,
              email = $3,
              role = $4,
              active = $5,
              password_hash = COALESCE($6, password_hash)
        WHERE id = $1
        RETURNING id, name, email, role, active`,
      [req.params.id, input.name, input.email, input.role, input.active, passwordHash]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: "not_found", message: "User not found." });
    }

    await pool.query("UPDATE volunteer_keys SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [req.params.id]);
    if (input.role === "volunteer") {
      await pool.query(
        "INSERT INTO volunteer_keys (user_id, key_label, public_hint, station_permissions) VALUES ($1, $2, $3, $4::station_type[])",
        [req.params.id, "default", "managed-by-admin", input.stations]
      );
    }

    return res.json({ user: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

authRouter.delete("/users/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    if (req.params.id === req.user?.id) {
      return res.status(400).json({ error: "cannot_delete_self", message: "You cannot delete your own account while signed in." });
    }

    const result = await pool.query("UPDATE users SET active = FALSE WHERE id = $1 RETURNING id", [req.params.id]);
    if (!result.rows[0]) {
      return res.status(404).json({ error: "not_found", message: "User not found." });
    }
    await pool.query("UPDATE volunteer_keys SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [req.params.id]);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});
