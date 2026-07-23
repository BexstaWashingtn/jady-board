import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { createServer } from "node:http";

import { createApiHandler } from "../server/src/http/app.js";

/** @type {import("node:http").Server[]} */
const servers = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
});

describe("Server-Health-API", () => {
  test("meldet den laufenden Prozess als gesund", async () => {
    const baseUrl = await listen({ query: async () => ({ rows: [] }) });
    const response = await fetch(`${baseUrl}/api/health`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
    assert.match(response.headers.get("content-type") ?? "", /application\/json/);
  });

  test("meldet eine erreichbare Datenbank als bereit", async () => {
    let query = "";
    const baseUrl = await listen({
      query: async (sql) => {
        query = String(sql);
        return { rows: [{ "?column?": 1 }] };
      },
    });
    const response = await fetch(`${baseUrl}/api/ready`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ready" });
    assert.equal(query, "SELECT 1");
  });

  test("liefert bei Datenbankausfall einen stabilen Fehlervertrag", async () => {
    const baseUrl = await listen({ query: async () => { throw new Error("offline"); } });
    const response = await fetch(`${baseUrl}/api/ready`);

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      status: "unavailable",
      error: {
        code: "DATABASE_UNAVAILABLE",
        message: "Database connection unavailable.",
      },
    });
  });

  test("liefert für unbekannte Routen einen strukturierten 404-Fehler", async () => {
    const baseUrl = await listen({ query: async () => ({ rows: [] }) });
    const response = await fetch(`${baseUrl}/api/unknown`);

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      error: {
        code: "NOT_FOUND",
        message: "The requested API resource does not exist.",
      },
    });
  });
});

/**
 * @param {{query: (sql: unknown) => Promise<unknown>}} database
 */
async function listen(database) {
  const server = createServer(createApiHandler({ database }));
  servers.push(server);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server has no TCP address.");
  return `http://127.0.0.1:${address.port}`;
}
