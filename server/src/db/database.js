import pg from "pg";

const { Pool } = pg;

/**
 * @typedef {Pick<import("pg").Pool, "query" | "connect" | "end">} Database
 */

/**
 * @param {{databaseUrl: string, databaseSsl: boolean}} config
 * @param {string} [databaseUrl]
 * @returns {import("pg").Pool}
 */
export function createDatabase(config, databaseUrl = config.databaseUrl) {
  return new Pool(createPoolOptions(config, databaseUrl));
}

/**
 * @param {{databaseSsl: boolean}} config
 * @param {string} databaseUrl
 * @returns {import("pg").PoolConfig}
 */
export function createPoolOptions(config, databaseUrl) {
  return {
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: config.databaseSsl ? { rejectUnauthorized: true } : false,
  };
}
