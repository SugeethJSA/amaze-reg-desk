import type pg from "pg";
import type { StationType } from "../types.js";

export async function resolveActiveRule(client: pg.Pool | pg.PoolClient, station: StationType, ruleId?: string) {
  if (ruleId) {
    const result = await client.query(
      "SELECT * FROM scan_rules WHERE id = $1 AND active = TRUE",
      [ruleId]
    );
    return result.rows[0] ?? null;
  }

  const result = await client.query(
    `SELECT *
       FROM scan_rules
      WHERE station = $1
        AND active = TRUE
        AND (starts_at IS NULL OR starts_at <= now())
        AND (ends_at IS NULL OR ends_at >= now())
      ORDER BY starts_at NULLS FIRST, created_at DESC
      LIMIT 1`,
    [station]
  );
  return result.rows[0] ?? null;
}

export function evaluateRule(rule: { station: StationType } | null, station: StationType) {
  if (!rule) {
    return { allowed: false, reason: "No active rule is available for this station." };
  }

  if (rule.station !== station) {
    return { allowed: false, reason: "The selected station does not match the scan rule." };
  }

  return { allowed: true, reason: "Accepted." };
}
