import { Router } from "express";
import { z } from "zod";
import { withTransaction } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { hashPayload } from "../services/crypto.js";
import { evaluateRule, resolveActiveRule } from "../services/rules.js";
import type { ScanSyncInput } from "../types.js";

export const scansRouter = Router();

const ScanSchema = z.object({
  localScanId: z.string().min(1),
  encryptedPayload: z.string().min(1),
  payloadHash: z.string().min(1),
  station: z.enum(["entry", "food", "kit", "custom"]),
  ruleId: z.string().uuid().optional(),
  scannedAt: z.string().datetime(),
  offlineCreated: z.boolean(),
  deviceId: z.string().min(1)
});

scansRouter.post("/sync", requireAuth, async (req, res, next) => {
  try {
    const scans = z.array(ScanSchema).parse(req.body.scans) as ScanSyncInput[];

    const results = await withTransaction(async (client) => {
      const synced = [];

      for (const scan of scans) {
        if (req.user?.role === "volunteer") {
          const permission = await client.query(
            `SELECT 1
               FROM volunteer_keys
              WHERE user_id = $1
                AND revoked_at IS NULL
                AND $2::station_type = ANY(station_permissions)
              LIMIT 1`,
            [req.user.id, scan.station]
          );
          if (!permission.rows[0]) {
            synced.push({ localScanId: scan.localScanId, status: "denied", reason: "Volunteer is not permitted for this station." });
            continue;
          }
        }

        const previous = await client.query("SELECT * FROM scan_events WHERE local_scan_id = $1", [scan.localScanId]);
        if (previous.rows[0]) {
          synced.push({ localScanId: scan.localScanId, status: previous.rows[0].status, reason: "Already synced." });
          continue;
        }

        if (hashPayload(scan.encryptedPayload) !== scan.payloadHash) {
          synced.push({ localScanId: scan.localScanId, status: "denied", reason: "QR hash mismatch." });
          continue;
        }

        const qr = await client.query("SELECT * FROM qr_codes WHERE payload_hash = $1", [scan.payloadHash]);
        if (!qr.rows[0]) {
          synced.push({ localScanId: scan.localScanId, status: "denied", reason: "Unknown QR code." });
          continue;
        }

        const rule = await resolveActiveRule(client, scan.station, scan.ruleId);
        const decision = evaluateRule(rule, scan.station);
        let status = decision.allowed ? "accepted" : "denied";
        let reason = decision.reason;

        try {
          await client.query(
            `INSERT INTO scan_events
              (local_scan_id, qr_payload_hash, attendee_id, volunteer_id, rule_id, station, status, reason, scanned_at, offline_created)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              scan.localScanId,
              scan.payloadHash,
              qr.rows[0].attendee_id,
              req.user?.id,
              rule?.id ?? null,
              scan.station,
              status,
              reason,
              scan.scannedAt,
              scan.offlineCreated
            ]
          );
        } catch (error) {
          status = "duplicate";
          reason = "This QR has already been accepted for the same station/rule.";
          await client.query(
            `INSERT INTO scan_events
              (local_scan_id, qr_payload_hash, attendee_id, volunteer_id, rule_id, station, status, reason, scanned_at, offline_created)
             VALUES ($1, $2, $3, $4, $5, $6, 'duplicate', $7, $8, $9)
             ON CONFLICT (local_scan_id) DO NOTHING`,
            [
              scan.localScanId,
              scan.payloadHash,
              qr.rows[0].attendee_id,
              req.user?.id,
              rule?.id ?? null,
              scan.station,
              reason,
              scan.scannedAt,
              scan.offlineCreated
            ]
          );
        }

        await client.query(
          `INSERT INTO offline_sync_records
             (volunteer_id, device_id, local_scan_id, payload_hash, result_status, result_reason)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (local_scan_id) DO NOTHING`,
          [req.user?.id, scan.deviceId, scan.localScanId, scan.payloadHash, status, reason]
        );
        synced.push({ localScanId: scan.localScanId, status, reason });
      }

      return synced;
    });

    res.json({ results });
  } catch (error) {
    next(error);
  }
});
