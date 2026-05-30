import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

export const attendeesRouter = Router();

const AttendeeSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  college: z.string().optional(),
  department: z.string().optional(),
  externalRef: z.string().optional(),
  customFields: z.record(z.unknown()).default({})
});

attendeesRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const q = String(req.query.q ?? "");
    const result = await pool.query(
      `SELECT id,
              external_ref,
              name,
              email,
              phone,
              college,
              department,
              metadata,
              registered_on_spot,
              created_at
         FROM attendees
        WHERE $1 = '' OR name ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%'
        ORDER BY created_at DESC
        LIMIT 250`,
      [q]
    );
    res.json({ attendees: result.rows });
  } catch (error) {
    next(error);
  }
});

attendeesRouter.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const input = AttendeeSchema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO attendees (external_ref, name, email, phone, college, department, metadata, registered_on_spot)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
       ON CONFLICT (email) DO UPDATE
       SET name = EXCLUDED.name,
           phone = EXCLUDED.phone,
           college = EXCLUDED.college,
           department = EXCLUDED.department,
           metadata = attendees.metadata || EXCLUDED.metadata,
           updated_at = now()
       RETURNING *`,
      [
        input.externalRef,
        input.name,
        input.email.toLowerCase(),
        input.phone,
        input.college,
        input.department,
        { customFields: input.customFields }
      ]
    );
    res.status(201).json({ attendee: result.rows[0] });
  } catch (error) {
    next(error);
  }
});
