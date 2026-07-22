/**
 * @typedef {ReturnType<typeof import("../../board/actions/board.actions.js").createBoardActions>
 *   & ReturnType<typeof import("../../board/actions/user.actions.js").createUserActions>
 *   & ReturnType<typeof import("../../board/actions/stage.actions.js").createStageActions>
 *   & ReturnType<typeof import("../../board/actions/task.actions.js").createTaskActions>
 *   & ReturnType<typeof import("../../board/actions/drag-drop.actions.js").createDragDropActions>
 *   & ReturnType<typeof import("../../board/actions/filter.actions.js").createFilterActions>
 *   & ReturnType<typeof import("../../board/actions/transfer.actions.js").createTransferActions>} BoardActions
 */
/** @typedef {{id: string, name: string, initials: string, preferences: {theme: string}}} UserView */

export {};
