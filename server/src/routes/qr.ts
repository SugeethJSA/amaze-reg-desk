import { Router } from "express";
import QRCode from "qrcode";
import { z } from "zod";
import { pool, withTransaction } from "../db/pool.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { encryptQrPayload } from "../services/crypto.js";
import { sendQrEmail } from "../services/email.js";

export const qrRouter = Router();

qrRouter.post("/batches", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const input = z.object({ name: z.string().min(1).default(`QR batch ${new Date().toISOString()}`) }).parse(req.body);

    const batch = await withTransaction(async (client) => {
      const batchResult = await client.query(
        "INSERT INTO qr_batches (name, created_by) VALUES ($1, $2) RETURNING *",
        [input.name, req.user?.id]
      );

      const attendees = await client.query(
        `SELECT id, name, email
           FROM attendees
          WHERE id NOT IN (SELECT attendee_id FROM qr_codes)`
      );

      for (const attendee of attendees.rows) {
        const encrypted = encryptQrPayload({
          attendeeId: attendee.id,
          name: attendee.name,
          email: attendee.email,
          issuedAt: new Date().toISOString(),
          batchId: batchResult.rows[0].id
        });
        await client.query(
          `INSERT INTO qr_codes (attendee_id, batch_id, encrypted_payload, payload_hash, key_version)
           VALUES ($1, $2, $3, $4, $5)`,
          [attendee.id, batchResult.rows[0].id, encrypted.encryptedPayload, encrypted.payloadHash, encrypted.keyVersion]
        );
      }

      return { ...batchResult.rows[0], generatedCount: attendees.rowCount };
    });

    res.status(201).json({ batch });
  } catch (error) {
    next(error);
  }
});

qrRouter.post("/send", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const input = z.object({
      mode: z.enum(["unsent", "failed"]).default("unsent"),
      batchId: z.string().uuid().optional()
    }).parse(req.body);

    const qrResult = await pool.query(
      `SELECT q.*, a.name, a.email, a.metadata
         FROM qr_codes q
         JOIN attendees a ON a.id = q.attendee_id
        WHERE ($1::uuid IS NULL OR q.batch_id = $1)
          AND (
            ($2 = 'unsent' AND q.sent_at IS NULL)
            OR
            ($2 = 'failed' AND EXISTS (
              SELECT 1 FROM email_send_attempts e
               WHERE e.qr_code_id = q.id AND e.status = 'failed'
            ))
          )
        LIMIT 500`,
      [input.batchId ?? null, input.mode]
    );

    const settingsResult = await pool.query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('email_subject_template', 'email_body_template')");
    const settings = settingsResult.rows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {} as Record<string, string>);

    const results = [];
    for (const row of qrResult.rows) {
      try {
        const qrDataUrl = await QRCode.toDataURL(row.encrypted_payload);
        const variables = { ...row.data, name: row.name };
        const info = await sendQrEmail({
          to: row.email,
          qrDataUrl,
          subjectTemplate: settings.email_subject_template,
          bodyTemplate: settings.email_body_template,
          variables
        });
        await pool.query(
          `INSERT INTO email_send_attempts (qr_code_id, batch_id, recipient_email, status, provider_message_id)
           VALUES ($1, $2, $3, 'sent', $4)`,
          [row.id, row.batch_id, row.email, info.messageId]
        );
        await pool.query("UPDATE qr_codes SET sent_at = now() WHERE id = $1", [row.id]);
        results.push({ qrCodeId: row.id, email: row.email, status: "sent" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown email error.";
        await pool.query(
          `INSERT INTO email_send_attempts (qr_code_id, batch_id, recipient_email, status, error_message)
           VALUES ($1, $2, $3, 'failed', $4)`,
          [row.id, row.batch_id, row.email, message]
        );
        results.push({ qrCodeId: row.id, email: row.email, status: "failed", error: message });
      }
    }

    res.json({ attempted: results.length, results });
  } catch (error) {
    next(error);
  }
});

qrRouter.get("/export.csv", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT a.name, a.email, q.encrypted_payload, q.payload_hash
         FROM qr_codes q
         JOIN attendees a ON a.id = q.attendee_id
        WHERE q.sent_at IS NULL
        ORDER BY a.name`
    );
    const lines = ["name,email,encrypted_payload,payload_hash"];
    for (const row of result.rows) {
      lines.push([row.name, row.email, row.encrypted_payload, row.payload_hash].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","));
    }
    res.header("content-type", "text/csv");
    res.attachment("qr-export.csv");
    res.send(lines.join("\n"));
  } catch (error) {
    next(error);
  }
});
