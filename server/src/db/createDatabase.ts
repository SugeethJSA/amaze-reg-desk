import pg from "pg";
import { config } from "../config.js";

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

async function createDatabase() {
  const targetUrl = new URL(config.DATABASE_URL);
  const databaseName = targetUrl.pathname.replace(/^\//, "");

  if (!databaseName) {
    throw new Error("DATABASE_URL must include a database name.");
  }

  const adminUrl = new URL(config.DATABASE_URL);
  adminUrl.pathname = "/postgres";

  const client = new pg.Client({ connectionString: adminUrl.toString() });
  await client.connect();

  try {
    const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName]);
    if (existing.rows[0]) {
      console.log(`Database ${databaseName} already exists.`);
      return;
    }

    await client.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
    console.log(`Created database ${databaseName}.`);
  } finally {
    await client.end();
  }
}

createDatabase().catch((error) => {
  console.error(error);
  process.exit(1);
});
