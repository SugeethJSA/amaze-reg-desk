import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

export const statsRouter = Router();

statsRouter.get("/dashboard", requireAuth, async (_req, res, next) => {
  try {
    const [attendees, qr, scans, stations] = await Promise.all([
      pool.query("SELECT count(*)::int AS total FROM attendees"),
      pool.query(
        `SELECT
          count(*)::int AS total,
          count(sent_at)::int AS sent,
          count(*) FILTER (WHERE sent_at IS NULL)::int AS unsent
         FROM qr_codes`
      ),
      pool.query(
        `SELECT
          count(*) FILTER (WHERE status = 'accepted')::int AS accepted,
          count(*) FILTER (WHERE status = 'duplicate')::int AS duplicate,
          count(*) FILTER (WHERE status = 'denied')::int AS denied,
          count(*) FILTER (WHERE station = 'food' AND status = 'accepted')::int AS food,
          count(*) FILTER (WHERE station = 'kit' AND status = 'accepted')::int AS kit
         FROM scan_events`
      ),
      pool.query(
        `SELECT station, status, count(*)::int AS count
           FROM scan_events
          GROUP BY station, status
          ORDER BY station, status`
      )
    ]);

    res.json({
      attendees: attendees.rows[0],
      qr: qr.rows[0],
      scans: scans.rows[0],
      stations: stations.rows
    });
  } catch (error) {
    next(error);
  }
});
