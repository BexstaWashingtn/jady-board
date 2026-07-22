import {
  BOARD_SCHEMA_VERSION,
  BOARD_STORAGE_KEY,
  LEGACY_BOARD_STORAGE_KEY,
  createInitialBoardState,
} from "./board.state.js";

export const BOARD_BACKUP_STORAGE_KEY = `${BOARD_STORAGE_KEY}.backup`;

/** @typedef {{ id: string, name: string, initials: string, preferences: {theme: "light" | "dark" | "system"} }} BoardUser */
/** @typedef {{ activeBoardId: string, boards: Record<string, import("./board.state.js").BoardState>, activeUserId: string, users: Record<string, BoardUser> }} BoardWorkspace */

/** @returns {BoardWorkspace} */
export function loadWorkspace() {
  const current = safeGetItem(BOARD_STORAGE_KEY);
  const legacy = current === null ? safeGetItem(LEGACY_BOARD_STORAGE_KEY) : null;
  const stored = current ?? legacy;
  if (!stored) return createDefaultWorkspace();

  try {
    const saved = JSON.parse(stored);
    const workspace = normalizeWorkspace(saved);
    const canonical = serializeWorkspace(workspace);
    const needsRepair = saved?.version !== BOARD_SCHEMA_VERSION || canonical !== stored;

    if (needsRepair) {
      backupOriginal(stored);
      persistWorkspace(workspace);
    }
    if (legacy !== null && persistWorkspace(workspace)) {
      localStorage.removeItem(LEGACY_BOARD_STORAGE_KEY);
    }
    return workspace;
  } catch {
    backupOriginal(stored);
    return createDefaultWorkspace();
  }
}

/** @param {unknown} saved @returns {BoardWorkspace} */
export function normalizeWorkspace(saved) {
  if (!isRecord(saved)) throw new Error("Board: workspace must be an object.");

  // Versions newer than this client must not be silently downgraded.
  if (Number.isInteger(saved.version) && Number(saved.version) > BOARD_SCHEMA_VERSION) {
    throw new Error("Board: workspace schema is newer than this application.");
  }

  const users = normalizeUsers(saved.users);
  const activeUserId = users[String(saved.activeUserId)]
    ? String(saved.activeUserId)
    : Object.keys(users)[0];
  /** @type {Record<string, import("./board.state.js").BoardState>} */
  const boards = {};

  if (isRecord(saved.boards)) {
    for (const [id, value] of Object.entries(saved.boards)) {
      if (id.trim() && isRecord(value)) boards[id] = migrateBoard(value);
    }
  } else if (looksLikeBoard(saved)) {
    boards["board-1"] = migrateBoard(saved);
  }
  if (!Object.keys(boards).length) boards["board-1"] = createInitialBoardState();

  for (const board of Object.values(boards)) repairUserReferences(board, users, activeUserId);
  const requestedBoardId = String(saved.activeBoardId ?? "");
  const activeBoardId = boards[requestedBoardId] ? requestedBoardId : Object.keys(boards)[0];
  return { activeBoardId, boards, activeUserId, users };
}

/** @param {unknown} value @returns {import("./board.state.js").BoardState} */
export function migrateBoard(value) {
  if (!isRecord(value)) return createInitialBoardState();
  const defaults = createInitialBoardState();
  const projectValue = isRecord(value.project) ? value.project : {};
  const project = {
    name: nonEmptyString(projectValue.name, defaults.project.name),
    path: nonEmptyString(projectValue.path, defaults.project.path),
    description: stringValue(projectValue.description, ""),
    ownerId: stringValue(projectValue.ownerId, "user-1"),
    memberIds: stringArray(projectValue.memberIds),
  };

  /** @type {Record<string, import("./board.state.js").BoardTask>} */
  const tasks = {};
  if (isRecord(value.tasks)) {
    for (const [id, taskValue] of Object.entries(value.tasks)) {
      const task = normalizeTask(id, taskValue);
      if (task) tasks[id] = task;
    }
  }

  /** @type {import("./board.state.js").BoardColumn[]} */
  const columns = [];
  /** @type {Set<string>} */
  const columnIds = new Set();
  if (Array.isArray(value.columns)) {
    value.columns.forEach((columnValue, index) => {
      const column = migrateColumn(columnValue, index);
      if (column && !columnIds.has(column.id)) {
        columnIds.add(column.id);
        columns.push(column);
      }
    });
  }
  if (!columns.length) {
    columns.push({ ...defaults.columns[0], taskIds: [] });
    columnIds.add(columns[0].id);
  }

  /** @type {Set<string>} */
  const assignedTasks = new Set();
  for (const column of columns) {
    column.taskIds = column.taskIds.filter((id) => tasks[id] && !assignedTasks.has(id) && assignedTasks.add(id));
    if (column.allowedTargetIds) {
      column.allowedTargetIds = column.allowedTargetIds.filter((id) => id !== column.id && columnIds.has(id));
    }
  }
  for (const taskId of Object.keys(tasks)) {
    if (!assignedTasks.has(taskId)) columns[0].taskIds.push(taskId);
  }
  return { project, columns, tasks };
}

/** @param {unknown} value @param {number} index @returns {import("./board.state.js").BoardColumn | null} */
function migrateColumn(value, index) {
  if (!isRecord(value)) return null;
  const id = nonEmptyString(value.id, "");
  const title = nonEmptyString(value.title, "");
  if (!id || !title) return null;
  const colors = ["#9297a0", "#e5a84b", "#8b7cf6", "#57b894"];
  /** @type {string[]} */
  const kinds = ["backlog", "active", "review", "done"];
  const limit = Number.isInteger(value.limit) && Number(value.limit) > 0 ? Number(value.limit) : null;
  return {
    id,
    title,
    color: /^#[0-9a-f]{6}$/i.test(String(value.color)) ? String(value.color) : colors[index % colors.length],
    kind: kinds.includes(String(value.kind)) ? /** @type {import("./board.state.js").ColumnKind} */ (value.kind) : "active",
    limit,
    limitMode: limit !== null && value.limitMode === "strict" ? "strict" : "warning",
    allowedTargetIds: Array.isArray(value.allowedTargetIds) ? stringArray(value.allowedTargetIds) : null,
    requireCompletedTodos: value.requireCompletedTodos === true,
    taskIds: stringArray(value.taskIds),
  };
}

/** @param {string} id @param {unknown} value @returns {import("./board.state.js").BoardTask | null} */
function normalizeTask(id, value) {
  if (!id.trim() || !isRecord(value)) return null;
  const title = nonEmptyString(value.title, "");
  if (!title) return null;
  const priority = ["low", "medium", "high"].includes(String(value.priority)) ? value.priority : "medium";
  /** @type {import("./board.state.js").TaskTodo[]} */
  const todos = [];
  const todoIds = new Set();
  if (Array.isArray(value.todos)) {
    value.todos.forEach((todoValue, index) => {
      if (!isRecord(todoValue)) return;
      const text = nonEmptyString(todoValue.text, "");
      if (!text) return;
      let todoId = nonEmptyString(todoValue.id, `todo-${index + 1}`);
      while (todoIds.has(todoId)) todoId = `todo-${index + 1}-${todoIds.size + 1}`;
      todoIds.add(todoId);
      todos.push({ id: todoId, text, completed: todoValue.completed === true });
    });
  }
  return {
    id,
    title,
    category: nonEmptyString(value.category, "Allgemein"),
    priority: /** @type {"low" | "medium" | "high"} */ (priority),
    assignee: nonEmptyString(value.assignee, "TB").toUpperCase().slice(0, 2),
    comments: Number.isInteger(value.comments) && Number(value.comments) >= 0 ? Number(value.comments) : 0,
    todos,
    dueDate: validDate(value.dueDate) ? String(value.dueDate) : null,
    ownerId: typeof value.ownerId === "string" ? value.ownerId : null,
    memberIds: stringArray(value.memberIds),
  };
}

/** @param {unknown} value @returns {Record<string, BoardUser>} */
function normalizeUsers(value) {
  /** @type {Record<string, BoardUser>} */
  const users = {};
  if (isRecord(value)) {
    for (const [id, userValue] of Object.entries(value)) {
      if (!id.trim() || !isRecord(userValue)) continue;
      const name = nonEmptyString(userValue.name, "");
      if (!name) continue;
      const initials = nonEmptyString(userValue.initials, name.split(/\s+/).map((part) => part[0]).join(""));
      const preferenceValue = isRecord(userValue.preferences) ? userValue.preferences.theme : null;
      const theme = ["light", "dark", "system"].includes(String(preferenceValue)) ? preferenceValue : "system";
      users[id] = { id, name, initials: initials.toUpperCase().slice(0, 2), preferences: { theme: /** @type {"light" | "dark" | "system"} */ (theme) } };
    }
  }
  if (!Object.keys(users).length) {
    const user = defaultUser();
    users[user.id] = user;
  }
  return users;
}

/** @param {import("./board.state.js").BoardState} board @param {Record<string, BoardUser>} users @param {string} fallbackUserId */
function repairUserReferences(board, users, fallbackUserId) {
  const ownerId = users[board.project.ownerId] ? board.project.ownerId : fallbackUserId;
  board.project.ownerId = ownerId;
  board.project.memberIds = [...new Set([...board.project.memberIds.filter((id) => users[id]), ownerId])];
  const members = new Set(board.project.memberIds);
  Object.values(board.tasks).forEach((task) => {
    if (task.ownerId && !members.has(task.ownerId)) task.ownerId = null;
    task.memberIds = [...new Set(task.memberIds.filter((id) => members.has(id) && id !== task.ownerId))];
  });
}

/** @param {BoardWorkspace} workspace @returns {boolean} */
export function persistWorkspace(workspace) {
  try {
    localStorage.setItem(BOARD_STORAGE_KEY, serializeWorkspace(workspace));
    return true;
  } catch {
    return false;
  }
}

/** @param {BoardWorkspace} workspace */
function serializeWorkspace(workspace) {
  const boards = Object.fromEntries(Object.entries(workspace.boards).map(([id, state]) => [id, { project: state.project, columns: state.columns, tasks: state.tasks }]));
  return JSON.stringify({ version: BOARD_SCHEMA_VERSION, activeBoardId: workspace.activeBoardId, boards, activeUserId: workspace.activeUserId, users: workspace.users });
}

/** @param {string} original */
function backupOriginal(original) {
  try {
    localStorage.setItem(BOARD_BACKUP_STORAGE_KEY, original);
  } catch {
    // A backup is best-effort when browser storage itself is unavailable.
  }
}

/** @param {string} key */
function safeGetItem(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

/** @param {unknown} value @returns {value is Record<string, any>} */
function isRecord(value) { return typeof value === "object" && value !== null && !Array.isArray(value); }
/** @param {unknown} value */
function stringArray(value) { return Array.isArray(value) ? [...new Set(value.filter((item) => typeof item === "string" && item.trim()).map(String))] : []; }
/** @param {unknown} value @param {string} fallback */
function stringValue(value, fallback) { return typeof value === "string" ? value : fallback; }
/** @param {unknown} value @param {string} fallback */
function nonEmptyString(value, fallback) { return typeof value === "string" && value.trim() ? value.trim() : fallback; }
/** @param {unknown} value */
function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && value === `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
/** @param {Record<string, any>} value */
function looksLikeBoard(value) { return "project" in value || "columns" in value || "tasks" in value; }

/** @returns {BoardUser} */
function defaultUser() { return { id: "user-1", name: "Thomas", initials: "TB", preferences: { theme: "system" } }; }

/** @returns {BoardWorkspace} */
function createDefaultWorkspace() {
  const user = defaultUser();
  return { activeBoardId: "board-1", boards: { "board-1": createInitialBoardState() }, activeUserId: user.id, users: { [user.id]: user } };
}
