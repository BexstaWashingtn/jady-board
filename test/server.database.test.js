import assert from "node:assert/strict";
import { test } from "node:test";

import { createPoolOptions } from "../server/src/db/database.js";

test("trennt gepoolte Anwendung und direkte Migrationsverbindung", () => {
  assert.deepEqual(createPoolOptions(
    { databaseSsl: true },
    "postgresql://direct.neon.example/jady",
  ), {
    connectionString: "postgresql://direct.neon.example/jady",
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: { rejectUnauthorized: true },
  });

  assert.equal(createPoolOptions(
    { databaseSsl: false },
    "postgresql://localhost/jady",
  ).ssl, false);
});
