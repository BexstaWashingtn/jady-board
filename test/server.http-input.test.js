import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { describe, test } from "node:test";

import { HttpInputError, isUuid, readJson } from "../server/src/http/http.js";
import { CONTROLLED_BEARER_ISSUER, createBearerIdentityResolver, createBearerPrincipalResolver, createDevelopmentIdentityResolver, createRequestIdentityResolver } from "../server/src/http/request-identity.js";
import { createRateLimiter } from "../server/src/http/rate-limiter.js";

describe("HTTP-Eingabevertraege", () => {
  test("liest JSON als bytesicher begrenzten Request-Body", async () => {
    assert.deepEqual(await readJson(Readable.from([Buffer.from('{"title":"Neu"}')])), { title: "Neu" });

    await assert.rejects(
      readJson(Readable.from([Buffer.alloc(64 * 1024 + 1, "x")])),
      (error) => error instanceof HttpInputError && error.code === "PAYLOAD_TOO_LARGE",
    );
  });

  test("verifiziert opaque Bearer-Tokens ohne Identitaets-Claims zu vertrauen", async () => {
    const userId = "8acf3017-cf6e-589b-bd47-a1d8ccec16a8";
    const token = "abcdefghijklmnopqrstuvwxyz-123456";
    const resolve = createBearerIdentityResolver([{ userId, token }]);
    const request = (authorization) => ({ headers: authorization ? { authorization } : {} });
    assert.equal(await resolve(/** @type {never} */ (request(`Bearer ${token}`))), userId);
    assert.equal(await resolve(/** @type {never} */ (request("Bearer wrong-token"))), null);
    assert.equal(await resolve(/** @type {never} */ (request("Basic abc"))), null);
    assert.equal(await resolve(/** @type {never} */ (request(null))), null);
  });

  test("trennt externe Principals von lokalen PostgreSQL-Benutzern", async () => {
    const request = /** @type {never} */ ({ headers: {} });
    let mappedPrincipal;
    const resolve = createRequestIdentityResolver({
      resolvePrincipal: async () => ({ issuer: "https://identity.example", subject: "external-123" }),
      resolveLocalUser: async (principal) => { mappedPrincipal = principal; return "8acf3017-cf6e-589b-bd47-a1d8ccec16a8"; },
    });
    assert.equal(await resolve(request), "8acf3017-cf6e-589b-bd47-a1d8ccec16a8");
    assert.deepEqual(mappedPrincipal, { issuer: "https://identity.example", subject: "external-123" });

    const unknown = createRequestIdentityResolver({
      resolvePrincipal: () => ({ issuer: "https://identity.example", subject: "unknown" }),
      resolveLocalUser: () => null,
    });
    assert.equal(await unknown(request), null);
  });

  test("legt auch den kontrollierten Tokenzugang auf die Principal-Grenze", async () => {
    const userId = "8acf3017-cf6e-589b-bd47-a1d8ccec16a8";
    const token = "abcdefghijklmnopqrstuvwxyz-123456";
    const resolve = createBearerPrincipalResolver([{ userId, token }]);
    const principal = await resolve(/** @type {never} */ ({ headers: { authorization: `Bearer ${token}` } }));
    assert.deepEqual(principal, { issuer: CONTROLLED_BEARER_ISSUER, subject: userId });
  });

  test("begrenzt Requests in einem deterministischen Zeitfenster", () => {
    let now = 1000;
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000, now: () => now });
    assert.deepEqual(limiter.consume("client"), { allowed: true, limit: 2, remaining: 1, resetAt: 2000 });
    assert.equal(limiter.consume("client").allowed, true);
    assert.equal(limiter.consume("client").allowed, false);
    now = 2000;
    assert.equal(limiter.consume("client").allowed, true);
  });

  test("unterscheidet ungueltiges JSON von zu grossen Payloads", async () => {
    await assert.rejects(
      readJson(Readable.from(["{"])),
      (error) => error instanceof HttpInputError && error.code === "INVALID_JSON",
    );
  });

  test("validiert UUIDs und kapselt die Entwicklungsidentitaet", async () => {
    const userId = "8acf3017-cf6e-589b-bd47-a1d8ccec16a8";
    assert.equal(isUuid(userId), true);
    assert.equal(isUuid("invalid"), false);
    assert.equal(await createDevelopmentIdentityResolver(userId)(/** @type {never} */ ({})), userId);
  });
});
