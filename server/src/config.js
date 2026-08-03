const DEFAULT_PORT = 3000;

/**
 * @typedef {Object} ServerConfig
 * @property {string} host
 * @property {number} port
 * @property {string} databaseUrl
 * @property {boolean} databaseSsl
 * @property {string|null} devUserId
 * @property {string|null} corsOrigin
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

  return {
    host: environment.SERVER_HOST?.trim() || "127.0.0.1",
    port,
    databaseUrl,
    databaseSsl: environment.DATABASE_SSL === "true",
    devUserId,
    corsOrigin: parseCorsOrigin(environment.CORS_ORIGIN),
  };
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
