import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

export const formFieldsRouter = Router();

const FieldSchema = z.object({
  fieldKey: z.string().min(1).regex(/^[a-z][a-z0-9_]*$/, "Use lowercase letters, numbers, and underscores. Start with a letter.")
    .refine((val) => !["__proto__", "constructor", "prototype"].includes(val), "Forbid prototype keys"),
  label: z.string().min(1),
  fieldType: z.enum(["text", "email", "phone", "number", "select", "textarea", "checkbox", "hidden", "calculated"]),
  required: z.boolean().default(false),
  options: z.array(z.string().min(1)).default([]),
  sortOrder: z.coerce.number().int().default(0),
  active: z.boolean().default(true),
  showInList: z.boolean().default(false),
  isSystem: z.boolean().default(false),
  visibilityRules: z.any().nullable().optional(),
  validations: z.any().nullable().optional(),
  calculation: z.string().nullable().optional()
});

// Public endpoint — no auth required — used by PublicRegister & PublicTransfer pages
formFieldsRouter.get("/public", async (_req, res, next) => {
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
              show_in_list AS "showInList",
              is_system AS "isSystem",
              visibility_rules AS "visibilityRules",
              validations,
              calculation
         FROM registration_form_fields
        WHERE active = TRUE
        ORDER BY sort_order ASC, label ASC`
    );
    res.json({ fields: result.rows });
  } catch (error) {
    next(error);
  }
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
              show_in_list AS "showInList",
              is_system AS "isSystem",
              visibility_rules AS "visibilityRules",
              validations,
              calculation,
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
         (field_key, label, field_type, required, options, sort_order, active, show_in_list, is_system, visibility_rules, validations, calculation)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id,
                 field_key AS "fieldKey",
                 label,
                 field_type AS "fieldType",
                 required,
                 options,
                 sort_order AS "sortOrder",
                 active,
                 show_in_list AS "showInList",
                 is_system AS "isSystem",
                 visibility_rules AS "visibilityRules",
                 validations,
                 calculation`,
      [input.fieldKey, input.label, input.fieldType, input.required, JSON.stringify(input.options), input.sortOrder, input.active, input.showInList, false, input.visibilityRules ? JSON.stringify(input.visibilityRules) : null, input.validations ? JSON.stringify(input.validations) : null, input.calculation || null]
    );
    res.status(201).json({ field: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

formFieldsRouter.put("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const input = FieldSchema.parse(req.body);
    const existingResult = await pool.query("SELECT is_system FROM registration_form_fields WHERE id = $1", [req.params.id]);
    if (!existingResult.rows[0]) {
      return res.status(404).json({ error: "not_found", message: "Form field not found." });
    }
    const isSystem = existingResult.rows[0].is_system;
    
    const result = await pool.query(
      `UPDATE registration_form_fields
          SET field_key = CASE WHEN is_system THEN field_key ELSE $2 END,
              field_type = CASE WHEN is_system THEN field_type ELSE $4 END,
              label = $3,
              required = $5,
              options = $6,
              sort_order = $7,
              active = $8,
              show_in_list = $9,
              visibility_rules = $10,
              validations = $11,
              calculation = $12,
              updated_at = now()
        WHERE id = $1
        RETURNING id,
                  field_key AS "fieldKey",
                  label,
                  field_type AS "fieldType",
                  required,
                  options,
                  sort_order AS "sortOrder",
                  active,
                  show_in_list AS "showInList",
                  is_system AS "isSystem",
                  visibility_rules AS "visibilityRules",
                  validations,
                  calculation`,
      [req.params.id, input.fieldKey, input.label, input.fieldType, input.required, JSON.stringify(input.options), input.sortOrder, input.active, input.showInList, input.visibilityRules ? JSON.stringify(input.visibilityRules) : null, input.validations ? JSON.stringify(input.validations) : null, input.calculation || null]
    );
    return res.json({ field: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

formFieldsRouter.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const check = await pool.query("SELECT is_system FROM registration_form_fields WHERE id = $1", [req.params.id]);
    if (!check.rows[0]) {
      return res.status(404).json({ error: "not_found", message: "Form field not found." });
    }
    if (check.rows[0].is_system) {
      return res.status(400).json({ error: "system_field", message: "System fields cannot be deleted." });
    }
    await pool.query("DELETE FROM registration_form_fields WHERE id = $1", [req.params.id]);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});
