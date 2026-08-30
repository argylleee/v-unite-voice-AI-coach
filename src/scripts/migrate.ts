// Applies every SQL file in supabase/migrations/ in filename order against SUPABASE_DB_URL.
// The migrations are written to be idempotent (create ... if not exists, create or replace,
// enable row level security), so re-running this is safe. Usage: `npm run db:migrate`.
import "./env";

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error(
    "SUPABASE_DB_URL is not set. Supabase dashboard -> Project Settings -> Database ->" +
      " Connection string (URI). See .env.example.",
  );
  process.exit(1);
}

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.error(`No .sql files found in ${migrationsDir}`);
  process.exit(1);
}

const sql = postgres(dbUrl, { max: 1, onnotice: () => {} });

try {
  for (const file of files) {
    const text = readFileSync(join(migrationsDir, file), "utf8");
    process.stdout.write(`applying ${file} ... `);
    await sql.unsafe(text);
    console.log("ok");
  }
  console.log(`\ndone: ${files.length} migration(s) applied`);
} catch (err) {
  console.error("\nmigration failed:", err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
