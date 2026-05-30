import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

export const categoriesRouter = Router();

const CAPABILITY_KEYS = [
  "can_scan",
  "can_verify",
  "can_register",
  "can_view_attendees",
  "can_export",
  "can_transfer"
] as const;

const CategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366f1"),
  stationPermissions: z.array(z.enum(["entry", "food", "kit", "custom"])).default([]),
  capabilities: z.record(z.boolean()).default({}),
  active: z.boolean().default(true)
});

// List all categories
categoriesRouter.get("/", requireAuth, async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id,
              name,
              description,
              color,
              station_permissions::text[] AS "stationPermissions",
              capabilities,
              active,
              created_at AS "createdAt",
              updated_at AS "updatedAt",
              (SELECT count(*)::int FROM users WHERE category_id = user_categories.id) AS "userCount"
         FROM user_categories
        ORDER BY active DESC, name ASC`
    );
    res.json({ categories: result.rows, capabilityKeys: CAPABILITY_KEYS });
  } catch (error) {
    next(error);
  }
});

// Create category
categoriesRouter.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const input = CategorySchema.parse(req.body);
    const capabilities: Record<string, boolean> = {};
    for (const key of CAPABILITY_KEYS) {
      capabilities[key] = input.capabilities[key] ?? false;
    }
    const result = await pool.query(
      `INSERT INTO user_categories (name, description, color, station_permissions, capabilities, active)
       VALUES ($1, $2, $3, $4::station_type[], $5, $6)
       RETURNING id,
                 name,
                 description,
                 color,
                 station_permissions AS "stationPermissions",
                 capabilities,
                 active`,
      [input.name, input.description, input.color, input.stationPermissions, JSON.stringify(capabilities), input.active]
    );
    res.status(201).json({ category: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Update category
categoriesRouter.put("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const input = CategorySchema.parse(req.body);
    const capabilities: Record<string, boolean> = {};
    for (const key of CAPABILITY_KEYS) {
      capabilities[key] = input.capabilities[key] ?? false;
    }
    const result = await pool.query(
      `UPDATE user_categories
          SET name = $2,
              description = $3,
              color = $4,
              station_permissions = $5::station_type[],
              capabilities = $6,
              active = $7,
              updated_at = now()
        WHERE id = $1
        RETURNING id,
                  name,
                  description,
                  color,
                  station_permissions AS "stationPermissions",
                  capabilities,
                  active`,
      [req.params.id, input.name, input.description, input.color, input.stationPermissions, JSON.stringify(capabilities), input.active]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: "not_found", message: "Category not found." });
    }
    return res.json({ category: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

// Delete category (soft-delete: deactivate)
categoriesRouter.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(
      "UPDATE user_categories SET active = FALSE, updated_at = now() WHERE id = $1 RETURNING id",
      [req.params.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: "not_found", message: "Category not found." });
    }
    // Unlink users from deactivated category
    await pool.query("UPDATE users SET category_id = NULL WHERE category_id = $1", [req.params.id]);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});
