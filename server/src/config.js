const DEFAULT_PORT = 3000;

/**
 * @typedef {Object} ServerConfig
 * @property {string} host
 * @property {number} port
 * @property {string} databaseUrl
 * @property {string} databaseMigrationUrl
 * @property {boolean} databaseSsl
 * @property {string|null} devUserId
 * @property {string|null} corsOrigin
 * @property {{userId: string, token: string}[]} bearerIdentities
 * @property {number} rateLimit
 * @property {number} rateLimitWindowMs
 * @property {"clerk"|"controlled-bearer"|"development"} authMode
 * @property {{publishableKey: string, secretKey: string, authorizedParties: string[]}|null} clerk
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
  const clerk = parseClerkConfig(environment);
  const authMode = parseAuthMode(environment.AUTH_MODE, { clerk, bearerIdentities, devUserId });
  const rateLimit = positiveInteger(environment.RATE_LIMIT_REQUESTS ?? "120", "RATE_LIMIT_REQUESTS");
  const rateLimitWindowMs = positiveInteger(environment.RATE_LIMIT_WINDOW_MS ?? "60000", "RATE_LIMIT_WINDOW_MS");

  return {
    host: environment.SERVER_HOST?.trim() || "127.0.0.1",
    port,
    databaseUrl,
    databaseMigrationUrl: environment.DATABASE_MIGRATION_URL?.trim() || databaseUrl,
    databaseSsl: environment.DATABASE_SSL === "true",
    devUserId,
    corsOrigin: parseCorsOrigin(environment.CORS_ORIGIN),
    bearerIdentities,
    rateLimit,
    rateLimitWindowMs,
    authMode,
    clerk,
  };
}

/** @param {string|undefined} value @param {{clerk: ServerConfig["clerk"], bearerIdentities: ServerConfig["bearerIdentities"], devUserId: string|null}} available */
function parseAuthMode(value, available) {
  const configured = value?.trim();
  const inferred = available.clerk ? "clerk" : available.bearerIdentities.length ? "controlled-bearer" : "development";
  const mode = configured || inferred;
  if (!["clerk", "controlled-bearer", "development"].includes(mode)) throw new Error("AUTH_MODE must be clerk, controlled-bearer, or development.");
  const configuredModes = Number(Boolean(available.clerk)) + Number(available.bearerIdentities.length > 0) + Number(Boolean(available.devUserId));
  if (configuredModes > 1) throw new Error("Clerk, API_BEARER_IDENTITIES, and DEV_USER_ID cannot be configured together.");
  if (available.clerk && mode !== "clerk") throw new Error("Clerk credentials require AUTH_MODE=clerk.");
  if (available.bearerIdentities.length && mode !== "controlled-bearer") throw new Error("API_BEARER_IDENTITIES requires AUTH_MODE=controlled-bearer.");
  if (available.devUserId && mode !== "development") throw new Error("DEV_USER_ID requires AUTH_MODE=development.");
  if (mode === "clerk" && !available.clerk) throw new Error("Clerk authentication configuration is incomplete.");
  if (mode === "controlled-bearer" && !available.bearerIdentities.length) throw new Error("API_BEARER_IDENTITIES is required for controlled-bearer mode.");
  return /** @type {ServerConfig["authMode"]} */ (mode);
}

/** @param {NodeJS.ProcessEnv} environment */
function parseClerkConfig(environment) {
  const publishableKey = environment.CLERK_PUBLISHABLE_KEY?.trim() ?? "";
  const secretKey = environment.CLERK_SECRET_KEY?.trim() ?? "";
  const parties = environment.CLERK_AUTHORIZED_PARTIES?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];
  if (!publishableKey && !secretKey && !parties.length) return null;
  if (!/^pk_(test|live)_/.test(publishableKey)) throw new Error("CLERK_PUBLISHABLE_KEY is invalid.");
  if (!/^sk_(test|live)_/.test(secretKey)) throw new Error("CLERK_SECRET_KEY is invalid.");
  if (!parties.length) throw new Error("CLERK_AUTHORIZED_PARTIES is required.");
  const authorizedParties = parties.map((origin) => parseRequiredOrigin(origin, "CLERK_AUTHORIZED_PARTIES"));
  return { publishableKey, secretKey, authorizedParties: [...new Set(authorizedParties)] };
}

/** @param {string} origin @param {string} name */
function parseRequiredOrigin(origin, name) {
  let parsed;
  try { parsed = new URL(origin); } catch { throw new Error(`${name} must contain valid http(s) origins.`); }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.origin !== origin) throw new Error(`${name} must contain valid http(s) origins.`);
  return parsed.origin;
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
