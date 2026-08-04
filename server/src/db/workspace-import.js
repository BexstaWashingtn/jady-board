import { createHash } from "node:crypto";

import { serializeWorkspace } from "../../../src/board/board.persistence.js";
import { parseWorkspaceBackup } from "../../../src/board/board.transfer.js";

/**
 * @typedef {Object} WorkspaceImportPlan
 * @property {string} fingerprint
 * @property {string} importId
 * @property {string} exportedAt
 * @property {{id: string, email: string, name: string, initials: string, theme: string}[]} users
 * @property {{id: string, sourceId: string, name: string, path: string, description: string, ownerId: string, taskPrefix: string, nextTaskNumber: number}[]} boards
 * @property {{boardId: string, userId: string, role: "owner"|"member"}[]} members
 * @property {{id: string, boardId: string, sourceId: string, title: string, color: string, kind: string, position: number, limit: number|null, limitMode: string, requireCompletedTodos: boolean, transitionsRestricted: boolean}[]} stages
 * @property {{id: string, boardId: string, stageId: string, sourceId: string, taskNumber: number, title: string, category: string, priority: string, assigneeId: string|null, dueDate: string|null, position: number, commentsCount: number}[]} tasks
 * @property {{id: string, taskId: string, text: string, completed: boolean, position: number}[]} todos
 * @property {{boardId: string, sourceStageId: string, targetStageId: string}[]} transitions
 */

/**
 * Validates a JaDy Board backup and converts it into relational rows without
 * touching the database. IDs are deterministic so a source object always maps
 * to the same PostgreSQL UUID.
 *
 * @param {string} source
 * @returns {WorkspaceImportPlan}
 */
export function createWorkspaceImportPlan(source) {
  const preview = parseWorkspaceBackup(source);
  const canonicalWorkspace = serializeWorkspace(preview.workspace);
  const fingerprint = createHash("sha256").update(canonicalWorkspace).digest("hex");
  const importId = stableUuid("import", fingerprint);
  const users = Object.entries(preview.workspace.users).map(([sourceId, user]) => ({
    id: stableUuid("user", sourceId),
    email: `${safeIdentifier(sourceId)}@local.jady.invalid`,
    name: user.name,
    initials: user.initials,
    theme: user.preferences.theme,
  }));
  const userIds = new Map(Object.keys(preview.workspace.users)
    .map((sourceId) => [sourceId, stableUuid("user", sourceId)]));
  const usedPrefixes = new Set();
  /** @type {WorkspaceImportPlan["boards"]} */
  const boards = [];
  /** @type {WorkspaceImportPlan["members"]} */
  const members = [];
  /** @type {WorkspaceImportPlan["stages"]} */
  const stages = [];
  /** @type {WorkspaceImportPlan["tasks"]} */
  const tasks = [];
  /** @type {WorkspaceImportPlan["todos"]} */
  const todos = [];
  /** @type {WorkspaceImportPlan["transitions"]} */
  const transitions = [];

  for (const [boardSourceId, board] of Object.entries(preview.workspace.boards)) {
    const boardId = stableUuid("board", boardSourceId);
    const ownerId = userIds.get(board.project.ownerId);
    if (!ownerId) throw new Error(`Workspace import: owner ${board.project.ownerId} is missing.`);
    const taskPrefix = uniqueTaskPrefix(board, usedPrefixes);
    const taskNumbers = allocateTaskNumbers(Object.keys(board.tasks));
    const nextTaskNumber = Math.max(0, ...taskNumbers.values()) + 1;
    boards.push({
      id: boardId,
      sourceId: boardSourceId,
      name: board.project.name,
      path: board.project.path,
      description: board.project.description,
      ownerId,
      taskPrefix,
      nextTaskNumber,
    });

    for (const memberSourceId of board.project.memberIds) {
      const userId = userIds.get(memberSourceId);
      if (!userId) continue;
      members.push({ boardId, userId, role: memberSourceId === board.project.ownerId ? "owner" : "member" });
    }

    const stageIds = new Map(board.columns.map((column) => [
      column.id,
      stableUuid("stage", `${boardSourceId}:${column.id}`),
    ]));
    board.columns.forEach((column, position) => {
      const stageId = stageIds.get(column.id);
      if (!stageId) return;
      stages.push({
        id: stageId,
        boardId,
        sourceId: column.id,
        title: column.title,
        color: column.color,
        kind: column.kind,
        position,
        limit: column.limit,
        limitMode: column.limitMode,
        requireCompletedTodos: column.requireCompletedTodos,
        transitionsRestricted: column.allowedTargetIds !== null,
      });
      if (column.allowedTargetIds) {
        for (const targetSourceId of column.allowedTargetIds) {
          const targetStageId = stageIds.get(targetSourceId);
          if (targetStageId) transitions.push({ boardId, sourceStageId: stageId, targetStageId });
        }
      }
      column.taskIds.forEach((taskSourceId, taskPosition) => {
        const task = board.tasks[taskSourceId];
        if (!task) return;
        const taskId = stableUuid("task", `${boardSourceId}:${taskSourceId}`);
        tasks.push({
          id: taskId,
          boardId,
          stageId,
          sourceId: taskSourceId,
          taskNumber: taskNumbers.get(taskSourceId) ?? taskPosition + 1,
          title: task.title,
          category: task.category,
          priority: task.priority,
          assigneeId: task.assigneeId ? userIds.get(task.assigneeId) ?? null : null,
          dueDate: task.dueDate,
          position: taskPosition,
          commentsCount: task.comments,
        });
        task.todos.forEach((todo, todoPosition) => todos.push({
          id: stableUuid("todo", `${boardSourceId}:${taskSourceId}:${todo.id}`),
          taskId,
          text: todo.text,
          completed: todo.completed,
          position: todoPosition,
        }));
      });
    });
  }

  return { fingerprint, importId, exportedAt: preview.exportedAt, users, boards, members, stages, tasks, todos, transitions };
}

/**
 * Imports one validated plan atomically. A canonical backup can only be
 * imported once.
 *
 * @param {import("./database.js").Database} database
 * @param {WorkspaceImportPlan} plan
 */
export async function importWorkspace(database, plan) {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const duplicate = await client.query(
      "SELECT 1 FROM workspace_imports WHERE fingerprint = $1",
      [plan.fingerprint],
    );
    if (duplicate.rowCount) throw new Error("Workspace import: this backup was already imported.");

    for (const user of plan.users) {
      await client.query(
        `INSERT INTO users (id, email, display_name, initials)
         VALUES ($1, $2, $3, $4)`,
        [user.id, user.email, user.name, user.initials],
      );
      await client.query(
        "INSERT INTO user_preferences (user_id, theme) VALUES ($1, $2)",
        [user.id, user.theme],
      );
    }
    for (const board of plan.boards) {
      await client.query(
        `INSERT INTO boards
          (id, name, path, description, owner_id, task_prefix, next_task_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [board.id, board.name, board.path, board.description, board.ownerId, board.taskPrefix, board.nextTaskNumber],
      );
    }
    for (const member of plan.members) {
      await client.query(
        "INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, $3)",
        [member.boardId, member.userId, member.role],
      );
    }
    for (const stage of plan.stages) {
      await client.query(
        `INSERT INTO stages
          (id, board_id, title, color, kind, position, wip_limit, wip_limit_mode,
           require_completed_todos, transitions_restricted)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [stage.id, stage.boardId, stage.title, stage.color, stage.kind, stage.position,
          stage.limit, stage.limitMode, stage.requireCompletedTodos, stage.transitionsRestricted],
      );
    }
    for (const task of plan.tasks) {
      await client.query(
        `INSERT INTO tasks
          (id, board_id, stage_id, task_number, title, category, priority,
           assignee_id, due_date, position, comments_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [task.id, task.boardId, task.stageId, task.taskNumber, task.title, task.category,
          task.priority, task.assigneeId, task.dueDate, task.position, task.commentsCount],
      );
    }
    for (const todo of plan.todos) {
      await client.query(
        `INSERT INTO task_todos (id, task_id, text, completed, position)
         VALUES ($1, $2, $3, $4, $5)`,
        [todo.id, todo.taskId, todo.text, todo.completed, todo.position],
      );
    }
    for (const transition of plan.transitions) {
      await client.query(
        `INSERT INTO stage_transitions (board_id, source_stage_id, target_stage_id)
         VALUES ($1, $2, $3)`,
        [transition.boardId, transition.sourceStageId, transition.targetStageId],
      );
    }
    await client.query(
      `INSERT INTO workspace_imports
        (id, fingerprint, source_exported_at, user_count, board_count, task_count)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [plan.importId, plan.fingerprint, plan.exportedAt, plan.users.length, plan.boards.length, plan.tasks.length],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** @param {string} scope @param {string} sourceId */
function stableUuid(scope, sourceId) {
  const bytes = createHash("sha256").update(`jady-board:${scope}:${sourceId}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** @param {string} value */
function safeIdentifier(value) {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-|-$/g, "") || "user";
}

/** @param {import("../../../src/board/board.state.js").BoardState} board @param {Set<string>} used */
function uniqueTaskPrefix(board, used) {
  const taskPrefix = Object.keys(board.tasks)
    .map((id) => id.match(/^([A-Z0-9]+)-\d+$/)?.[1])
    .find(Boolean);
  const generatedPrefix = board.project.name.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 12) || "TASK";
  const base = (taskPrefix ?? generatedPrefix).slice(0, 12);
  let prefix = base;
  let suffix = 2;
  while (used.has(prefix)) {
    const tail = String(suffix++);
    prefix = `${base.slice(0, 12 - tail.length)}${tail}`;
  }
  used.add(prefix);
  return prefix;
}

/** @param {string[]} taskIds */
function allocateTaskNumbers(taskIds) {
  const used = new Set();
  const result = new Map();
  let fallback = 1;
  for (const taskId of taskIds) {
    const parsed = Number(taskId.match(/-(\d+)$/)?.[1]);
    let number = Number.isSafeInteger(parsed) && parsed > 0 && !used.has(parsed) ? parsed : fallback;
    while (used.has(number)) number += 1;
    used.add(number);
    result.set(taskId, number);
    fallback = Math.max(fallback, number + 1);
  }
  return result;
}
