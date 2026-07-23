import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, test } from "node:test";

import { migrateDatabase } from "../server/src/db/migrate.js";

/** @type {string[]} */
const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, {
    force: true,
    recursive: true,
  })));
});

describe("PostgreSQL-Migrationen", () => {
  test("führt ausstehende Migrationen geordnet und transaktional aus", async () => {
    const directory = await migrationDirectory({
      "0002_second.sql": "SELECT 2;",
      "0001_first.sql": "SELECT 1;",
    });
    const harness = databaseHarness([]);

    await migrateDatabase(harness.database, directory);

    const migrationSql = harness.calls.filter((call) => /^SELECT [12];$/.test(call.sql));
    assert.deepEqual(migrationSql.map(({ sql }) => sql), ["SELECT 1;", "SELECT 2;"]);
    assert.equal(harness.calls.filter(({ sql }) => sql === "BEGIN").length, 2);
    assert.equal(harness.calls.filter(({ sql }) => sql === "COMMIT").length, 2);
    assert.equal(harness.released, true);
  });

  test("überspringt bereits unverändert angewendete Migrationen", async () => {
    const sql = "SELECT 1;";
    const directory = await migrationDirectory({ "0001_first.sql": sql });
    const checksum = createHash("sha256").update(sql).digest("hex");
    const harness = databaseHarness([{ name: "0001_first.sql", checksum }]);

    await migrateDatabase(harness.database, directory);

    assert.equal(harness.calls.some((call) => call.sql === sql), false);
    assert.equal(harness.calls.some((call) => call.sql === "BEGIN"), false);
  });

  test("weist nachträglich veränderte Migrationen zurück", async () => {
    const directory = await migrationDirectory({ "0001_first.sql": "SELECT 1;" });
    const harness = databaseHarness([{ name: "0001_first.sql", checksum: "old-checksum" }]);

    await assert.rejects(
      migrateDatabase(harness.database, directory),
      /changed after it had been applied/,
    );
    assert.equal(harness.released, true);
  });

  test("rollt eine fehlgeschlagene Migration zurück", async () => {
    const directory = await migrationDirectory({ "0001_first.sql": "BROKEN SQL;" });
    const harness = databaseHarness([], "BROKEN SQL;");

    await assert.rejects(migrateDatabase(harness.database, directory), /syntax error/);

    assert.equal(harness.calls.some(({ sql }) => sql === "ROLLBACK"), true);
    assert.equal(harness.calls.some(({ sql }) => sql === "COMMIT"), false);
  });
});

/** @param {Record<string, string>} files */
async function migrationDirectory(files) {
  const directory = await mkdtemp(join(tmpdir(), "jady-migrations-"));
  temporaryDirectories.push(directory);
  await Promise.all(Object.entries(files).map(([name, sql]) => writeFile(join(directory, name), sql)));
  return directory;
}

/**
 * @param {{name: string, checksum: string}[]} applied
 * @param {string} [failingSql]
 */
function databaseHarness(applied, failingSql) {
  /** @type {{sql: string, values?: unknown[]}[]} */
  const calls = [];
  let released = false;
  const client = {
    async query(sql, values) {
      const statement = String(sql).trim();
      calls.push({ sql: statement, values });
      if (statement === failingSql) throw new Error("syntax error");
      if (statement === "SELECT name, checksum FROM schema_migrations") return { rows: applied };
      return { rows: [] };
    },
    release() { released = true; },
  };
  return {
    calls,
    get released() { return released; },
    database: {
      async connect() { return client; },
    },
  };
}
