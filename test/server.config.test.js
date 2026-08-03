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
      CORS_ORIGIN: "https://board.example.com",
      API_BEARER_IDENTITIES: '[{"userId":"3f6fd6ee-952c-5f00-9ef8-3ce172499a19","token":"abcdefghijklmnopqrstuvwxyz-123456"}]',
      RATE_LIMIT_REQUESTS: "60",
      RATE_LIMIT_WINDOW_MS: "30000",
    }), {
      databaseUrl: "postgresql://localhost/jady",
      databaseSsl: true,
      host: "0.0.0.0",
      port: 8080,
      devUserId: null,
      corsOrigin: "https://board.example.com",
      bearerIdentities: [{ userId: "3f6fd6ee-952c-5f00-9ef8-3ce172499a19", token: "abcdefghijklmnopqrstuvwxyz-123456" }],
      rateLimit: 60,
      rateLimitWindowMs: 30000,
      authMode: "controlled-bearer",
      clerk: null,
    });
  });

  test("verwendet sichere lokale Server-Standardwerte", () => {
    const config = loadConfig({ DATABASE_URL: "postgresql://localhost/jady" });
    assert.equal(config.host, "127.0.0.1");
    assert.equal(config.port, 3000);
    assert.equal(config.databaseSsl, false);
    assert.equal(config.devUserId, null);
    assert.equal(config.corsOrigin, null);
    assert.deepEqual(config.bearerIdentities, []);
    assert.equal(config.rateLimit, 120);
    assert.equal(config.rateLimitWindowMs, 60000);
    assert.equal(config.authMode, "development");
    assert.equal(config.clerk, null);
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
    assert.throws(
      () => loadConfig({ DATABASE_URL: "postgresql://localhost/jady", CORS_ORIGIN: "*" }),
      /CORS_ORIGIN/,
    );
    assert.throws(
      () => loadConfig({ DATABASE_URL: "postgresql://localhost/jady", CORS_ORIGIN: "board.example.com" }),
      /CORS_ORIGIN/,
    );
    assert.throws(() => loadConfig({ DATABASE_URL: "postgresql://localhost/jady", RATE_LIMIT_REQUESTS: "0" }), /RATE_LIMIT_REQUESTS/);
    assert.throws(() => loadConfig({ DATABASE_URL: "postgresql://localhost/jady", API_BEARER_IDENTITIES: "not-json" }), /API_BEARER_IDENTITIES/);
    assert.throws(() => loadConfig({ DATABASE_URL: "postgresql://localhost/jady", API_BEARER_IDENTITIES: '[{"userId":"bad","token":"short"}]' }), /userId/);
    assert.throws(() => loadConfig({
      DATABASE_URL: "postgresql://localhost/jady",
      DEV_USER_ID: "8acf3017-cf6e-589b-bd47-a1d8ccec16a8",
      API_BEARER_IDENTITIES: '[{"userId":"3f6fd6ee-952c-5f00-9ef8-3ce172499a19","token":"abcdefghijklmnopqrstuvwxyz-123456"}]',
    }), /cannot be configured together/);
  });

  test("liest eine vollständige Clerk-Konfiguration", () => {
    const config = loadConfig({
      DATABASE_URL: "postgresql://localhost/jady", AUTH_MODE: "clerk",
      CLERK_PUBLISHABLE_KEY: "pk_test_Y2xlcmsuZXhhbXBsZS5jb20k",
      CLERK_SECRET_KEY: "sk_test_secret",
      CLERK_AUTHORIZED_PARTIES: "https://board.example.com,http://127.0.0.1:4173",
    });
    assert.equal(config.authMode, "clerk");
    assert.deepEqual(config.clerk, {
      publishableKey: "pk_test_Y2xlcmsuZXhhbXBsZS5jb20k", secretKey: "sk_test_secret",
      authorizedParties: ["https://board.example.com", "http://127.0.0.1:4173"],
    });
    assert.throws(() => loadConfig({ DATABASE_URL: "postgresql://localhost/jady", AUTH_MODE: "clerk" }), /incomplete/);
  });
});
