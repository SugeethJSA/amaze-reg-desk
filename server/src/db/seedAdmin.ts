import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "./pool.js";

const SeedSchema = z.object({
  ADMIN_NAME: z.string().default("Reg Desk Admin"),
  ADMIN_EMAIL: z.string().email().default("admin@example.com"),
  ADMIN_PASSWORD: z.string().min(8).default("ChangeMe123!")
});

async function seedAdmin() {
  const input = SeedSchema.parse(process.env);
  const passwordHash = await bcrypt.hash(input.ADMIN_PASSWORD, 12);
  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (email) DO UPDATE
     SET name = EXCLUDED.name,
         password_hash = EXCLUDED.password_hash,
         role = 'admin',
         active = TRUE
     RETURNING id, name, email, role`,
    [input.ADMIN_NAME, input.ADMIN_EMAIL, passwordHash]
  );

  console.log(`Seeded admin ${result.rows[0].email}`);
  await pool.end();
}

seedAdmin().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
