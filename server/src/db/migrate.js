import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { loadConfig } from "../config.js";
import { createDatabase } from "./database.js";

const migrationsDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "../../migrations");

/**
 * Applies every pending SQL migration exactly once.
 *
 * @param {import("./database.js").Database} database
 * @param {string} [directory]
 */
export async function migrateDatabase(database, directory = migrationsDirectory) {
  const client = await database.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [1_240_726_193]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const appliedResult = await client.query("SELECT name, checksum FROM schema_migrations");
    const applied = new Map(appliedResult.rows.map((row) => [String(row.name), String(row.checksum)]));
    const names = (await readdir(directory))
      .filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name))
      .sort();

    for (const name of names) {
      const sql = await readFile(resolve(directory, name), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const previousChecksum = applied.get(name);
      if (previousChecksum && previousChecksum !== checksum) {
        throw new Error(`Migration ${name} was changed after it had been applied.`);
      }
      if (previousChecksum) continue;

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)",
          [name, checksum],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [1_240_726_193]).catch(() => {});
    client.release();
  }
}

async function main() {
  const config = loadConfig();
  const database = createDatabase(config);
  try {
    await migrateDatabase(database);
    process.stdout.write("Database migrations completed.\n");
  } finally {
    await database.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
