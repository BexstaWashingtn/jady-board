import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { loadConfig } from "../server/src/config.js";

describe("Server-Konfiguration", () => {
  test("liest eine vollständige Konfiguration", () => {
    assert.deepEqual(loadConfig({
      DATABASE_URL: "postgresql://localhost/jady",
      DATABASE_SSL: "true",
      SERVER_HOST: "0.0.0.0",
      SERVER_PORT: "8080",
      DEV_USER_ID: "8acf3017-cf6e-589b-bd47-a1d8ccec16a8",
    }), {
      databaseUrl: "postgresql://localhost/jady",
      databaseSsl: true,
      host: "0.0.0.0",
      port: 8080,
      devUserId: "8acf3017-cf6e-589b-bd47-a1d8ccec16a8",
    });
  });

  test("verwendet sichere lokale Server-Standardwerte", () => {
    const config = loadConfig({ DATABASE_URL: "postgresql://localhost/jady" });
    assert.equal(config.host, "127.0.0.1");
    assert.equal(config.port, 3000);
    assert.equal(config.databaseSsl, false);
    assert.equal(config.devUserId, null);
  });

  test("weist eine fehlende Datenbank und ungültige Ports zurück", () => {
    assert.throws(() => loadConfig({}), /DATABASE_URL/);
    assert.throws(
      () => loadConfig({ DATABASE_URL: "postgresql://localhost/jady", SERVER_PORT: "70000" }),
      /SERVER_PORT/,
    );
    assert.throws(
      () => loadConfig({ DATABASE_URL: "postgresql://localhost/jady", DEV_USER_ID: "user-1" }),
      /DEV_USER_ID/,
    );
  });
});
