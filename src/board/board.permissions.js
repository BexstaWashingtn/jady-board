/**
 * Central permission rules for board administration.
 * Keeping these checks outside the UI prevents views and controllers from
 * developing subtly different interpretations of a role.
 *
 * @param {import("./board.state.js").BoardState} state
 * @param {string} userId
 */
export function canConfigureBoard(state, userId) {
  return Boolean(userId) && state.project.ownerId === userId;
}

/**
 * @param {import("./board.state.js").BoardState} state
 * @param {string} userId
 */
export function isBoardMember(state, userId) {
  return Boolean(userId) && state.project.memberIds.includes(userId);
}

/** @param {import("./board.state.js").BoardState} state @param {string} taskId */
function taskById(state, taskId) {
  return state.tasks[taskId] ?? null;
}

/** @param {import("./board.state.js").BoardState} state @param {string} userId */
export function canCreateTask(state, userId) {
  return isBoardMember(state, userId);
}

/** @param {import("./board.state.js").BoardState} state @param {string} taskId @param {string} userId */
export function canViewTask(state, taskId, userId) {
  return Boolean(taskById(state, taskId)) && isBoardMember(state, userId);
}

/** @param {import("./board.state.js").BoardState} state @param {string} taskId @param {string} userId */
export function canWorkOnTask(state, taskId, userId) {
  const task = taskById(state, taskId);
  return Boolean(task) && (canConfigureBoard(state, userId) || task.assigneeId === userId);
}

/** @param {import("./board.state.js").BoardState} state @param {string} taskId @param {string} userId */
export function canEditTask(state, taskId, userId) {
  return canWorkOnTask(state, taskId, userId);
}

/** @param {import("./board.state.js").BoardState} state @param {string} taskId @param {string} userId */
export function canAssignTask(state, taskId, userId) {
  return Boolean(taskById(state, taskId)) && canConfigureBoard(state, userId);
}

/** @param {import("./board.state.js").BoardState} state @param {string} taskId @param {string} userId */
export function canClaimTask(state, taskId, userId) {
  const task = taskById(state, taskId);
  return Boolean(task && !task.assigneeId) && isBoardMember(state, userId);
}

/** @param {import("./board.state.js").BoardState} state @param {string} taskId @param {string} userId */
export function canReleaseTask(state, taskId, userId) {
  const task = taskById(state, taskId);
  return Boolean(task?.assigneeId) && (canConfigureBoard(state, userId) || task.assigneeId === userId);
}

/** @param {import("./board.state.js").BoardState} state @param {string} taskId @param {string} userId */
export function canDeleteTask(state, taskId, userId) {
  return Boolean(taskById(state, taskId)) && canConfigureBoard(state, userId);
}
