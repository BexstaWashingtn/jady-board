import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { linkExternalIdentity, validateExternalIdentityLink } from "../server/src/db/external-identity-link.js";
import { parseClerkLinkArguments } from "../server/src/db/link-clerk-user.js";

const localUserId = "8acf3017-cf6e-589b-bd47-a1d8ccec16a8";
const identityId = "46ed3b71-86cb-5eb7-a01e-dd5885e41c6a";
const link = { localUserId, issuer: "https://clerk.example.com", subject: "user_2abcDEF123" };

describe("Clerk-Link-Argumente", () => {
  test("liest benannte Argumente unabhängig von ihrer Schreibweise", () => {
    assert.deepEqual(parseClerkLinkArguments([
      `--local-user=${localUserId}`, "--issuer", link.issuer, `--subject=${link.subject}`, "--dry-run",
    ]), { ...link, dryRun: true });
  });

  test("weist fehlende, unbekannte und doppelte Argumente zurück", () => {
    assert.throws(() => parseClerkLinkArguments([]), /Usage/);
    assert.throws(() => parseClerkLinkArguments(["--unknown"]), /Unknown argument/);
    assert.throws(() => parseClerkLinkArguments(["--issuer", "--subject"]), /requires a value/);
    assert.throws(() => parseClerkLinkArguments(["--dry-run", "--dry-run"]), /only be specified once/);
  });

  test("validiert lokale UUID, HTTPS-Issuer und Clerk-Subject", () => {
    assert.doesNotThrow(() => validateExternalIdentityLink(link));
    assert.throws(() => validateExternalIdentityLink({ ...link, localUserId: "no-uuid" }), /UUID/);
    assert.throws(() => validateExternalIdentityLink({ ...link, issuer: "http://clerk.example.com" }), /HTTPS/);
    assert.throws(() => validateExternalIdentityLink({ ...link, subject: "account-1" }), /Clerk user ID/);
  });
});

describe("External-Identity-Linking", () => {
  test("verknüpft einen aktiven lokalen Benutzer transaktional", async () => {
    const harness = linkHarness();
    const result = await linkExternalIdentity(harness.database, link, { identityId });

    assert.deepEqual(result, { status: "linked", dryRun: false, localUserId });
    assert.deepEqual(harness.statements.map(({ sql }) => sql), [
      "BEGIN",
      "SELECT id, status FROM users WHERE id = $1 FOR UPDATE",
      "SELECT user_id FROM external_identities WHERE issuer = $1 AND subject = $2",
      "INSERT INTO external_identities (id, user_id, issuer, subject) VALUES ($1, $2, $3, $4) ON CONFLICT (issuer, subject) DO NOTHING RETURNING user_id",
      "COMMIT",
    ]);
    assert.deepEqual(harness.statements[3].values, [identityId, localUserId, link.issuer, link.subject]);
    assert.equal(harness.released, true);
  });

  test("prüft im Dry-run vollständig und schreibt keine Verknüpfung", async () => {
    const harness = linkHarness();
    const result = await linkExternalIdentity(harness.database, link, { dryRun: true, identityId });

    assert.deepEqual(result, { status: "would-link", dryRun: true, localUserId });
    assert.equal(harness.statements.some(({ sql }) => sql.startsWith("INSERT")), false);
    assert.equal(harness.statements.at(-1)?.sql, "ROLLBACK");
  });

  test("behandelt dieselbe bestehende Verknüpfung idempotent", async () => {
    const harness = linkHarness({ existingUserId: localUserId });
    const result = await linkExternalIdentity(harness.database, link, { identityId });

    assert.deepEqual(result, { status: "already-linked", dryRun: false, localUserId });
    assert.equal(harness.statements.at(-1)?.sql, "COMMIT");
    assert.equal(harness.statements.some(({ sql }) => sql.startsWith("INSERT")), false);
  });

  test("verhindert Account-Übernahmen und rollt zurück", async () => {
    const harness = linkHarness({ existingUserId: "f0a23411-abcd-4def-8123-123456789abc" });
    await assert.rejects(linkExternalIdentity(harness.database, link, { identityId }), /another local user/);

    assert.equal(harness.statements.at(-1)?.sql, "ROLLBACK");
    assert.equal(harness.released, true);
  });

  test("verknüpft keine fehlenden oder deaktivierten Benutzer", async () => {
    const missing = linkHarness({ userStatus: null });
    await assert.rejects(linkExternalIdentity(missing.database, link, { identityId }), /does not exist/);
    const disabled = linkHarness({ userStatus: "disabled" });
    await assert.rejects(linkExternalIdentity(disabled.database, link, { identityId }), /not active/);
    assert.equal(missing.statements.at(-1)?.sql, "ROLLBACK");
    assert.equal(disabled.statements.at(-1)?.sql, "ROLLBACK");
  });
});

/** @param {{userStatus?: string|null, existingUserId?: string|null}} [options] */
function linkHarness(options = {}) {
  const userStatus = options.userStatus === undefined ? "active" : options.userStatus;
  const existingUserId = options.existingUserId ?? null;
  const statements = [];
  let released = false;
  const client = {
    async query(text, values = []) {
      const sql = String(text).replace(/\s+/g, " ").trim();
      statements.push({ sql, values });
      if (sql.startsWith("SELECT id, status")) return { rows: userStatus ? [{ id: localUserId, status: userStatus }] : [] };
      if (sql.startsWith("SELECT user_id")) return { rows: existingUserId ? [{ user_id: existingUserId }] : [] };
      if (sql.startsWith("INSERT")) return { rows: [{ user_id: localUserId }] };
      return { rows: [] };
    },
    release() { released = true; },
  };
  return {
    database: { async connect() { return /** @type {import("pg").PoolClient} */ (client); } },
    statements,
    get released() { return released; },
  };
}
