/**
 * @typedef {Object} BoardRepository
 * @property {(userId: string) => Promise<Record<string, any>[]>} listForUser
 * @property {(boardId: string, userId: string) => Promise<Record<string, any>|null>} findForUser
 * @property {(boardId: string, taskId: string, userId: string) => Promise<Record<string, any>|null>} [findTaskForUser]
 * @property {(boardId: string, taskId: string, version: number, changes: {title: string, category: string, priority: string, dueDate: string|null}) => Promise<Record<string, any>|null>} [updateTaskMetadata]
 * @property {(boardId: string, taskId: string, userId: string, targetStageId: string) => Promise<Record<string, any>|null>} [findTaskMoveContext]
 * @property {(boardId: string, taskId: string, targetStageId: string, targetIndex: number, version: number) => Promise<Record<string, any>|null>} [moveTask]
 * @property {(boardId: string, userId: string, input: {id: string, stageId: string, title: string, category: string, priority: string, assigneeId: string|null, dueDate: string|null}) => Promise<{status: "created", task: Record<string, any>}|{status: "not_found"|"forbidden"|"wip_limit"}>} [createTask]
 * @property {(boardId: string, userId: string) => Promise<boolean>} [isBoardMember]
 * @property {(boardId: string, taskId: string, version: number, assigneeId: string|null) => Promise<Record<string, any>|null>} [updateTaskAssignment]
 * @property {(boardId: string, taskId: string, version: number, todos: {id: string, text: string, completed: boolean}[]) => Promise<Record<string, any>|null>} [replaceTaskTodos]
 * @property {(boardId: string, taskId: string, version: number) => Promise<boolean>} [deleteTask]
 * @property {(boardId: string, stageId: string, userId: string) => Promise<Record<string, any>|null>} [findStageForUser]
 * @property {(boardId: string, stageId: string, version: number, input: Record<string, any>) => Promise<Record<string, any>|null>} [updateStage]
 * @property {(boardId: string, userId: string, input: Record<string, any>) => Promise<{status: "created", stage: Record<string, any>}|{status: "not_found"|"forbidden"|"invalid_targets"}>} [createStage]
 * @property {(boardId: string, stageId: string, targetIndex: number, version: number) => Promise<Record<string, any>|null>} [moveStage]
 * @property {(boardId: string, stageId: string, version: number, moveTasksTo: string|null) => Promise<"deleted"|"conflict"|"last_stage"|"invalid_target"|"wip_limit">} [deleteStage]
 */

/**
 * @param {Pick<import("pg").Pool, "query"> & Partial<Pick<import("pg").Pool, "connect">>} database
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

    async findTaskMoveContext(boardId, taskId, userId, targetStageId) {
      const result = await database.query(`
        SELECT t.id, t.stage_id, t.assignee_id, t.version, bm.role,
          target.id AS target_stage_id, target.wip_limit, target.wip_limit_mode,
          target.require_completed_todos,
          (NOT source.transitions_restricted OR EXISTS (
            SELECT 1 FROM stage_transitions st
            WHERE st.board_id = t.board_id AND st.source_stage_id = t.stage_id AND st.target_stage_id = target.id
          )) AS transition_allowed,
          (SELECT count(*)::int FROM tasks positioned WHERE positioned.stage_id = target.id AND positioned.id <> t.id) AS target_count,
          (SELECT count(*)::int FROM task_todos td WHERE td.task_id = t.id AND NOT td.completed) AS open_todo_count
        FROM tasks t
        JOIN board_members bm ON bm.board_id = t.board_id AND bm.user_id = $3
        JOIN stages source ON source.id = t.stage_id AND source.board_id = t.board_id
        LEFT JOIN stages target ON target.id = $4 AND target.board_id = t.board_id
        WHERE t.board_id = $1 AND t.id = $2
      `, [boardId, taskId, userId, targetStageId]);
      return result.rows[0] ?? null;
    },

    async moveTask(boardId, taskId, targetStageId, targetIndex, version) {
      if (!("connect" in database) || typeof database.connect !== "function") throw new Error("Transactions are unavailable.");
      const client = await database.connect();
      try {
        await client.query("BEGIN");
        const locked = await client.query(`
          SELECT stage_id, position, version FROM tasks
          WHERE board_id = $1 AND id = $2 FOR UPDATE
        `, [boardId, taskId]);
        const current = locked.rows[0];
        if (!current || Number(current.version) !== version) {
          await client.query("ROLLBACK");
          return null;
        }
        await client.query(`UPDATE tasks SET position = position - 1 WHERE stage_id = $1 AND position > $2`, [current.stage_id, current.position]);
        await client.query(`UPDATE tasks SET position = position + 1 WHERE stage_id = $1 AND position >= $2`, [targetStageId, targetIndex]);
        const result = await client.query(`
          UPDATE tasks SET stage_id = $3, position = $4, version = version + 1, updated_at = now()
          WHERE board_id = $1 AND id = $2
          RETURNING id, stage_id, position, version
        `, [boardId, taskId, targetStageId, targetIndex]);
        await client.query(`UPDATE boards SET version = version + 1, updated_at = now() WHERE id = $1`, [boardId]);
        await client.query("COMMIT");
        return result.rows[0] ?? null;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async createTask(boardId, userId, input) {
      if (!("connect" in database) || typeof database.connect !== "function") throw new Error("Transactions are unavailable.");
      const client = await database.connect();
      try {
        await client.query("BEGIN");
        const contextResult = await client.query(`
          SELECT b.next_task_number, b.task_prefix, bm.role,
            s.wip_limit, s.wip_limit_mode,
            (SELECT count(*)::int FROM tasks t WHERE t.stage_id = s.id) AS task_count
          FROM boards b
          JOIN board_members bm ON bm.board_id = b.id AND bm.user_id = $2
          JOIN stages s ON s.board_id = b.id AND s.id = $3
          WHERE b.id = $1
          FOR UPDATE OF b, s
        `, [boardId, userId, input.stageId]);
        const context = contextResult.rows[0];
        if (!context) { await client.query("ROLLBACK"); return { status: "not_found" }; }
        if (input.assigneeId) {
          const member = await client.query(`SELECT 1 FROM board_members WHERE board_id = $1 AND user_id = $2`, [boardId, input.assigneeId]);
          if (!member.rowCount || (context.role !== "owner" && input.assigneeId !== userId)) {
            await client.query("ROLLBACK"); return { status: "forbidden" };
          }
        }
        if (context.wip_limit_mode === "strict" && context.wip_limit !== null && Number(context.task_count) >= Number(context.wip_limit)) {
          await client.query("ROLLBACK"); return { status: "wip_limit" };
        }
        const taskNumber = Number(context.next_task_number);
        const result = await client.query(`
          INSERT INTO tasks
            (id, board_id, stage_id, task_number, title, category, priority, assignee_id, due_date, position)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id, stage_id, task_number, title, category, priority, assignee_id, due_date::text, position, version
        `, [input.id, boardId, input.stageId, taskNumber, input.title, input.category, input.priority, input.assigneeId, input.dueDate, Number(context.task_count)]);
        await client.query(`UPDATE boards SET next_task_number = next_task_number + 1, version = version + 1, updated_at = now() WHERE id = $1`, [boardId]);
        await client.query("COMMIT");
        return { status: "created", task: { ...result.rows[0], task_prefix: context.task_prefix } };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async isBoardMember(boardId, userId) {
      const result = await database.query(`SELECT 1 FROM board_members WHERE board_id = $1 AND user_id = $2`, [boardId, userId]);
      return Boolean(result.rowCount);
    },

    async updateTaskAssignment(boardId, taskId, version, assigneeId) {
      const result = await database.query(`
        UPDATE tasks SET assignee_id = $4, version = version + 1, updated_at = now()
        WHERE board_id = $1 AND id = $2 AND version = $3
        RETURNING id, assignee_id, version
      `, [boardId, taskId, version, assigneeId]);
      return result.rows[0] ?? null;
    },

    async replaceTaskTodos(boardId, taskId, version, todos) {
      if (!("connect" in database) || typeof database.connect !== "function") throw new Error("Transactions are unavailable.");
      const client = await database.connect();
      try {
        await client.query("BEGIN");
        const locked = await client.query(`SELECT version FROM tasks WHERE board_id = $1 AND id = $2 FOR UPDATE`, [boardId, taskId]);
        if (!locked.rows[0] || Number(locked.rows[0].version) !== version) { await client.query("ROLLBACK"); return null; }
        await client.query(`DELETE FROM task_todos WHERE task_id = $1`, [taskId]);
        for (const [position, todo] of todos.entries()) {
          await client.query(`INSERT INTO task_todos (id, task_id, text, completed, position) VALUES ($1, $2, $3, $4, $5)`, [todo.id, taskId, todo.text, todo.completed, position]);
        }
        const updated = await client.query(`UPDATE tasks SET version = version + 1, updated_at = now() WHERE id = $1 RETURNING id, version`, [taskId]);
        await client.query("COMMIT");
        return { ...updated.rows[0], todos };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally { client.release(); }
    },

    async deleteTask(boardId, taskId, version) {
      if (!("connect" in database) || typeof database.connect !== "function") throw new Error("Transactions are unavailable.");
      const client = await database.connect();
      try {
        await client.query("BEGIN");
        const locked = await client.query(`SELECT stage_id, position, version FROM tasks WHERE board_id = $1 AND id = $2 FOR UPDATE`, [boardId, taskId]);
        const task = locked.rows[0];
        if (!task || Number(task.version) !== version) { await client.query("ROLLBACK"); return false; }
        await client.query(`DELETE FROM tasks WHERE board_id = $1 AND id = $2`, [boardId, taskId]);
        await client.query(`UPDATE tasks SET position = position - 1 WHERE stage_id = $1 AND position > $2`, [task.stage_id, task.position]);
        await client.query(`UPDATE boards SET version = version + 1, updated_at = now() WHERE id = $1`, [boardId]);
        await client.query("COMMIT");
        return true;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally { client.release(); }
    },

    async findStageForUser(boardId, stageId, userId) {
      const result = await database.query(`SELECT s.id, s.version, bm.role FROM stages s JOIN board_members bm ON bm.board_id = s.board_id AND bm.user_id = $3 WHERE s.board_id = $1 AND s.id = $2`, [boardId, stageId, userId]);
      return result.rows[0] ?? null;
    },

    async updateStage(boardId, stageId, version, input) {
      if (!("connect" in database) || typeof database.connect !== "function") throw new Error("Transactions are unavailable.");
      const client = await database.connect();
      try {
        await client.query("BEGIN");
        const updated = await client.query(`
          UPDATE stages SET title = $4, color = $5, kind = $6, wip_limit = $7,
            wip_limit_mode = $8, require_completed_todos = $9,
            transitions_restricted = $10, version = version + 1, updated_at = now()
          WHERE board_id = $1 AND id = $2 AND version = $3
          RETURNING id, title, color, kind, wip_limit, wip_limit_mode, require_completed_todos, version
        `, [boardId, stageId, version, input.title, input.color, input.kind, input.limit, input.limitMode, input.requireCompletedTodos, input.allowedTargetIds !== null]);
        if (!updated.rowCount) { await client.query("ROLLBACK"); return null; }
        await client.query(`DELETE FROM stage_transitions WHERE board_id = $1 AND source_stage_id = $2`, [boardId, stageId]);
        for (const targetId of input.allowedTargetIds ?? []) {
          await client.query(`INSERT INTO stage_transitions (board_id, source_stage_id, target_stage_id) SELECT $1, $2, id FROM stages WHERE board_id = $1 AND id = $3`, [boardId, stageId, targetId]);
        }
        await client.query(`UPDATE boards SET version = version + 1, updated_at = now() WHERE id = $1`, [boardId]);
        await client.query("COMMIT");
        return { ...updated.rows[0], allowed_target_ids: input.allowedTargetIds };
      } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    },

    async createStage(boardId, userId, input) {
      if (!("connect" in database) || typeof database.connect !== "function") throw new Error("Transactions are unavailable.");
      const client = await database.connect();
      try {
        await client.query("BEGIN");
        const contextResult = await client.query(`
          SELECT bm.role, (SELECT count(*)::int FROM stages s WHERE s.board_id = bm.board_id) AS stage_count
          FROM board_members bm
          WHERE bm.board_id = $1 AND bm.user_id = $2
          FOR UPDATE OF bm
        `, [boardId, userId]);
        const context = contextResult.rows[0];
        if (!context) { await client.query("ROLLBACK"); return { status: "not_found" }; }
        if (context.role !== "owner") { await client.query("ROLLBACK"); return { status: "forbidden" }; }
        const targets = input.allowedTargetIds ?? [];
        if (targets.length) {
          const targetResult = await client.query(`SELECT count(*)::int AS count FROM stages WHERE board_id = $1 AND id = ANY($2::uuid[])`, [boardId, targets]);
          if (Number(targetResult.rows[0]?.count) !== new Set(targets).size) { await client.query("ROLLBACK"); return { status: "invalid_targets" }; }
        }
        const created = await client.query(`
          INSERT INTO stages
            (id, board_id, title, color, kind, position, wip_limit, wip_limit_mode, require_completed_todos, transitions_restricted)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id, title, color, kind, wip_limit, wip_limit_mode, require_completed_todos, version
        `, [input.id, boardId, input.title, input.color, input.kind, Number(context.stage_count), input.limit, input.limitMode, input.requireCompletedTodos, input.allowedTargetIds !== null]);
        for (const targetId of targets) {
          await client.query(`INSERT INTO stage_transitions (board_id, source_stage_id, target_stage_id) VALUES ($1, $2, $3)`, [boardId, input.id, targetId]);
        }
        await client.query(`UPDATE boards SET version = version + 1, updated_at = now() WHERE id = $1`, [boardId]);
        await client.query("COMMIT");
        return { status: "created", stage: { ...created.rows[0], allowed_target_ids: input.allowedTargetIds } };
      } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    },

    async moveStage(boardId, stageId, targetIndex, version) {
      if (!("connect" in database) || typeof database.connect !== "function") throw new Error("Transactions are unavailable.");
      const client = await database.connect();
      try {
        await client.query("BEGIN");
        const locked = await client.query(`SELECT id, position, version FROM stages WHERE board_id = $1 ORDER BY position FOR UPDATE`, [boardId]);
        const current = locked.rows.find((row) => String(row.id) === stageId);
        if (!current || Number(current.version) !== version) { await client.query("ROLLBACK"); return null; }
        const nextPosition = Math.min(targetIndex, locked.rows.length - 1);
        if (nextPosition === Number(current.position)) { await client.query("COMMIT"); return current; }
        const result = await client.query(`
          UPDATE stages SET
            position = CASE
              WHEN id = $2 THEN $4::integer
              WHEN $3::integer < $4::integer AND position > $3::integer AND position <= $4::integer THEN position - 1
              WHEN $4::integer < $3::integer AND position >= $4::integer AND position < $3::integer THEN position + 1
              ELSE position
            END,
            version = CASE WHEN id = $2 THEN version + 1 ELSE version END,
            updated_at = CASE WHEN id = $2 THEN now() ELSE updated_at END
          WHERE board_id = $1
          RETURNING id, position, version
        `, [boardId, stageId, Number(current.position), nextPosition]);
        await client.query(`UPDATE boards SET version = version + 1, updated_at = now() WHERE id = $1`, [boardId]);
        await client.query("COMMIT");
        return result.rows.find((row) => String(row.id) === stageId) ?? null;
      } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    },

    async deleteStage(boardId, stageId, version, moveTasksTo) {
      if (!("connect" in database) || typeof database.connect !== "function") throw new Error("Transactions are unavailable.");
      const client = await database.connect();
      try {
        await client.query("BEGIN");
        const stages = await client.query(`SELECT id, position, version, wip_limit, wip_limit_mode FROM stages WHERE board_id = $1 ORDER BY position FOR UPDATE`, [boardId]);
        const source = stages.rows.find((row) => String(row.id) === stageId);
        if (!source || Number(source.version) !== version) { await client.query("ROLLBACK"); return "conflict"; }
        if (stages.rows.length <= 1) { await client.query("ROLLBACK"); return "last_stage"; }
        const target = moveTasksTo ? stages.rows.find((row) => String(row.id) === moveTasksTo && String(row.id) !== stageId) : null;
        if (moveTasksTo && !target) { await client.query("ROLLBACK"); return "invalid_target"; }
        const tasks = await client.query(`SELECT id, position FROM tasks WHERE stage_id = $1 ORDER BY position FOR UPDATE`, [stageId]);
        if (tasks.rowCount && !target) { await client.query("ROLLBACK"); return "invalid_target"; }
        if (target && tasks.rowCount) {
          const targetTasks = await client.query(`SELECT id FROM tasks WHERE stage_id = $1 ORDER BY position FOR UPDATE`, [target.id]);
          if (target.wip_limit_mode === "strict" && target.wip_limit !== null && Number(targetTasks.rowCount) + Number(tasks.rowCount) > Number(target.wip_limit)) {
            await client.query("ROLLBACK"); return "wip_limit";
          }
          await client.query(`UPDATE tasks SET stage_id = $2, position = position + $3, version = version + 1, updated_at = now() WHERE stage_id = $1`, [stageId, target.id, targetTasks.rowCount]);
        }
        await client.query(`DELETE FROM stages WHERE board_id = $1 AND id = $2`, [boardId, stageId]);
        await client.query(`UPDATE stages SET position = position - 1 WHERE board_id = $1 AND position > $2`, [boardId, source.position]);
        await client.query(`UPDATE boards SET version = version + 1, updated_at = now() WHERE id = $1`, [boardId]);
        await client.query("COMMIT");
        return "deleted";
      } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    },
  };
}
