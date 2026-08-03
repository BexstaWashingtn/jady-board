const DEFAULT_PORT = 3000;

/**
 * @typedef {Object} ServerConfig
 * @property {string} host
 * @property {number} port
 * @property {string} databaseUrl
 * @property {boolean} databaseSsl
 * @property {string|null} devUserId
 * @property {string|null} corsOrigin
 * @property {{userId: string, token: string}[]} bearerIdentities
 * @property {number} rateLimit
 * @property {number} rateLimitWindowMs
 */

/**
 * Reads and validates the server configuration.
 *
 * @param {NodeJS.ProcessEnv} [environment]
 * @returns {ServerConfig}
 */
export function loadConfig(environment = process.env) {
  const port = Number(environment.SERVER_PORT ?? DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SERVER_PORT must be an integer between 1 and 65535.");
  }

  const databaseUrl = environment.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  const devUserId = environment.DEV_USER_ID?.trim() || null;
  if (devUserId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(devUserId)) {
    throw new Error("DEV_USER_ID must be a UUID.");
  }
  const bearerIdentities = parseBearerIdentities(environment.API_BEARER_IDENTITIES);
  if (devUserId && bearerIdentities.length) {
    throw new Error("DEV_USER_ID and API_BEARER_IDENTITIES cannot be used together.");
  }
  const rateLimit = positiveInteger(environment.RATE_LIMIT_REQUESTS ?? "120", "RATE_LIMIT_REQUESTS");
  const rateLimitWindowMs = positiveInteger(environment.RATE_LIMIT_WINDOW_MS ?? "60000", "RATE_LIMIT_WINDOW_MS");

  return {
    host: environment.SERVER_HOST?.trim() || "127.0.0.1",
    port,
    databaseUrl,
    databaseSsl: environment.DATABASE_SSL === "true",
    devUserId,
    corsOrigin: parseCorsOrigin(environment.CORS_ORIGIN),
    bearerIdentities,
    rateLimit,
    rateLimitWindowMs,
  };
}

/** @param {string|undefined} value */
function parseBearerIdentities(value) {
  if (!value?.trim()) return [];
  let parsed;
  try { parsed = JSON.parse(value); } catch { throw new Error("API_BEARER_IDENTITIES must be valid JSON."); }
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("API_BEARER_IDENTITIES must be a non-empty JSON array.");
  const identities = parsed.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("API_BEARER_IDENTITIES entries must be objects.");
    const userId = String(entry.userId ?? "");
    const token = String(entry.token ?? "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) throw new Error("API_BEARER_IDENTITIES userId must be a UUID.");
    if (token.length < 32) throw new Error("API_BEARER_IDENTITIES tokens must contain at least 32 characters.");
    return { userId, token };
  });
  if (new Set(identities.map(({ token }) => token)).size !== identities.length) throw new Error("API_BEARER_IDENTITIES tokens must be unique.");
  return identities;
}

/** @param {string} value @param {string} name */
function positiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer.`);
  return parsed;
}

/** @param {string|undefined} value */
function parseCorsOrigin(value) {
  const origin = value?.trim();
  if (!origin) return null;
  if (origin === "*") throw new Error("CORS_ORIGIN must be an explicit http(s) origin.");
  let parsed;
  try { parsed = new URL(origin); } catch { throw new Error("CORS_ORIGIN must be a valid http(s) origin."); }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.origin !== origin) {
    throw new Error("CORS_ORIGIN must be a valid http(s) origin.");
  }
  return parsed.origin;
}
