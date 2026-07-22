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
