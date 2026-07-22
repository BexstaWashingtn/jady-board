import {
  BOARD_SCHEMA_VERSION,
  BOARD_STORAGE_KEY,
  LEGACY_BOARD_STORAGE_KEY,
  createInitialBoardState,
} from "./board.state.js";

/** @typedef {{ id: string, name: string, initials: string, preferences: {theme: "light" | "dark" | "system"} }} BoardUser */
/** @typedef {{ activeBoardId: string, boards: Record<string, import("./board.state.js").BoardState>, activeUserId: string, users: Record<string, BoardUser> }} BoardWorkspace */

/** @returns {BoardWorkspace} */
export function loadWorkspace() {
  try {
    const current = localStorage.getItem(BOARD_STORAGE_KEY);
    const legacy = current === null ? localStorage.getItem(LEGACY_BOARD_STORAGE_KEY) : null;
    const stored = current ?? legacy;
    if (!stored) return createDefaultWorkspace();
    const saved = JSON.parse(stored);
    if (saved.boards && saved.activeBoardId && saved.boards[saved.activeBoardId]) {
      /** @type {Record<string, import("./board.state.js").BoardState>} */
      const boards = {};
      for (const [id, board] of Object.entries(saved.boards)) boards[id] = migrateBoard(board);
      const fallback = defaultUser();
      const users = saved.users && typeof saved.users === "object" ? saved.users : { [fallback.id]: fallback };
      Object.values(users).forEach((user) => {
        if (!user.preferences || !["light", "dark", "system"].includes(user.preferences.theme)) user.preferences = { theme: "system" };
      });
      const activeUserId = users[saved.activeUserId] ? saved.activeUserId : Object.keys(users)[0];
      const workspace = { activeBoardId: saved.activeBoardId, boards, activeUserId, users };
      migrateLegacyStorage(workspace, legacy !== null);
      return workspace;
    }
    const user = defaultUser();
    const workspace = { activeBoardId: "board-1", boards: { "board-1": migrateBoard(saved) }, activeUserId: user.id, users: { [user.id]: user } };
    migrateLegacyStorage(workspace, legacy !== null);
    return workspace;
  } catch {
    return createDefaultWorkspace();
  }
}

/** @param {any} state @returns {import("./board.state.js").BoardState} */
export function migrateBoard(state) {
  const initial = createInitialBoardState();
  initial.project = state.project ?? initial.project;
  initial.project.ownerId = state.project?.ownerId ?? "user-1";
  initial.project.memberIds = Array.isArray(state.project?.memberIds) ? state.project.memberIds : [initial.project.ownerId];
  initial.columns = state.columns ?? initial.columns;
  initial.tasks = state.tasks ?? initial.tasks;
  Object.values(initial.tasks).forEach((task) => {
    task.todos = Array.isArray(task.todos) ? task.todos : [];
    task.dueDate = typeof task.dueDate === "string" ? task.dueDate : null;
    task.ownerId = typeof task.ownerId === "string" ? task.ownerId : null;
    task.memberIds = Array.isArray(task.memberIds) ? task.memberIds : [];
  });
  initial.columns = initial.columns.map((column, index) => migrateColumn(column, index));
  return initial;
}

/** @param {Partial<import("./board.state.js").BoardColumn> & { id: string, title: string, taskIds: string[] }} column @param {number} index */
function migrateColumn(column, index) {
  const defaults = ["#9297a0", "#e5a84b", "#8b7cf6", "#57b894"];
  const kinds = ["backlog", "active", "review", "done"];
  return {
    ...column,
    color: column.color ?? defaults[index % defaults.length],
    kind: column.kind ?? /** @type {import("./board.state.js").ColumnKind} */ (kinds[Math.min(index, kinds.length - 1)]),
    limit: column.limit ?? null,
    limitMode: column.limitMode ?? "warning",
    allowedTargetIds: Array.isArray(column.allowedTargetIds) ? column.allowedTargetIds : null,
    requireCompletedTodos: column.requireCompletedTodos === true,
  };
}

/** @param {BoardWorkspace} workspace @returns {boolean} */
export function persistWorkspace(workspace) {
  try {
    const boards = Object.fromEntries(Object.entries(workspace.boards).map(([id, state]) => [id, { project: state.project, columns: state.columns, tasks: state.tasks }]));
    localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify({ version: BOARD_SCHEMA_VERSION, activeBoardId: workspace.activeBoardId, boards, activeUserId: workspace.activeUserId, users: workspace.users }));
    return true;
  } catch {
    // The board remains usable when storage is unavailable.
    return false;
  }
}

/** @param {BoardWorkspace} workspace @param {boolean} loadedFromLegacyKey */
function migrateLegacyStorage(workspace, loadedFromLegacyKey) {
  if (!loadedFromLegacyKey) return;
  if (persistWorkspace(workspace)) localStorage.removeItem(LEGACY_BOARD_STORAGE_KEY);
}

/** @returns {BoardUser} */
function defaultUser() {
  return { id: "user-1", name: "Thomas", initials: "TB", preferences: { theme: "system" } };
}

/** @returns {BoardWorkspace} */
function createDefaultWorkspace() {
  const user = defaultUser();
  return { activeBoardId: "board-1", boards: { "board-1": createInitialBoardState() }, activeUserId: user.id, users: { [user.id]: user } };
}
