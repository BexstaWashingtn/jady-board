import { createHash, timingSafeEqual } from "node:crypto";

/** @typedef {(request: import("node:http").IncomingMessage) => string|null|Promise<string|null>} RequestIdentityResolver */
/** @typedef {{issuer: string, subject: string}} AuthenticatedPrincipal */
/** @typedef {(request: import("node:http").IncomingMessage) => AuthenticatedPrincipal|null|Promise<AuthenticatedPrincipal|null>} RequestPrincipalResolver */
/** @typedef {(principal: AuthenticatedPrincipal) => string|null|Promise<string|null>} LocalUserResolver */

/** @typedef {{userId: string, token: string}} BearerIdentity */

export const CONTROLLED_BEARER_ISSUER = "urn:jady-board:controlled-bearer";

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
 * Composes authentication with local account resolution. A future OIDC
 * adapter owns token verification and returns only a stable issuer/subject
 * pair; PostgreSQL remains responsible for mapping that pair to a local user.
 *
 * @param {{resolvePrincipal: RequestPrincipalResolver, resolveLocalUser: LocalUserResolver}} dependencies
 * @returns {RequestIdentityResolver}
 */
export function createRequestIdentityResolver({ resolvePrincipal, resolveLocalUser }) {
  return async (request) => {
    const principal = await resolvePrincipal(request);
    if (!principal) return null;
    if (!principal.issuer.trim() || !principal.subject.trim()) throw new Error("Authenticated principal is invalid.");
    return resolveLocalUser(principal);
  };
}

/**
 * Resolves opaque bearer tokens using constant-time digest comparison. Tokens
 * remain server-side credentials and are never decoded or trusted as claims.
 *
 * @param {BearerIdentity[]} identities
 * @returns {RequestIdentityResolver}
 */
export function createBearerIdentityResolver(identities) {
  const usersBySubject = new Map(identities.map(({ userId }) => [userId, userId]));
  return createRequestIdentityResolver({
    resolvePrincipal: createBearerPrincipalResolver(identities),
    resolveLocalUser: ({ issuer, subject }) => issuer === CONTROLLED_BEARER_ISSUER
      ? usersBySubject.get(subject) ?? null
      : null,
  });
}

/**
 * Controlled development/test authenticator. This is deliberately separate
 * from local-user lookup so an OIDC verifier can later replace it without
 * changing authorization or board membership code.
 *
 * @param {BearerIdentity[]} identities
 * @returns {RequestPrincipalResolver}
 */
export function createBearerPrincipalResolver(identities) {
  const credentials = identities.map(({ userId, token }) => ({
    subject: userId,
    digest: digestToken(token),
  }));
  return (request) => {
    const authorization = request.headers.authorization;
    if (typeof authorization !== "string") return null;
    const match = authorization.match(/^Bearer ([^\s]+)$/i);
    if (!match) return null;
    const presented = digestToken(match[1]);
    const credential = credentials.find(({ digest }) => timingSafeEqual(digest, presented));
    return credential ? { issuer: CONTROLLED_BEARER_ISSUER, subject: credential.subject } : null;
  };
}

/** @param {string} token */
function digestToken(token) {
  return createHash("sha256").update(token, "utf8").digest();
}
