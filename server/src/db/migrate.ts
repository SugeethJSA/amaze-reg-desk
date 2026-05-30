import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const migrationsDir = join(__dirname, "migrations");
  const files = await readdir(migrationsDir);
  const sqlFiles = files.filter((file) => file.endsWith(".sql")).sort();

  console.log(`Found ${sqlFiles.length} migration file(s) to execute...`);

  for (const file of sqlFiles) {
    console.log(`Running migration: ${file}`);
    const sql = await readFile(join(migrationsDir, file), "utf8");
    await pool.query(sql);
  }

  await pool.end();
  console.log("Database migrations completed.");
}

migrate().catch(async (error) => {
  console.error("Migration failed:", error);
  await pool.end();
  process.exit(1);
});
