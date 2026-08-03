import { createHash, timingSafeEqual } from "node:crypto";

/** @typedef {(request: import("node:http").IncomingMessage) => string|null|Promise<string|null>} RequestIdentityResolver */

/** @typedef {{userId: string, token: string}} BearerIdentity */

/**
 * Explicit development-only identity adapter. Production deployments must
 * replace this with a resolver backed by a verified session or access token.
 *
 * @param {string|null} userId
 * @returns {RequestIdentityResolver}
 */
export function createDevelopmentIdentityResolver(userId) {
  return () => userId;
}

/**
 * Resolves opaque bearer tokens using constant-time digest comparison. Tokens
 * remain server-side credentials and are never decoded or trusted as claims.
 *
 * @param {BearerIdentity[]} identities
 * @returns {RequestIdentityResolver}
 */
export function createBearerIdentityResolver(identities) {
  const credentials = identities.map(({ userId, token }) => ({
    userId,
    digest: digestToken(token),
  }));
  return (request) => {
    const authorization = request.headers.authorization;
    if (typeof authorization !== "string") return null;
    const match = authorization.match(/^Bearer ([^\s]+)$/i);
    if (!match) return null;
    const presented = digestToken(match[1]);
    const credential = credentials.find(({ digest }) => timingSafeEqual(digest, presented));
    return credential?.userId ?? null;
  };
}

/** @param {string} token */
function digestToken(token) {
  return createHash("sha256").update(token, "utf8").digest();
}
