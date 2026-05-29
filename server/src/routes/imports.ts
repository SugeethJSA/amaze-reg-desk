import { Router } from "express";
import multer from "multer";
import { pool, withTransaction } from "../db/pool.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { parseExcel } from "../services/excel.js";

export const importsRouter = Router();
const upload = multer({ storage: multer.memoryStorage() });

importsRouter.post("/preview", requireAuth, requireAdmin, upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "missing_file", message: "Upload an .xlsx file." });
  }
  const rows = parseExcel(req.file.buffer);
  const validRows = rows.filter((row) => row.errors.length === 0);
  res.json({
    totalRows: rows.length,
    acceptedRows: validRows.length,
    rejectedRows: rows.length - validRows.length,
    rows
  });
});

importsRouter.post("/commit", requireAuth, requireAdmin, upload.single("file"), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: "missing_file", message: "Upload an .xlsx file." });
  }

  try {
    const rows = parseExcel(req.file.buffer);
    const validRows = rows.filter((row) => row.errors.length === 0 && row.data);

    const result = await withTransaction(async (client) => {
      const batch = await client.query(
        `INSERT INTO import_batches (filename, total_rows, accepted_rows, rejected_rows, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [req.file?.originalname ?? "import.xlsx", rows.length, validRows.length, rows.length - validRows.length, req.user?.id]
      );

      for (const row of validRows) {
        const data = row.data!;
        await client.query(
          `INSERT INTO attendees (external_ref, name, email, phone, college, department, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (email) DO UPDATE
           SET name = EXCLUDED.name,
               phone = EXCLUDED.phone,
               college = EXCLUDED.college,
               department = EXCLUDED.department,
               updated_at = now()`,
          [data.externalRef, data.name, data.email, data.phone, data.college, data.department, { importBatchId: batch.rows[0].id }]
        );
      }

      return batch.rows[0];
    });

    res.status(201).json({ batch: result, preview: rows });
  } catch (error) {
    next(error);
  }
});
