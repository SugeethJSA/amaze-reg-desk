import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

export const settingsRouter = Router();

settingsRouter.get("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT setting_key, setting_value FROM system_settings"
    );
    const settings = result.rows.reduce((acc, row) => {
      acc[row.setting_key] = row.setting_value;
      return acc;
    }, {} as Record<string, any>);
    res.json({ settings });
  } catch (error) {
    next(error);
  }
});

settingsRouter.put("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const input = z.record(z.any()).parse(req.body);
    const keys = Object.keys(input);
    
    // Begin transaction for safety
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const key of keys) {
        await client.query(
          `INSERT INTO system_settings (setting_key, setting_value) 
           VALUES ($1, $2)
           ON CONFLICT (setting_key) DO UPDATE 
           SET setting_value = EXCLUDED.setting_value,
               updated_at = CURRENT_TIMESTAMP`,
          [key, JSON.stringify(input[key])]
        );
      }
      await client.query("COMMIT");
      res.json({ success: true });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});
