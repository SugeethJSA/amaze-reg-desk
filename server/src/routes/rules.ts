import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

export const rulesRouter = Router();

rulesRouter.get("/", requireAuth, async (_req, res, next) => {
  try {
    const result = await pool.query("SELECT * FROM scan_rules ORDER BY created_at DESC");
    res.json({ rules: result.rows });
  } catch (error) {
    next(error);
  }
});

rulesRouter.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const input = z.object({
      name: z.string().min(1),
      station: z.enum(["entry", "food", "kit", "custom"]),
      startsAt: z.string().datetime().optional(),
      endsAt: z.string().datetime().optional(),
      eligibility: z.record(z.unknown()).default({}),
      active: z.boolean().default(true)
    }).parse(req.body);

    const result = await pool.query(
      `INSERT INTO scan_rules (name, station, starts_at, ends_at, eligibility, active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [input.name, input.station, input.startsAt ?? null, input.endsAt ?? null, input.eligibility, input.active]
    );

    res.status(201).json({ rule: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

rulesRouter.put("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const input = z.object({
      name: z.string().min(1),
      station: z.enum(["entry", "food", "kit", "custom"]),
      startsAt: z.string().datetime().optional(),
      endsAt: z.string().datetime().optional(),
      eligibility: z.record(z.unknown()).default({}),
      active: z.boolean().default(true)
    }).parse(req.body);

    const result = await pool.query(
      `UPDATE scan_rules
          SET name = $2,
              station = $3,
              starts_at = $4,
              ends_at = $5,
              eligibility = $6,
              active = $7
        WHERE id = $1
        RETURNING *`,
      [req.params.id, input.name, input.station, input.startsAt ?? null, input.endsAt ?? null, input.eligibility, input.active]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: "not_found", message: "Scan rule not found." });
    }

    res.json({ rule: result.rows[0] });
  } catch (error) {
    next(error);
  }
});
