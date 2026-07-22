/** @typedef {{ id: string, text: string, completed: boolean }} TaskTodo */
/** @typedef {{ id: string, title: string, category: string, priority: "low" | "medium" | "high", assignee: string, comments: number, todos: TaskTodo[], dueDate: string | null, ownerId: string | null, memberIds: string[] }} BoardTask */
/** @typedef {"backlog" | "active" | "review" | "done"} ColumnKind */
/** @typedef {"warning" | "strict"} LimitMode */
/** @typedef {{ id: string, title: string, color: string, kind: ColumnKind, limit: number | null, limitMode: LimitMode, allowedTargetIds: string[] | null, requireCompletedTodos: boolean, taskIds: string[] }} BoardColumn */
/** @typedef {{ name: string, path: string, description: string, ownerId: string, memberIds: string[] }} BoardProject */
/** @typedef {{ query: string, priority: string, category: string, assignee: string }} BoardFilters */
/** @typedef {{ type: "move-task", taskId: string, columnId: string, index: number } | { type: "delete-task", task: BoardTask, columnId: string, index: number }} UndoCommand */
/** @typedef {{ project: BoardProject, columns: BoardColumn[], tasks: Record<string, BoardTask> }} BoardState */
/** @typedef {{ title: unknown, category: unknown, priority: unknown, assignee: unknown, dueDate?: unknown, columnId: string }} NewTaskInput */

export const BOARD_STORAGE_KEY = "jadydoco.board";
export const LEGACY_BOARD_STORAGE_KEY = "jadydoco.board.v1";
export const BOARD_SCHEMA_VERSION = 4;

/** @type {BoardState} */
export const initialBoardState = {
  project: {
    name: "Product Board",
    path: "Projekte / Website 2.0",
    description: "Plane, priorisiere und verfolge die nächsten Schritte.",
    ownerId: "user-1",
    memberIds: ["user-1"],
  },
  columns: [
    { id: "backlog", title: "Backlog", color: "#9297a0", kind: "backlog", limit: null, limitMode: "warning", allowedTargetIds: null, requireCompletedTodos: false, taskIds: ["KAN-18", "KAN-21", "KAN-24"] },
    { id: "progress", title: "In Arbeit", color: "#e5a84b", kind: "active", limit: 4, limitMode: "warning", allowedTargetIds: null, requireCompletedTodos: false, taskIds: ["KAN-12", "KAN-16"] },
    { id: "review", title: "Review", color: "#8b7cf6", kind: "review", limit: 3, limitMode: "strict", allowedTargetIds: null, requireCompletedTodos: false, taskIds: ["KAN-09", "KAN-14"] },
    { id: "done", title: "Erledigt", color: "#57b894", kind: "done", limit: null, limitMode: "warning", allowedTargetIds: null, requireCompletedTodos: false, taskIds: ["KAN-05", "KAN-07"] },
  ],
  tasks: {
    "KAN-18": task("KAN-18", "Leere Zustände für alle Ansichten gestalten", "Design", "medium", "MK", 2),
    "KAN-21": task("KAN-21", "Komponenten-API evaluieren", "Research", "low", "TB", 0),
    "KAN-24": task("KAN-24", "Keyboard-Navigation dokumentieren", "Docs", "medium", "LS", 1),
    "KAN-12": task("KAN-12", "Atomisches Rendering mit Fragmenten", "Core", "high", "TB", 4),
    "KAN-16": task("KAN-16", "Responsive Board-Navigation", "Frontend", "medium", "MK", 2),
    "KAN-09": task("KAN-09", "JSDoc-Typen für Nodes ergänzen", "Types", "high", "TB", 5),
    "KAN-14": task("KAN-14", "Formular-Beispiele überprüfen", "QA", "medium", "LS", 0),
    "KAN-05": task("KAN-05", "Automatisierte Core-Tests", "Testing", "high", "TB", 8),
    "KAN-07": task("KAN-07", "Projektstruktur modernisieren", "Core", "medium", "MK", 0),
  },
};

/** @returns {BoardState} */
export function createInitialBoardState() {
  return structuredClone(initialBoardState);
}

/**
 * @param {BoardState} state
 * @param {NewTaskInput} input
 * @returns {BoardTask}
 */
export function addTask(state, input) {
  const column = state.columns.find(({ id }) => id === input.columnId);
  const title = String(input.title ?? "").trim();

  if (!column) throw new Error(`Board: column "${input.columnId}" not found.`);
  if (!title) throw new Error("Board: task title is required.");
  assertColumnCapacity(column, 1);

  const id = nextTaskId(state.tasks);
  state.tasks[id] = task(
    id,
    title,
    String(input.category || "Allgemein"),
    normalizePriority(input.priority),
    String(input.assignee || "TB").toUpperCase().slice(0, 2),
    0,
    normalizeDueDate(input.dueDate),
  );
  column.taskIds.push(id);
  return state.tasks[id];
}

/**
 * @param {BoardState} state
 * @param {string} taskId
 * @param {string} targetColumnId
 * @param {number} [targetIndex]
 * @returns {boolean}
 */
export function moveTask(state, taskId, targetColumnId, targetIndex) {
  if (!state.tasks[taskId]) throw new Error(`Board: task "${taskId}" not found.`);
  const target = state.columns.find(({ id }) => id === targetColumnId);
  if (!target) throw new Error(`Board: column "${targetColumnId}" not found.`);
  const source = state.columns.find(({ taskIds }) => taskIds.includes(taskId));
  const targetLength = target.taskIds.length - (target.taskIds.includes(taskId) ? 1 : 0);
  const index = typeof targetIndex === "number" && Number.isInteger(targetIndex)
    ? Math.max(0, Math.min(targetIndex, targetLength))
    : targetLength;
  if (source?.id === target.id && source.taskIds.indexOf(taskId) === index) return false;
  if (source && source.id !== target.id && source.allowedTargetIds !== null && !source.allowedTargetIds.includes(target.id)) {
    throw new Error(`Board: transition from "${source.title}" to "${target.title}" is not allowed.`);
  }
  if (source?.id !== target.id && target.requireCompletedTodos && state.tasks[taskId].todos.some(({ completed }) => !completed)) {
    throw new Error(`Board: task "${taskId}" has open todos.`);
  }
  if (!target.taskIds.includes(taskId)) assertColumnCapacity(target, 1);

  state.columns.forEach((column) => {
    column.taskIds = column.taskIds.filter((id) => id !== taskId);
  });
  target.taskIds.splice(index, 0, taskId);
  return true;
}

/**
 * @param {BoardState} state
 * @param {string} taskId
 * @param {{ title?: unknown, category?: unknown, priority?: unknown, assignee?: unknown, dueDate?: unknown }} changes
 * @returns {BoardTask}
 */
export function updateTask(state, taskId, changes) {
  const current = state.tasks[taskId];
  if (!current) throw new Error(`Board: task "${taskId}" not found.`);

  const title = changes.title === undefined ? current.title : String(changes.title).trim();
  if (!title) throw new Error("Board: task title is required.");

  current.title = title;
  if (changes.category !== undefined) {
    current.category = String(changes.category).trim() || "Allgemein";
  }
  if (changes.priority !== undefined) {
    current.priority = normalizePriority(changes.priority);
  }
  if (changes.assignee !== undefined) {
    current.assignee = String(changes.assignee).trim().toUpperCase().slice(0, 2) || "TB";
  }
  if (changes.dueDate !== undefined) current.dueDate = normalizeDueDate(changes.dueDate);
  return current;
}

/**
 * @param {string | null} dueDate
 * @param {Date} [today]
 * @returns {"none" | "overdue" | "today" | "soon" | "upcoming"}
 */
export function getDueDateStatus(dueDate, today = new Date()) {
  if (!dueDate) return "none";
  const due = new Date(`${dueDate}T00:00:00`);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((due.getTime() - start.getTime()) / 86400000);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 3) return "soon";
  return "upcoming";
}

/** @param {BoardState} state @param {string} taskId @param {unknown} text */
export function addTaskTodo(state, taskId, text) {
  const task = state.tasks[taskId];
  if (!task) throw new Error(`Board: task "${taskId}" not found.`);
  const value = String(text ?? "").trim();
  if (!value) throw new Error("Board: todo text is required.");
  const todo = { id: nextTodoId(task.todos), text: value, completed: false };
  task.todos.push(todo);
  return todo;
}

/** @param {BoardState} state @param {string} taskId @param {string} todoId @param {{text?: unknown, completed?: boolean}} changes */
export function updateTaskTodo(state, taskId, todoId, changes) {
  const task = state.tasks[taskId];
  if (!task) throw new Error(`Board: task "${taskId}" not found.`);
  const todo = task.todos.find(({ id }) => id === todoId);
  if (!todo) throw new Error(`Board: todo "${todoId}" not found.`);
  if (changes.text !== undefined) {
    const text = String(changes.text).trim();
    if (!text) throw new Error("Board: todo text is required.");
    todo.text = text;
  }
  if (typeof changes.completed === "boolean") todo.completed = changes.completed;
  return todo;
}

/** @param {BoardState} state @param {string} taskId @param {string} todoId */
export function deleteTaskTodo(state, taskId, todoId) {
  const task = state.tasks[taskId];
  if (!task) throw new Error(`Board: task "${taskId}" not found.`);
  const index = task.todos.findIndex(({ id }) => id === todoId);
  if (index === -1) throw new Error(`Board: todo "${todoId}" not found.`);
  task.todos.splice(index, 1);
}

/**
 * @param {BoardState} state
 * @param {string} taskId
 */
export function deleteTask(state, taskId) {
  if (!state.tasks[taskId]) throw new Error(`Board: task "${taskId}" not found.`);
  state.columns.forEach((column) => {
    column.taskIds = column.taskIds.filter((id) => id !== taskId);
  });
  delete state.tasks[taskId];
}

/** @returns {BoardFilters} */
export function createEmptyFilters() {
  return { query: "", priority: "all", category: "all", assignee: "all" };
}

/**
 * @param {BoardTask} task
 * @param {BoardFilters} filters
 */
export function matchesTaskFilters(task, filters) {
  const query = filters.query.trim().toLowerCase();
  const searchable = `${task.id} ${task.title} ${task.category} ${task.assignee}`.toLowerCase();

  return (
    (!query || searchable.includes(query)) &&
    (filters.priority === "all" || task.priority === filters.priority) &&
    (filters.category === "all" || task.category === filters.category) &&
    (filters.assignee === "all" || task.assignee === filters.assignee)
  );
}

/** @param {BoardFilters} filters */
export function hasActiveFilters(filters) {
  return Boolean(
    filters.query.trim() ||
      filters.priority !== "all" ||
      filters.category !== "all" ||
      filters.assignee !== "all",
  );
}

/** @param {BoardFilters} filters */
export function countActiveFilters(filters) {
  return [
    filters.query.trim() !== "",
    filters.priority !== "all",
    filters.category !== "all",
    filters.assignee !== "all",
  ].filter(Boolean).length;
}

/**
 * Counts matching tasks for one filter dimension while deliberately ignoring
 * that dimension's current selection. All other active filters remain active.
 *
 * @param {BoardState} state
 * @param {"priority" | "category" | "assignee"} facet
 * @returns {Record<string, number>}
 */
export function countTasksByFacet(state, facet, activeFilters = createEmptyFilters()) {
  const filters = { ...activeFilters, [facet]: "all" };
  const matching = Object.values(state.tasks).filter((task) =>
    matchesTaskFilters(task, filters),
  );
  /** @type {Record<string, number>} */
  const counts = { all: matching.length };

  matching.forEach((task) => {
    const value = task[facet];
    counts[value] = (counts[value] ?? 0) + 1;
  });
  return counts;
}

/**
 * @param {BoardState} state
 * @param {string} taskId
 * @returns {UndoCommand}
 */
export function createMoveUndo(state, taskId) {
  const column = state.columns.find(({ taskIds }) => taskIds.includes(taskId));
  if (!column || !state.tasks[taskId]) {
    throw new Error(`Board: task "${taskId}" not found.`);
  }
  return { type: "move-task", taskId, columnId: column.id, index: column.taskIds.indexOf(taskId) };
}

/**
 * @param {BoardState} state
 * @param {string} taskId
 * @returns {UndoCommand}
 */
export function createDeleteUndo(state, taskId) {
  const column = state.columns.find(({ taskIds }) => taskIds.includes(taskId));
  const task = state.tasks[taskId];
  if (!column || !task) throw new Error(`Board: task "${taskId}" not found.`);
  return {
    type: "delete-task",
    task: structuredClone(task),
    columnId: column.id,
    index: column.taskIds.indexOf(taskId),
  };
}

/**
 * @param {BoardState} state
 * @param {UndoCommand} command
 */
export function applyUndo(state, command) {
  if (command.type === "move-task") {
    if (!state.tasks[command.taskId]) throw new Error(`Board: task "${command.taskId}" not found.`);
    const column = state.columns.find(({ id }) => id === command.columnId);
    if (!column) throw new Error(`Board: column "${command.columnId}" not found.`);
    state.columns.forEach((item) => {
      item.taskIds = item.taskIds.filter((id) => id !== command.taskId);
    });
    const index = Math.max(0, Math.min(command.index, column.taskIds.length));
    column.taskIds.splice(index, 0, command.taskId);
    return;
  }

  if (state.tasks[command.task.id]) {
    throw new Error(`Board: task "${command.task.id}" already exists.`);
  }
  const column = state.columns.find(({ id }) => id === command.columnId);
  if (!column) throw new Error(`Board: column "${command.columnId}" not found.`);

  state.tasks[command.task.id] = structuredClone(command.task);
  const index = Math.max(0, Math.min(command.index, column.taskIds.length));
  column.taskIds.splice(index, 0, command.task.id);
}

/**
 * @param {BoardState} state
 * @param {{ title: unknown, color?: unknown, kind?: unknown, limit?: unknown, limitMode?: unknown, allowedTargetIds?: unknown, requireCompletedTodos?: unknown }} input
 * @returns {BoardColumn}
 */
export function addColumn(state, input) {
  const values = normalizeColumnInput(state, input);
  const column = { id: nextColumnId(state.columns), ...values, taskIds: [] };
  state.columns.push(column);
  return column;
}

/**
 * @param {BoardState} state
 * @param {string} columnId
 * @param {{ title: unknown, color?: unknown, kind?: unknown, limit?: unknown, limitMode?: unknown, allowedTargetIds?: unknown, requireCompletedTodos?: unknown }} input
 * @returns {BoardColumn}
 */
export function updateColumn(state, columnId, input) {
  const column = state.columns.find(({ id }) => id === columnId);
  if (!column) throw new Error(`Board: column "${columnId}" not found.`);
  Object.assign(column, normalizeColumnInput(state, input, columnId));
  return column;
}

/** @param {BoardState} state @param {string} columnId @param {number} targetIndex */
export function moveColumn(state, columnId, targetIndex) {
  const index = state.columns.findIndex(({ id }) => id === columnId);
  if (index === -1) throw new Error(`Board: column "${columnId}" not found.`);
  const [column] = state.columns.splice(index, 1);
  const nextIndex = Math.max(0, Math.min(targetIndex, state.columns.length));
  state.columns.splice(nextIndex, 0, column);
}

/**
 * @param {BoardState} state
 * @param {string} columnId
 * @param {{ moveTasksTo?: string, deleteTasks?: boolean }} [options]
 */
export function deleteColumn(state, columnId, options = {}) {
  if (state.columns.length <= 1) throw new Error("Board: at least one column is required.");
  const index = state.columns.findIndex(({ id }) => id === columnId);
  if (index === -1) throw new Error(`Board: column "${columnId}" not found.`);
  const column = state.columns[index];

  if (column.taskIds.length) {
    if (options.deleteTasks) {
      column.taskIds.forEach((taskId) => delete state.tasks[taskId]);
    } else {
      const target = state.columns.find(({ id }) => id === options.moveTasksTo && id !== columnId);
      if (!target) throw new Error("Board: a valid target column is required.");
      assertColumnCapacity(target, column.taskIds.length);
      target.taskIds.push(...column.taskIds);
    }
  }
  state.columns.splice(index, 1);
  state.columns.forEach((item) => {
    if (item.allowedTargetIds) item.allowedTargetIds = item.allowedTargetIds.filter((id) => id !== columnId);
  });
}

/**
 * @param {BoardState} state
 * @param {{ title: unknown, color?: unknown, kind?: unknown, limit?: unknown, limitMode?: unknown, allowedTargetIds?: unknown, requireCompletedTodos?: unknown }} input
 * @param {string} [currentId]
 */
function normalizeColumnInput(state, input, currentId) {
  const title = String(input.title ?? "").trim();
  if (!title) throw new Error("Board: column title is required.");
  if (state.columns.some(({ id, title: existing }) => id !== currentId && existing.toLowerCase() === title.toLowerCase())) {
    throw new Error(`Board: column title "${title}" already exists.`);
  }
  const color = /^#[0-9a-f]{6}$/i.test(String(input.color)) ? String(input.color) : "#9297a0";
  const kind = ["backlog", "active", "review", "done"].includes(String(input.kind))
    ? /** @type {ColumnKind} */ (input.kind)
    : "active";
  const numericLimit = input.limit === "" || input.limit === null || input.limit === undefined
    ? null
    : Number(input.limit);
  if (numericLimit !== null && (!Number.isInteger(numericLimit) || numericLimit < 1)) {
    throw new Error("Board: column limit must be a positive integer.");
  }
  if (numericLimit === null && input.limitMode === "strict") {
    throw new Error("Board: a strict WIP limit requires a maximum task count.");
  }
  /** @type {LimitMode} */
  const limitMode = input.limitMode === "strict" ? "strict" : "warning";
  const allowedTargetIds = Array.isArray(input.allowedTargetIds)
    ? [...new Set(input.allowedTargetIds.map(String))].filter((id) => id !== currentId && state.columns.some((column) => column.id === id))
    : currentId
      ? state.columns.find((column) => column.id === currentId)?.allowedTargetIds ?? null
      : null;
  const requireCompletedTodos = input.requireCompletedTodos === undefined
    ? state.columns.find((column) => column.id === currentId)?.requireCompletedTodos ?? false
    : input.requireCompletedTodos === true || input.requireCompletedTodos === "true";
  return { title, color, kind, limit: numericLimit, limitMode, allowedTargetIds, requireCompletedTodos };
}

/** @param {BoardState} state @param {string} taskId @param {string} targetColumnId */
export function canMoveTaskTo(state, taskId, targetColumnId) {
  if (!state.tasks[taskId]) throw new Error(`Board: task "${taskId}" not found.`);
  const source = state.columns.find(({ taskIds }) => taskIds.includes(taskId));
  const target = state.columns.find(({ id }) => id === targetColumnId);
  if (!source) throw new Error(`Board: source column for task "${taskId}" not found.`);
  if (!target) throw new Error(`Board: column "${targetColumnId}" not found.`);
  if (source.id === target.id) return true;
  const transitionAllowed = source.allowedTargetIds === null || source.allowedTargetIds.includes(target.id);
  const todosReady = !target.requireCompletedTodos || !state.tasks[taskId].todos.some(({ completed }) => !completed);
  return transitionAllowed && todosReady;
}

/**
 * @param {BoardState} state
 * @param {string} columnId
 * @param {number} [incomingCount]
 * @param {string} [taskId]
 */
export function canAcceptTasks(state, columnId, incomingCount = 1, taskId) {
  const column = state.columns.find(({ id }) => id === columnId);
  if (!column) throw new Error(`Board: column "${columnId}" not found.`);
  if (taskId && column.taskIds.includes(taskId)) return true;
  if (column.limit === null || column.limitMode !== "strict") return true;
  return column.taskIds.length + incomingCount <= column.limit;
}

/** @param {BoardColumn} column @param {number} incomingCount */
function assertColumnCapacity(column, incomingCount) {
  if (
    column.limit !== null &&
    column.limitMode === "strict" &&
    column.taskIds.length + incomingCount > column.limit
  ) {
    throw new Error(`Board: column "${column.title}" has reached its WIP limit.`);
  }
}

/** @param {BoardColumn[]} columns */
function nextColumnId(columns) {
  let number = 1;
  while (columns.some(({ id }) => id === `stage-${number}`)) number += 1;
  return `stage-${number}`;
}

/**
 * @param {string} id
 * @param {string} title
 * @param {string} category
 * @param {"low" | "medium" | "high"} priority
 * @param {string} assignee
 * @param {number} comments
 * @param {string | null} [dueDate]
 * @returns {BoardTask}
 */
function task(id, title, category, priority, assignee, comments, dueDate = null) {
  return { id, title, category, priority, assignee, comments, todos: [], dueDate, ownerId: null, memberIds: [] };
}

/** @param {unknown} value */
function normalizeDueDate(value) {
  const date = String(value ?? "").trim();
  if (!date) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const parsed = new Date(`${date}T00:00:00`);
  if (!match || Number.isNaN(parsed.getTime()) || parsed.getFullYear() !== Number(match[1]) || parsed.getMonth() + 1 !== Number(match[2]) || parsed.getDate() !== Number(match[3])) {
    throw new Error("Board: due date must use YYYY-MM-DD.");
  }
  return date;
}

/** @param {TaskTodo[]} todos */
function nextTodoId(todos) {
  let number = 1;
  while (todos.some(({ id }) => id === `todo-${number}`)) number += 1;
  return `todo-${number}`;
}

/**
 * @param {Record<string, BoardTask>} tasks
 * @returns {string}
 */
function nextTaskId(tasks) {
  const highest = Object.keys(tasks).reduce((max, id) => {
    const value = Number(id.replace(/^KAN-/, ""));
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
  return `KAN-${String(highest + 1).padStart(2, "0")}`;
}

/**
 * @param {unknown} value
 * @returns {"low" | "medium" | "high"}
 */
function normalizePriority(value) {
  return value === "low" || value === "high" || value === "medium"
    ? value
    : "medium";
}
