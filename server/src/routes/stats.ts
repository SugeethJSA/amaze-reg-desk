import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

export const statsRouter = Router();

statsRouter.get("/dashboard", requireAuth, async (_req, res, next) => {
  try {
    const [attendees, qr, scans, stations, timeline, chartableFields, attendeeMetadata] = await Promise.all([
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
          count(*)::int AS total,
          count(*) FILTER (WHERE status = 'accepted')::int AS accepted,
          count(*) FILTER (WHERE status = 'duplicate')::int AS duplicate,
          count(*) FILTER (WHERE status = 'denied')::int AS denied,
          count(*) FILTER (WHERE status = 'pending')::int AS pending,
          count(*) FILTER (WHERE station = 'food' AND status = 'accepted')::int AS food,
          count(*) FILTER (WHERE station = 'kit' AND status = 'accepted')::int AS kit
         FROM scan_events`
      ),
      pool.query(
        `SELECT station, status, count(*)::int AS count
           FROM scan_events
          GROUP BY station, status
          ORDER BY station, status`
      ),
      pool.query(
        `SELECT to_char(date_trunc('hour', scanned_at), 'HH24:MI') AS label,
                count(*)::int AS count
           FROM scan_events
          WHERE scanned_at >= now() - interval '12 hours'
          GROUP BY date_trunc('hour', scanned_at)
          ORDER BY date_trunc('hour', scanned_at)`
      ),
      pool.query(
        `SELECT field_key AS "fieldKey",
                label,
                field_type AS "fieldType",
                options
           FROM registration_form_fields
          WHERE active = TRUE
            AND field_type IN ('select', 'checkbox')
          ORDER BY sort_order ASC, label ASC`
      ),
      pool.query(
        `SELECT metadata
           FROM attendees
          WHERE metadata ? 'customFields'`
      )
    ]);

    const customFieldBreakdowns = chartableFields.rows.map((field) => {
      const counts = new Map<string, number>();
      const options = Array.isArray(field.options) ? field.options : [];
      for (const option of options) {
        counts.set(String(option), 0);
      }
      if (field.fieldType === "checkbox") {
        counts.set("Yes", 0);
        counts.set("No", 0);
      }

      for (const attendee of attendeeMetadata.rows) {
        const customFields = attendee.metadata?.customFields ?? {};
        const rawValue = customFields[field.fieldKey];
        if (rawValue === undefined || rawValue === null || rawValue === "") {
          continue;
        }
        const label = field.fieldType === "checkbox"
          ? (rawValue === true || rawValue === "true" ? "Yes" : "No")
          : String(rawValue);
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }

      return {
        fieldKey: field.fieldKey,
        label: field.label,
        fieldType: field.fieldType,
        values: Array.from(counts.entries())
          .map(([label, count]) => ({ label, count }))
          .filter((item) => item.count > 0 || options.includes(item.label) || field.fieldType === "checkbox")
      };
    });

    const stationTotals = stations.rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.station] = (acc[row.station] ?? 0) + Number(row.count);
      return acc;
    }, {});

    res.json({
      attendees: attendees.rows[0],
      qr: qr.rows[0],
      scans: scans.rows[0],
      stations: stations.rows,
      stationTotals: Object.entries(stationTotals).map(([station, count]) => ({ station, count })),
      timeline: timeline.rows,
      customFieldBreakdowns
    });
  } catch (error) {
    next(error);
  }
});
