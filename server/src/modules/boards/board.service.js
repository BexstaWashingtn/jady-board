/**
 * @typedef {Object} BoardService
 * @property {(userId: string) => Promise<Record<string, any>[]>} listBoards
 * @property {(boardId: string, userId: string) => Promise<Record<string, any>|null>} getBoard
 * @property {(boardId: string, taskId: string, userId: string, input: unknown) => Promise<{status: "updated", task: Record<string, any>}|{status: "not_found"|"forbidden"|"conflict"}|{status: "invalid", message: string}>} updateTask
 * @property {(boardId: string, taskId: string, userId: string, input: unknown) => Promise<{status: "moved", task: Record<string, any>}|{status: "not_found"|"forbidden"|"conflict"}|{status: "rejected", code: string, message: string}|{status: "invalid", message: string}>} moveTask
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
  };
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
