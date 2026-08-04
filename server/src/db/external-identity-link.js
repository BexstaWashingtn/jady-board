import { randomUUID } from "node:crypto";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @typedef {Object} ExternalIdentityLink
 * @property {string} localUserId
 * @property {string} issuer
 * @property {string} subject
 */

/**
 * Explicitly links an administrator-supplied provider identity to an existing local user.
 * It never provisions users, roles or memberships.
 *
 * @param {Pick<import("./database.js").Database, "connect">} database
 * @param {ExternalIdentityLink} link
 * @param {{dryRun?: boolean, identityId?: string}} [options]
 */
export async function linkExternalIdentity(database, link, options = {}) {
  validateExternalIdentityLink(link);
  const dryRun = options.dryRun ?? false;
  const identityId = options.identityId ?? randomUUID();
  if (!UUID_PATTERN.test(identityId)) throw new Error("Generated external identity ID must be a UUID.");

  const client = await database.connect();
  let transactionOpen = false;
  try {
    await client.query("BEGIN");
    transactionOpen = true;
    const user = await client.query(
      "SELECT id, status FROM users WHERE id = $1 FOR UPDATE",
      [link.localUserId],
    );
    if (!user.rows[0]) throw new Error("Local user does not exist.");
    if (user.rows[0].status !== "active") throw new Error("Local user is not active.");

    const existing = await findExternalIdentity(client, link);
    if (existing) {
      if (String(existing.user_id) !== link.localUserId) {
        throw new Error("External identity is already linked to another local user.");
      }
      await finishTransaction(client, dryRun);
      transactionOpen = false;
      return { status: /** @type {const} */ ("already-linked"), dryRun, localUserId: link.localUserId };
    }

    if (dryRun) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return { status: /** @type {const} */ ("would-link"), dryRun: true, localUserId: link.localUserId };
    }

    const inserted = await client.query(
      `INSERT INTO external_identities (id, user_id, issuer, subject)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (issuer, subject) DO NOTHING
       RETURNING user_id`,
      [identityId, link.localUserId, link.issuer, link.subject],
    );
    if (!inserted.rows[0]) {
      const concurrent = await findExternalIdentity(client, link);
      if (!concurrent || String(concurrent.user_id) !== link.localUserId) {
        throw new Error("External identity is already linked to another local user.");
      }
      await client.query("COMMIT");
      transactionOpen = false;
      return { status: /** @type {const} */ ("already-linked"), dryRun: false, localUserId: link.localUserId };
    }

    await client.query("COMMIT");
    transactionOpen = false;
    return { status: /** @type {const} */ ("linked"), dryRun: false, localUserId: link.localUserId };
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** @param {ExternalIdentityLink} link */
export function validateExternalIdentityLink(link) {
  if (!UUID_PATTERN.test(link.localUserId)) throw new Error("--local-user must be a UUID.");
  let issuer;
  try { issuer = new URL(link.issuer); } catch { throw new Error("--issuer must be a valid HTTPS URL."); }
  if (issuer.protocol !== "https:" || issuer.search || issuer.hash || issuer.username || issuer.password) {
    throw new Error("--issuer must be a valid HTTPS URL without credentials, query or fragment.");
  }
  if (!/^user_[A-Za-z0-9]+$/.test(link.subject)) throw new Error("--subject must be a Clerk user ID beginning with user_.");
}

/** @param {import("pg").PoolClient} client @param {ExternalIdentityLink} link */
async function findExternalIdentity(client, link) {
  const result = await client.query(
    "SELECT user_id FROM external_identities WHERE issuer = $1 AND subject = $2",
    [link.issuer, link.subject],
  );
  return result.rows[0] ?? null;
}

/** @param {import("pg").PoolClient} client @param {boolean} dryRun */
async function finishTransaction(client, dryRun) {
  await client.query(dryRun ? "ROLLBACK" : "COMMIT");
}
