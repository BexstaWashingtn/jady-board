/**
 * @typedef {Object} BoardService
 * @property {(userId: string) => Promise<Record<string, any>[]>} listBoards
 * @property {(boardId: string, userId: string) => Promise<Record<string, any>|null>} getBoard
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
