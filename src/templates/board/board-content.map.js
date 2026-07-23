import { createKanbanBoard } from "./kanban.map.js";
import { createTaskList } from "./list.map.js";

/**
 * @param {import("../../board/board.state.js").BoardState} state
 * @param {import("../../board/board.view-state.js").BoardViewState} viewState
 * @param {import("./board.types.js").BoardActions} actions
 * @param {import("./board.types.js").UserView[]} users
 * @param {boolean} canConfigure
 * @param {string} activeUserId
 * @param {boolean} canCreate
 * @returns {import("../../core/JaDyDoCo.js").JaDyNode}
 */
export function createBoardContent(state, viewState, actions, users, canConfigure, activeUserId, canCreate) {
  return viewState.viewMode === "list"
    ? createTaskList(state, viewState, actions, users)
    : createKanbanBoard(state, viewState, actions, users, canConfigure, activeUserId, canCreate);
}
