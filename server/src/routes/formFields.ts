import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

export const formFieldsRouter = Router();

const FieldSchema = z.object({
  fieldKey: z.string().min(1).regex(/^[a-z][a-z0-9_]*$/, "Use lowercase letters, numbers, and underscores. Start with a letter."),
  label: z.string().min(1),
  fieldType: z.enum(["text", "email", "phone", "number", "select", "textarea", "checkbox"]),
  required: z.boolean().default(false),
  options: z.array(z.string().min(1)).default([]),
  sortOrder: z.coerce.number().int().default(0),
  active: z.boolean().default(true)
});

formFieldsRouter.get("/", requireAuth, async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id,
              field_key AS "fieldKey",
              label,
              field_type AS "fieldType",
              required,
              options,
              sort_order AS "sortOrder",
              active,
              created_at AS "createdAt",
              updated_at AS "updatedAt"
         FROM registration_form_fields
        ORDER BY active DESC, sort_order ASC, label ASC`
    );
    res.json({ fields: result.rows });
  } catch (error) {
    next(error);
  }
});

formFieldsRouter.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const input = FieldSchema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO registration_form_fields
         (field_key, label, field_type, required, options, sort_order, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id,
                 field_key AS "fieldKey",
                 label,
                 field_type AS "fieldType",
                 required,
                 options,
                 sort_order AS "sortOrder",
                 active`,
      [input.fieldKey, input.label, input.fieldType, input.required, JSON.stringify(input.options), input.sortOrder, input.active]
    );
    res.status(201).json({ field: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

formFieldsRouter.put("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const input = FieldSchema.parse(req.body);
    const result = await pool.query(
      `UPDATE registration_form_fields
          SET field_key = $2,
              label = $3,
              field_type = $4,
              required = $5,
              options = $6,
              sort_order = $7,
              active = $8,
              updated_at = now()
        WHERE id = $1
        RETURNING id,
                  field_key AS "fieldKey",
                  label,
                  field_type AS "fieldType",
                  required,
                  options,
                  sort_order AS "sortOrder",
                  active`,
      [req.params.id, input.fieldKey, input.label, input.fieldType, input.required, JSON.stringify(input.options), input.sortOrder, input.active]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: "not_found", message: "Form field not found." });
    }
    return res.json({ field: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

formFieldsRouter.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query("DELETE FROM registration_form_fields WHERE id = $1 RETURNING id", [req.params.id]);
    if (!result.rows[0]) {
      return res.status(404).json({ error: "not_found", message: "Form field not found." });
    }
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});
