import pg from "pg";

const { Pool } = pg;

/**
 * @typedef {Pick<import("pg").Pool, "query" | "connect" | "end">} Database
 */

/**
 * @param {{databaseUrl: string, databaseSsl: boolean}} config
 * @returns {import("pg").Pool}
 */
export function createDatabase(config) {
  return new Pool({
    connectionString: config.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: config.databaseSsl ? { rejectUnauthorized: true } : false,
  });
}
