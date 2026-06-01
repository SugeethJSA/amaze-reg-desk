import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

export const settingsRouter = Router();

settingsRouter.get("/public", async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ($1, $2, $3, $4, $5, $6, $7, $8)",
      ["app_name", "logo_url", "primary_color", "event_name", "public_registrations_enabled", "public_transfers_enabled", "volunteer_onspot_enabled", "admin_onspot_enabled"]
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
