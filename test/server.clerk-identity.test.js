import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createClerkPrincipalResolver } from "../server/src/http/clerk-principal.js";
import { createIdentityRepository } from "../server/src/modules/identity/identity.repository.js";

describe("Clerk-Identity-Adapter", () => {
  test("verifiziert Clerk-Sessions und gibt nur issuer und subject weiter", async () => {
    let received;
    const client = {
      async authenticateRequest(request, options) {
        received = { request, options };
        return { isAuthenticated: true, toAuth: () => ({ userId: "user_clerk_1", sessionClaims: { iss: "https://clerk.example" } }) };
      },
    };
    const resolve = createClerkPrincipalResolver({
      publishableKey: "pk_test_key", secretKey: "sk_test_key",
      authorizedParties: ["https://board.example"], client,
    });
    const principal = await resolve(/** @type {never} */ ({ method: "GET", url: "/api/boards", headers: { host: "api.example", authorization: "Bearer token" } }));
    assert.deepEqual(principal, { issuer: "https://clerk.example", subject: "user_clerk_1" });
    assert.equal(received.request.headers.get("authorization"), "Bearer token");
    assert.deepEqual(received.options, { authorizedParties: ["https://board.example"], acceptsToken: "session_token" });
  });

  test("liefert für nicht authentifizierte Clerk-Requests keinen Principal", async () => {
    const client = { async authenticateRequest() { return { isAuthenticated: false }; } };
    const resolve = createClerkPrincipalResolver({ publishableKey: "pk", secretKey: "sk", authorizedParties: [], client });
    assert.equal(await resolve(/** @type {never} */ ({ headers: {} })), null);
  });

  test("weist unvollständige authentifizierte Clerk-Claims zurück", async () => {
    const client = { async authenticateRequest() { return { isAuthenticated: true, toAuth: () => ({ userId: "user", sessionClaims: {} }) }; } };
    const resolve = createClerkPrincipalResolver({ publishableKey: "pk", secretKey: "sk", authorizedParties: [], client });
    await assert.rejects(resolve(/** @type {never} */ ({ headers: {} })), /invalid authenticated principal/);
  });
});

describe("Lokale External-Identity-Zuordnung", () => {
  test("löst nur aktive PostgreSQL-Benutzer über issuer und subject auf", async () => {
    let query;
    const repository = createIdentityRepository({
      async query(text, values) { query = { text, values }; return { rows: [{ id: "local-user-id" }] }; },
    });
    assert.equal(await repository.findActiveUserId({ issuer: "https://clerk.example", subject: "user_1" }), "local-user-id");
    assert.match(query.text, /u\.status = 'active'/);
    assert.deepEqual(query.values, ["https://clerk.example", "user_1"]);
  });

  test("legt unbekannte externe Identitäten nicht automatisch an", async () => {
    const repository = createIdentityRepository({ async query() { return { rows: [] }; } });
    assert.equal(await repository.findActiveUserId({ issuer: "https://clerk.example", subject: "unknown" }), null);
  });
});
