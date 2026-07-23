import { createEmptyFilters } from "./board.state.js";

/** @typedef {{ mode: "create" | "edit" | "delete", columnId: string | null } | null} StageEditor */
/** @typedef {{ message: string, command: import("./board.state.js").UndoCommand } | null} UndoState */
/** @typedef {{ createTaskOpen: boolean, createTaskColumnId: string, selectedTaskId: string | null, taskEditOpen: boolean, draggingTaskId: string | null, filters: import("./board.state.js").BoardFilters, undo: UndoState, notice: string | null, boardConfigOpen: boolean, stageConfigOpen: boolean, stageEditor: StageEditor, openColumnMenuId: string | null }} BoardViewState */

/** @param {string} [initialColumnId] @returns {BoardViewState} */
export function createBoardViewState(initialColumnId = "backlog") {
  return {
    createTaskOpen: false, createTaskColumnId: initialColumnId,
    selectedTaskId: null, taskEditOpen: false, draggingTaskId: null,
    filters: createEmptyFilters(), undo: null, notice: null,
    boardConfigOpen: false, stageConfigOpen: false,
    stageEditor: null, openColumnMenuId: null,
  };
}
