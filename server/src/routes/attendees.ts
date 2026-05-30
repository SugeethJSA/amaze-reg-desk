import { Router } from "express";
import { z } from "zod";
import { pool, withTransaction } from "../db/pool.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { encryptQrPayload } from "../services/crypto.js";

export const attendeesRouter = Router();

const AttendeeSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  college: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  externalRef: z.string().optional().nullable(),
  customFields: z.record(z.unknown()).default({})
    .refine(
      (record) => !Object.keys(record).some((key) => ["__proto__", "constructor", "prototype"].includes(key)),
      "Custom field keys must not contain prototype keys"
    )
});

attendeesRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const q = String(req.query.q ?? "");
    const result = await pool.query(
      `SELECT id,
              external_ref AS "externalRef",
              name,
              email,
              phone,
              college,
              department,
              metadata,
              registered_on_spot AS "registeredOnSpot",
              created_at AS "createdAt"
         FROM attendees
        WHERE $1 = '' OR name ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%'
        ORDER BY created_at DESC
        LIMIT 250`,
      [q]
    );
    res.json({ attendees: result.rows });
  } catch (error) {
    next(error);
  }
});

attendeesRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const input = AttendeeSchema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO attendees (external_ref, name, email, phone, college, department, metadata, registered_on_spot)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
       ON CONFLICT (email) DO UPDATE
       SET name = EXCLUDED.name,
           phone = EXCLUDED.phone,
           college = EXCLUDED.college,
           department = EXCLUDED.department,
           metadata = attendees.metadata || EXCLUDED.metadata,
           updated_at = now()
       RETURNING *`,
      [
        input.externalRef,
        input.name,
        input.email.toLowerCase(),
        input.phone,
        input.college,
        input.department,
        { customFields: input.customFields, verificationStatus: "verified" }
      ]
    );
    res.status(201).json({ attendee: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

attendeesRouter.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const input = AttendeeSchema.parse(req.body);
    const result = await pool.query(
      `UPDATE attendees
          SET name = $2,
              email = $3,
              phone = $4,
              college = $5,
              department = $6,
              external_ref = $7,
              metadata = attendees.metadata || $8::jsonb,
              updated_at = now()
        WHERE id = $1
        RETURNING *`,
      [
        req.params.id,
        input.name,
        input.email.toLowerCase(),
        input.phone,
        input.college,
        input.department,
        input.externalRef,
        JSON.stringify({ customFields: input.customFields })
      ]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: "not_found", message: "Attendee not found." });
    }
    return res.json({ attendee: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

attendeesRouter.post("/public-register", async (req, res, next) => {
  try {
    const input = AttendeeSchema.parse(req.body);
    const paymentProof = req.body.paymentProof;

    const result = await pool.query(
      `INSERT INTO attendees (external_ref, name, email, phone, college, department, metadata, registered_on_spot)
       VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)
       RETURNING *`,
      [
        input.externalRef,
        input.name,
        input.email.toLowerCase(),
        input.phone,
        input.college,
        input.department,
        JSON.stringify({
          verificationStatus: "pending",
          paymentProof,
          customFields: input.customFields
        })
      ]
    );
    return res.status(201).json({ attendee: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

attendeesRouter.post("/public-transfer", async (req, res, next) => {
  try {
    const { originalAttendeeId, recipient, paymentProof } = req.body;
    if (!originalAttendeeId) {
      return res.status(400).json({ error: "missing_original_id", message: "Original attendee ID is required." });
    }

    const parsedRecipient = AttendeeSchema.parse(recipient);

    const original = await pool.query("SELECT * FROM attendees WHERE id = $1", [originalAttendeeId]);
    if (!original.rows[0]) {
      return res.status(404).json({ error: "original_not_found", message: "Original attendee not found. Check the ID and try again." });
    }

    const originalMeta = original.rows[0].metadata || {};
    if (originalMeta.status === "transferred" || originalMeta.verificationStatus === "transferred") {
      return res.status(400).json({ error: "already_transferred", message: "This ticket has already been transferred." });
    }

    const pendingTransfer = await pool.query(
      `SELECT 1 FROM attendees WHERE metadata->>'transferredFrom' = $1 AND metadata->>'verificationStatus' = 'pending' LIMIT 1`,
      [originalAttendeeId]
    );
    if (pendingTransfer.rows[0]) {
      return res.status(400).json({ error: "pending_transfer", message: "A transfer request is already pending for this ticket." });
    }

    const result = await pool.query(
      `INSERT INTO attendees (name, email, phone, college, department, metadata, registered_on_spot)
       VALUES ($1, $2, $3, $4, $5, $6, FALSE)
       RETURNING *`,
      [
        parsedRecipient.name,
        parsedRecipient.email.toLowerCase(),
        parsedRecipient.phone,
        parsedRecipient.college,
        parsedRecipient.department,
        JSON.stringify({
          verificationStatus: "pending",
          paymentProof,
          transferredFrom: originalAttendeeId,
          customFields: parsedRecipient.customFields
        })
      ]
    );

    return res.status(201).json({ recipientAttendee: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

attendeesRouter.post("/:id/verify", requireAuth, async (req, res, next) => {
  try {
    const { action } = req.body;
    if (action !== "approve" && action !== "reject") {
      return res.status(400).json({ error: "invalid_action", message: "Action must be approve or reject." });
    }

    const result = await withTransaction(async (client) => {
      const attendeeResult = await client.query("SELECT * FROM attendees WHERE id = $1", [req.params.id]);
      const attendee = attendeeResult.rows[0];
      if (!attendee) {
        throw new Error("Attendee not found.");
      }

      const meta = attendee.metadata || {};
      if (meta.verificationStatus !== "pending") {
        throw new Error("Attendee is not in a pending verification state.");
      }

      if (action === "reject") {
        const updated = await client.query(
          `UPDATE attendees
              SET metadata = jsonb_set(metadata, '{verificationStatus}', '"rejected"'),
                  updated_at = now()
            WHERE id = $1
            RETURNING *`,
          [req.params.id]
        );
        return updated.rows[0];
      }

      const updatedMeta = {
        ...meta,
        verificationStatus: "verified"
      };
      
      const updatedAttendeeResult = await client.query(
        `UPDATE attendees
            SET metadata = $2,
                updated_at = now()
          WHERE id = $1
          RETURNING *`,
        [req.params.id, JSON.stringify(updatedMeta)]
      );
      const updatedAttendee = updatedAttendeeResult.rows[0];

      if (meta.transferredFrom) {
        const originalId = meta.transferredFrom;
        const originalResult = await client.query("SELECT * FROM attendees WHERE id = $1", [originalId]);
        const original = originalResult.rows[0];
        if (original) {
          const originalMeta = original.metadata || {};
          originalMeta.status = "transferred";
          originalMeta.transferredTo = updatedAttendee.id;
          originalMeta.verificationStatus = "transferred";

          await client.query(
            `UPDATE attendees
                SET metadata = $2,
                    updated_at = now()
              WHERE id = $1`,
            [originalId, JSON.stringify(originalMeta)]
          );

          await client.query("DELETE FROM qr_codes WHERE attendee_id = $1", [originalId]);
        }
      }

      const encrypted = encryptQrPayload({
        attendeeId: updatedAttendee.id,
        name: updatedAttendee.name,
        email: updatedAttendee.email,
        issuedAt: new Date().toISOString(),
        verifiedAt: new Date().toISOString()
      });

      await client.query(
        `INSERT INTO qr_codes (attendee_id, encrypted_payload, payload_hash, key_version)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (attendee_id) DO UPDATE
         SET encrypted_payload = EXCLUDED.encrypted_payload,
             payload_hash = EXCLUDED.payload_hash,
             key_version = EXCLUDED.key_version`,
        [updatedAttendee.id, encrypted.encryptedPayload, encrypted.payloadHash, encrypted.keyVersion]
      );

      return updatedAttendee;
    });

    return res.json({ attendee: result });
  } catch (error) {
    return next(error);
  }
});
