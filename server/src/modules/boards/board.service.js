import { randomUUID } from "node:crypto";

/**
 * @typedef {Object} BoardService
 * @property {(userId: string) => Promise<Record<string, any>[]>} listBoards
 * @property {(boardId: string, userId: string) => Promise<Record<string, any>|null>} getBoard
 * @property {(boardId: string, taskId: string, userId: string, input: unknown) => Promise<{status: "updated", task: Record<string, any>}|{status: "not_found"|"forbidden"|"conflict"}|{status: "invalid", message: string}>} updateTask
 * @property {(boardId: string, taskId: string, userId: string, input: unknown) => Promise<{status: "moved", task: Record<string, any>}|{status: "not_found"|"forbidden"|"conflict"}|{status: "rejected", code: string, message: string}|{status: "invalid", message: string}>} moveTask
 * @property {(boardId: string, userId: string, input: unknown) => Promise<{status: "created", task: Record<string, any>}|{status: "not_found"|"forbidden"}|{status: "rejected", code: string, message: string}|{status: "invalid", message: string}>} createTask
 * @property {(boardId: string, taskId: string, userId: string, input: unknown) => Promise<{status: "updated", task: Record<string, any>}|{status: "not_found"|"forbidden"|"conflict"}|{status: "invalid", message: string}>} assignTask
 * @property {(boardId: string, taskId: string, userId: string, input: unknown) => Promise<{status: "updated", task: Record<string, any>}|{status: "not_found"|"forbidden"|"conflict"}|{status: "invalid", message: string}>} syncTaskTodos
 * @property {(boardId: string, taskId: string, userId: string, version: unknown) => Promise<{status: "deleted"|"not_found"|"forbidden"|"conflict"}|{status: "invalid", message: string}>} deleteTask
 * @property {(boardId: string, stageId: string, userId: string, input: unknown) => Promise<{status: "updated", stage: Record<string, any>}|{status: "not_found"|"forbidden"|"conflict"}|{status: "invalid", message: string}>} updateStage
 * @property {(boardId: string, userId: string, input: unknown) => Promise<{status: "created", stage: Record<string, any>}|{status: "not_found"|"forbidden"}|{status: "invalid", message: string}>} createStage
 */

/**
 * @param {import("./board.repository.js").BoardRepository} repository
 * @returns {BoardService}
 */
export function createBoardService(repository) {
  return {
    async listBoards(userId) {
      const rows = await repository.listForUser(userId);
      return rows.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        path: String(row.path),
        description: String(row.description),
        role: String(row.role),
        version: Number(row.version),
        stageCount: Number(row.stage_count),
        taskCount: Number(row.task_count),
      }));
    },

    async getBoard(boardId, userId) {
      const data = await repository.findForUser(boardId, userId);
      if (!data) return null;
      return mapBoard(data);
    },

    async updateTask(boardId, taskId, userId, input) {
      const parsed = parseTaskUpdate(input);
      if ("message" in parsed) return { status: "invalid", message: parsed.message };
      if (!repository.findTaskForUser || !repository.updateTaskMetadata) throw new Error("Task writes are unavailable.");
      const current = await repository.findTaskForUser(boardId, taskId, userId);
      if (!current) return { status: "not_found" };
      if (current.role !== "owner" && String(current.assignee_id ?? "") !== userId) return { status: "forbidden" };
      if (Number(current.version) !== parsed.version) return { status: "conflict" };
      const updated = await repository.updateTaskMetadata(boardId, taskId, parsed.version, parsed);
      if (!updated) return { status: "conflict" };
      return { status: "updated", task: mapUpdatedTask(updated) };
    },

    async moveTask(boardId, taskId, userId, input) {
      const parsed = parseTaskMove(input);
      if ("message" in parsed) return { status: "invalid", message: parsed.message };
      if (!repository.findTaskMoveContext || !repository.moveTask) throw new Error("Task moves are unavailable.");
      const current = await repository.findTaskMoveContext(boardId, taskId, userId, parsed.stageId);
      if (!current || !current.target_stage_id) return { status: "not_found" };
      if (current.role !== "owner" && String(current.assignee_id ?? "") !== userId) return { status: "forbidden" };
      if (Number(current.version) !== parsed.version) return { status: "conflict" };
      if (String(current.stage_id) === parsed.stageId) {
        return { status: "moved", task: { id: taskId, stageId: parsed.stageId, position: Number(current.position ?? 0), version: parsed.version } };
      }
      if (!current.transition_allowed) return { status: "rejected", code: "TRANSITION_NOT_ALLOWED", message: "The configured workflow does not allow this transition." };
      if (current.require_completed_todos && Number(current.open_todo_count) > 0) return { status: "rejected", code: "OPEN_TODOS", message: "All todos must be completed before this transition." };
      if (current.wip_limit_mode === "strict" && current.wip_limit !== null && Number(current.target_count) >= Number(current.wip_limit)) {
        return { status: "rejected", code: "WIP_LIMIT_REACHED", message: "The target stage has reached its WIP limit." };
      }
      const targetIndex = Math.min(parsed.targetIndex ?? Number(current.target_count), Number(current.target_count));
      const moved = await repository.moveTask(boardId, taskId, parsed.stageId, targetIndex, parsed.version);
      if (!moved) return { status: "conflict" };
      return { status: "moved", task: { id: String(moved.id), stageId: String(moved.stage_id), position: Number(moved.position), version: Number(moved.version) } };
    },

    async createTask(boardId, userId, input) {
      const parsed = parseTaskCreate(input);
      if ("message" in parsed) return { status: "invalid", message: parsed.message };
      if (!repository.createTask) throw new Error("Task creation is unavailable.");
      const result = await repository.createTask(boardId, userId, { id: randomUUID(), ...parsed });
      if (result.status === "wip_limit") return { status: "rejected", code: "WIP_LIMIT_REACHED", message: "The target stage has reached its WIP limit." };
      if (result.status === "not_found") return { status: "not_found" };
      if (result.status === "forbidden") return { status: "forbidden" };
      if (result.status !== "created") throw new Error("Unexpected task creation result.");
      const row = result.task;
      return { status: "created", task: {
        id: String(row.id), key: `${row.task_prefix}-${row.task_number}`,
        title: String(row.title), category: String(row.category), priority: String(row.priority),
        comments: 0, todos: [], dueDate: row.due_date ? String(row.due_date) : null,
        assigneeId: row.assignee_id ? String(row.assignee_id) : null, version: Number(row.version),
        stageId: String(row.stage_id), position: Number(row.position),
      } };
    },

    async assignTask(boardId, taskId, userId, input) {
      const parsed = parseTaskAssignment(input);
      if ("message" in parsed) return { status: "invalid", message: parsed.message };
      if (!repository.findTaskForUser || !repository.isBoardMember || !repository.updateTaskAssignment) throw new Error("Task assignment is unavailable.");
      const current = await repository.findTaskForUser(boardId, taskId, userId);
      if (!current) return { status: "not_found" };
      if (Number(current.version) !== parsed.version) return { status: "conflict" };
      const currentAssignee = current.assignee_id ? String(current.assignee_id) : null;
      if (parsed.assigneeId && !(await repository.isBoardMember(boardId, parsed.assigneeId))) return { status: "forbidden" };
      const allowed = current.role === "owner"
        || (currentAssignee === null && parsed.assigneeId === userId)
        || (currentAssignee === userId && parsed.assigneeId === null);
      if (!allowed) return { status: "forbidden" };
      if (currentAssignee === parsed.assigneeId) return { status: "updated", task: { id: taskId, assigneeId: currentAssignee, version: parsed.version } };
      const updated = await repository.updateTaskAssignment(boardId, taskId, parsed.version, parsed.assigneeId);
      if (!updated) return { status: "conflict" };
      return { status: "updated", task: { id: String(updated.id), assigneeId: updated.assignee_id ? String(updated.assignee_id) : null, version: Number(updated.version) } };
    },

    async syncTaskTodos(boardId, taskId, userId, input) {
      const parsed = parseTodoSync(input);
      if ("message" in parsed) return { status: "invalid", message: parsed.message };
      if (!repository.findTaskForUser || !repository.replaceTaskTodos) throw new Error("Todo writes are unavailable.");
      const current = await repository.findTaskForUser(boardId, taskId, userId);
      if (!current) return { status: "not_found" };
      if (current.role !== "owner" && String(current.assignee_id ?? "") !== userId) return { status: "forbidden" };
      if (Number(current.version) !== parsed.version) return { status: "conflict" };
      const todos = parsed.todos.map((todo) => ({ ...todo, id: isUuid(todo.id) ? todo.id : randomUUID() }));
      const updated = await repository.replaceTaskTodos(boardId, taskId, parsed.version, todos);
      if (!updated) return { status: "conflict" };
      return { status: "updated", task: { id: taskId, todos: updated.todos, version: Number(updated.version) } };
    },

    async deleteTask(boardId, taskId, userId, version) {
      const parsedVersion = Number(version);
      if (!Number.isInteger(parsedVersion) || parsedVersion < 1) return { status: "invalid", message: "Task version must be a positive integer." };
      if (!repository.findTaskForUser || !repository.deleteTask) throw new Error("Task deletion is unavailable.");
      const current = await repository.findTaskForUser(boardId, taskId, userId);
      if (!current) return { status: "not_found" };
      if (current.role !== "owner") return { status: "forbidden" };
      if (Number(current.version) !== parsedVersion) return { status: "conflict" };
      return await repository.deleteTask(boardId, taskId, parsedVersion) ? { status: "deleted" } : { status: "conflict" };
    },

    async updateStage(boardId, stageId, userId, input) {
      const parsed = parseStageUpdate(input, stageId);
      if ("message" in parsed) return { status: "invalid", message: parsed.message };
      if (!repository.findStageForUser || !repository.updateStage) throw new Error("Stage writes are unavailable.");
      const current = await repository.findStageForUser(boardId, stageId, userId);
      if (!current) return { status: "not_found" };
      if (current.role !== "owner") return { status: "forbidden" };
      if (Number(current.version) !== parsed.version) return { status: "conflict" };
      const row = await repository.updateStage(boardId, stageId, parsed.version, parsed);
      if (!row) return { status: "conflict" };
      return { status: "updated", stage: { id: String(row.id), title: String(row.title), color: String(row.color), kind: String(row.kind), limit: row.wip_limit === null ? null : Number(row.wip_limit), limitMode: String(row.wip_limit_mode), requireCompletedTodos: Boolean(row.require_completed_todos), allowedTargetIds: row.allowed_target_ids, version: Number(row.version) } };
    },

    async createStage(boardId, userId, input) {
      const parsed = parseStageCreate(input);
      if ("message" in parsed) return { status: "invalid", message: parsed.message };
      if (!repository.createStage) throw new Error("Stage creation is unavailable.");
      const result = await repository.createStage(boardId, userId, { id: randomUUID(), ...parsed });
      if (result.status === "invalid_targets") return { status: "invalid", message: "Stage transitions contain an unknown target." };
      if (result.status === "not_found") return { status: "not_found" };
      if (result.status === "forbidden") return { status: "forbidden" };
      if (result.status !== "created") throw new Error("Unexpected stage creation result.");
      const row = result.stage;
      return { status: "created", stage: { id: String(row.id), title: String(row.title), color: String(row.color), kind: String(row.kind), limit: row.wip_limit === null ? null : Number(row.wip_limit), limitMode: String(row.wip_limit_mode), requireCompletedTodos: Boolean(row.require_completed_todos), allowedTargetIds: row.allowed_target_ids, taskIds: [], version: Number(row.version) } };
    },
  };
}

/** @param {unknown} input */
function parseStageCreate(input) {
  const parsed = parseStageUpdate({ ...(input && typeof input === "object" && !Array.isArray(input) ? input : {}), version: 1 }, "");
  if ("message" in parsed) return parsed;
  const { version: _version, ...created } = parsed;
  return created;
}

/**
 * @param {unknown} input @param {string} stageId
 * @returns {{message: string}|{title: string, color: string, kind: string, limit: number|null, limitMode: string, allowedTargetIds: string[]|null, requireCompletedTodos: boolean, version: number}}
 */
function parseStageUpdate(input, stageId) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { message: "A JSON object is required." };
  const value = /** @type {Record<string, unknown>} */ (input);
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const limit = value.limit === null || value.limit === "" ? null : Number(value.limit);
  const targets = value.allowedTargetIds === null ? null : value.allowedTargetIds;
  if (!title || typeof value.color !== "string" || !/^#[0-9a-f]{6}$/i.test(value.color)) return { message: "Stage title or color is invalid." };
  if (!["backlog", "active", "review", "done"].includes(String(value.kind)) || !["warning", "strict"].includes(String(value.limitMode))) return { message: "Stage kind or limit mode is invalid." };
  if (limit !== null && (!Number.isInteger(limit) || limit < 1)) return { message: "Stage limit is invalid." };
  if (targets !== null && (!Array.isArray(targets) || targets.some((id) => typeof id !== "string" || !isUuid(id) || id === stageId))) return { message: "Stage transitions are invalid." };
  if (typeof value.requireCompletedTodos !== "boolean" || !Number.isInteger(value.version) || Number(value.version) < 1) return { message: "Stage settings or version are invalid." };
  return { title, color: value.color, kind: String(value.kind), limit, limitMode: String(value.limitMode), allowedTargetIds: targets === null ? null : [...new Set(targets)], requireCompletedTodos: value.requireCompletedTodos, version: Number(value.version) };
}

/**
 * @param {unknown} input
 * @returns {{message: string}|{version: number, todos: {id: string, text: string, completed: boolean}[]}}
 */
function parseTodoSync(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { message: "A JSON object is required." };
  const value = /** @type {Record<string, unknown>} */ (input);
  if (!Number.isInteger(value.version) || Number(value.version) < 1) return { message: "Task version must be a positive integer." };
  if (!Array.isArray(value.todos) || value.todos.length > 100) return { message: "Task todos must be an array with at most 100 entries." };
  const todos = [];
  for (const entry of value.todos) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return { message: "Each todo must be an object." };
    const todo = /** @type {Record<string, unknown>} */ (entry);
    const text = typeof todo.text === "string" ? todo.text.trim() : "";
    if (!text || text.length > 500 || typeof todo.completed !== "boolean") return { message: "Todo text or completion state is invalid." };
    todos.push({ id: typeof todo.id === "string" ? todo.id : "", text, completed: todo.completed });
  }
  return { version: Number(value.version), todos };
}

/** @param {string} value */
function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * @param {unknown} input
 * @returns {{message: string}|{assigneeId: string|null, version: number}}
 */
function parseTaskAssignment(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { message: "A JSON object is required." };
  const value = /** @type {Record<string, unknown>} */ (input);
  if (value.assigneeId !== null && typeof value.assigneeId !== "string") return { message: "Task assignee is invalid." };
  if (!Number.isInteger(value.version) || Number(value.version) < 1) return { message: "Task version must be a positive integer." };
  return { assigneeId: value.assigneeId === null || value.assigneeId === "" ? null : String(value.assigneeId), version: Number(value.version) };
}

/**
 * @param {unknown} input
 * @returns {{message: string}|{stageId: string, title: string, category: string, priority: string, assigneeId: string|null, dueDate: string|null}}
 */
function parseTaskCreate(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { message: "A JSON object is required." };
  const value = /** @type {Record<string, unknown>} */ (input);
  const common = parseTaskUpdate({ ...value, dueDate: value.dueDate ?? null, version: 1 });
  if ("message" in common) return common;
  if (typeof value.stageId !== "string" || !value.stageId.trim()) return { message: "Target stage is required." };
  if (value.assigneeId !== null && value.assigneeId !== undefined && typeof value.assigneeId !== "string") return { message: "Task assignee is invalid." };
  return { stageId: value.stageId, title: common.title, category: common.category, priority: common.priority, dueDate: common.dueDate, assigneeId: typeof value.assigneeId === "string" && value.assigneeId ? value.assigneeId : null };
}

/**
 * @param {unknown} input
 * @returns {{message: string}|{stageId: string, targetIndex: number|null, version: number}}
 */
function parseTaskMove(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { message: "A JSON object is required." };
  const value = /** @type {Record<string, unknown>} */ (input);
  if (typeof value.stageId !== "string" || !value.stageId.trim()) return { message: "Target stage is required." };
  if (!Number.isInteger(value.version) || Number(value.version) < 1) return { message: "Task version must be a positive integer." };
  if (value.targetIndex !== undefined && (!Number.isInteger(value.targetIndex) || Number(value.targetIndex) < 0)) return { message: "Target index must be a non-negative integer." };
  return { stageId: value.stageId, targetIndex: value.targetIndex === undefined ? null : Number(value.targetIndex), version: Number(value.version) };
}

/**
 * @param {unknown} input
 * @returns {{message: string}|{title: string, category: string, priority: string, dueDate: string|null, version: number}}
 */
function parseTaskUpdate(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { message: "A JSON object is required." };
  const value = /** @type {Record<string, unknown>} */ (input);
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const category = typeof value.category === "string" ? value.category.trim() : "";
  const dueDate = value.dueDate === null || value.dueDate === "" ? null : value.dueDate;
  if (!title) return { message: "Task title is required." };
  if (!category) return { message: "Task category is required." };
  if (!(["low", "medium", "high"].includes(String(value.priority)))) return { message: "Task priority is invalid." };
  if (!Number.isInteger(value.version) || Number(value.version) < 1) return { message: "Task version must be a positive integer." };
  if (dueDate !== null && (typeof dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate))) return { message: "Task due date is invalid." };
  return { title, category, priority: String(value.priority), dueDate, version: Number(value.version) };
}

/** @param {Record<string, any>} row */
function mapUpdatedTask(row) {
  return {
    id: String(row.id), title: String(row.title), category: String(row.category),
    priority: String(row.priority), dueDate: row.due_date ? String(row.due_date) : null,
    assigneeId: row.assignee_id ? String(row.assignee_id) : null, version: Number(row.version),
  };
}

/** @param {Record<string, any>} data */
function mapBoard(data) {
  const todoRows = /** @type {Record<string, any>[]} */ (data.todos);
  const taskRows = /** @type {Record<string, any>[]} */ (data.tasks);
  const transitionRows = /** @type {Record<string, any>[]} */ (data.transitions);
  const memberRows = /** @type {Record<string, any>[]} */ (data.members);
  const stageRows = /** @type {Record<string, any>[]} */ (data.stages);
  const todoGroups = groupBy(todoRows, "task_id");
  const taskGroups = groupBy(taskRows, "stage_id");
  const transitionGroups = groupBy(transitionRows, "source_stage_id");
  const tasks = Object.fromEntries(taskRows.map((task) => [String(task.id), {
    id: String(task.id),
    key: `${data.board.task_prefix}-${task.task_number}`,
    title: String(task.title),
    category: String(task.category),
    priority: String(task.priority),
    comments: Number(task.comments_count),
    todos: (todoGroups.get(String(task.id)) ?? []).map((todo) => ({
      id: String(todo.id), text: String(todo.text), completed: Boolean(todo.completed),
    })),
    dueDate: task.due_date ? String(task.due_date) : null,
    assigneeId: task.assignee_id ? String(task.assignee_id) : null,
    version: Number(task.version),
  }]));
  return {
    id: String(data.board.id),
    version: Number(data.board.version),
    role: String(data.board.role),
    project: {
      name: String(data.board.name),
      path: String(data.board.path),
      description: String(data.board.description),
      ownerId: String(data.board.owner_id),
      memberIds: memberRows.map((member) => String(member.id)),
    },
    members: memberRows.map((member) => ({
      id: String(member.id), name: String(member.display_name), initials: String(member.initials), role: String(member.role),
    })),
    columns: stageRows.map((stage) => ({
      id: String(stage.id),
      title: String(stage.title),
      color: String(stage.color),
      kind: String(stage.kind),
      limit: stage.wip_limit === null ? null : Number(stage.wip_limit),
      limitMode: String(stage.wip_limit_mode),
      allowedTargetIds: stage.transitions_restricted
        ? (transitionGroups.get(String(stage.id)) ?? []).map((transition) => String(transition.target_stage_id))
        : null,
      requireCompletedTodos: Boolean(stage.require_completed_todos),
      taskIds: (taskGroups.get(String(stage.id)) ?? []).map((task) => String(task.id)),
      version: Number(stage.version),
    })),
    tasks,
  };
}

/**
 * @param {Record<string, any>[]} rows
 * @param {string} key
 * @returns {Map<string, Record<string, any>[]>}
 */
function groupBy(rows, key) {
  /** @type {Map<string, Record<string, any>[]>} */
  const groups = new Map();
  for (const row of rows) {
    const value = String(row[key]);
    const group = groups.get(value) ?? [];
    group.push(row);
    groups.set(value, group);
  }
  return groups;
}
