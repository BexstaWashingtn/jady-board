/** @typedef {(request: import("node:http").IncomingMessage) => string|null|Promise<string|null>} RequestIdentityResolver */

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
