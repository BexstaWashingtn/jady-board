import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { ApiSessionError, clearApiToken, createAuthenticatedRequest, readApiToken, saveApiToken } from "../src/board/board.api-session.js";

describe("API-Browsersitzung", () => {
  test("speichert Tokens ausschließlich im übergebenen Session-Store und bindet sie an die API", () => {
    const storage = memoryStorage();
    saveApiToken(storage, "https://api.example", " secret-token ");
    assert.equal(readApiToken(storage, "https://api.example"), "secret-token");
    assert.equal(readApiToken(storage, "https://other.example"), null);
    clearApiToken(storage);
    assert.equal(readApiToken(storage, "https://api.example"), null);
    assert.throws(() => saveApiToken(storage, "https://api.example", "  "), /Zugriffstoken/);
  });

  test("ergänzt Bearer-Token und Request-ID ohne bestehende Header zu verlieren", async () => {
    let received;
    const request = createAuthenticatedRequest({
      token: () => "session-secret", requestId: () => "request-12345678",
      request: async (input, init) => { received = { input, init }; return response(200); },
    });
    await request("https://api.example/boards", { headers: { Accept: "application/json" } });
    assert.equal(received.input, "https://api.example/boards");
    assert.equal(received.init.headers.get("Accept"), "application/json");
    assert.equal(received.init.headers.get("Authorization"), "Bearer session-secret");
    assert.equal(received.init.headers.get("X-Request-ID"), "request-12345678");
  });

  test("behandelt Auth-, Berechtigungs-, Konflikt- und Rate-Limit-Fehler zentral", async () => {
    let unauthorized = 0;
    for (const [status, pattern, retryAfter] of [
      [401, /abgelaufen/, null], [403, /Berechtigungen/, null], [409, /zwischenzeitlich/, null], [429, /7 Sekunden/, "7"],
    ]) {
      const request = createAuthenticatedRequest({
        token: () => "token", onUnauthorized: () => { unauthorized += 1; },
        request: async () => response(status, retryAfter),
      });
      await assert.rejects(request("https://api.example"), (error) => error instanceof ApiSessionError && error.status === status && pattern.test(error.message));
    }
    assert.equal(unauthorized, 1);
  });
});

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
}

function response(status, retryAfter = null) {
  return { status, headers: new Headers(retryAfter ? { "Retry-After": retryAfter } : {}) };
}
