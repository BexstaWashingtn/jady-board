/**
 * @typedef {Object} BoardRepository
 * @property {(userId: string) => Promise<Record<string, any>[]>} listForUser
 * @property {(boardId: string, userId: string) => Promise<Record<string, any>|null>} findForUser
 * @property {(boardId: string, taskId: string, userId: string) => Promise<Record<string, any>|null>} [findTaskForUser]
 * @property {(boardId: string, taskId: string, version: number, changes: {title: string, category: string, priority: string, dueDate: string|null}) => Promise<Record<string, any>|null>} [updateTaskMetadata]
 */

/**
 * @param {Pick<import("pg").Pool, "query">} database
 * @returns {BoardRepository}
 */
export function createBoardRepository(database) {
  return {
    async listForUser(userId) {
      const result = await database.query(`
        SELECT b.id, b.name, b.path, b.description, b.version, bm.role,
          count(DISTINCT s.id)::int AS stage_count,
          count(DISTINCT t.id)::int AS task_count
        FROM boards b
        JOIN board_members bm ON bm.board_id = b.id AND bm.user_id = $1
        LEFT JOIN stages s ON s.board_id = b.id
        LEFT JOIN tasks t ON t.board_id = b.id
        GROUP BY b.id, bm.role
        ORDER BY lower(b.name), b.id
      `, [userId]);
      return result.rows;
    },

    async findForUser(boardId, userId) {
      const boardResult = await database.query(`
        SELECT b.id, b.name, b.path, b.description, b.owner_id, b.task_prefix,
          b.version, bm.role
        FROM boards b
        JOIN board_members bm ON bm.board_id = b.id
          AND bm.user_id = $2
        WHERE b.id = $1
      `, [boardId, userId]);
      if (!boardResult.rowCount) return null;

      const [members, stages, tasks, todos, transitions] = await Promise.all([
        database.query(`
          SELECT u.id, u.display_name, u.initials, bm.role
          FROM board_members bm
          JOIN users u ON u.id = bm.user_id
          WHERE bm.board_id = $1
          ORDER BY CASE bm.role WHEN 'owner' THEN 0 ELSE 1 END, lower(u.display_name), u.id
        `, [boardId]),
        database.query(`
          SELECT id, title, color, kind, position, wip_limit, wip_limit_mode,
            require_completed_todos, transitions_restricted, version
          FROM stages
          WHERE board_id = $1
          ORDER BY position
        `, [boardId]),
        database.query(`
          SELECT id, stage_id, task_number, title, category, priority, assignee_id,
            due_date::text, position, comments_count, version
          FROM tasks
          WHERE board_id = $1
          ORDER BY stage_id, position
        `, [boardId]),
        database.query(`
          SELECT td.id, td.task_id, td.text, td.completed, td.position
          FROM task_todos td
          JOIN tasks t ON t.id = td.task_id
          WHERE t.board_id = $1
          ORDER BY td.task_id, td.position
        `, [boardId]),
        database.query(`
          SELECT source_stage_id, target_stage_id
          FROM stage_transitions
          WHERE board_id = $1
          ORDER BY source_stage_id, target_stage_id
        `, [boardId]),
      ]);
      return {
        board: boardResult.rows[0],
        members: members.rows,
        stages: stages.rows,
        tasks: tasks.rows,
        todos: todos.rows,
        transitions: transitions.rows,
      };
    },

    async findTaskForUser(boardId, taskId, userId) {
      const result = await database.query(`
        SELECT t.id, t.assignee_id, t.version, bm.role
        FROM tasks t
        JOIN board_members bm ON bm.board_id = t.board_id AND bm.user_id = $3
        WHERE t.board_id = $1 AND t.id = $2
      `, [boardId, taskId, userId]);
      return result.rows[0] ?? null;
    },

    async updateTaskMetadata(boardId, taskId, version, changes) {
      const result = await database.query(`
        UPDATE tasks
        SET title = $4, category = $5, priority = $6, due_date = $7,
          version = version + 1, updated_at = now()
        WHERE board_id = $1 AND id = $2 AND version = $3
        RETURNING id, title, category, priority, due_date::text, assignee_id, version
      `, [boardId, taskId, version, changes.title, changes.category, changes.priority, changes.dueDate]);
      return result.rows[0] ?? null;
    },
  };
}
