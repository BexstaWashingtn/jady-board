/**
 * @param {Pick<import("pg").Pool, "query">} database
 */
export function createIdentityRepository(database) {
  return {
    /** @param {{issuer: string, subject: string}} principal */
    async findActiveUserId(principal) {
      const result = await database.query(
        `SELECT u.id
         FROM external_identities ei
         JOIN users u ON u.id = ei.user_id
         WHERE ei.issuer = $1 AND ei.subject = $2 AND u.status = 'active'`,
        [principal.issuer, principal.subject],
      );
      return result.rows[0]?.id ? String(result.rows[0].id) : null;
    },
  };
}
