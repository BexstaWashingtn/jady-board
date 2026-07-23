const DEFAULT_PORT = 3000;

/**
 * @typedef {Object} ServerConfig
 * @property {string} host
 * @property {number} port
 * @property {string} databaseUrl
 * @property {boolean} databaseSsl
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

  return {
    host: environment.SERVER_HOST?.trim() || "127.0.0.1",
    port,
    databaseUrl,
    databaseSsl: environment.DATABASE_SSL === "true",
  };
}
