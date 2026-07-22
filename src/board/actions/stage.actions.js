import { addColumn, deleteColumn, moveColumn, updateColumn } from "../board.state.js";

/** @param {import("./action-context.js").BoardActionContext} context */
export function createStageActions(context) {
  return {
    openStageConfig() {
      if (!context.isBoardOwner()) return;
      const viewState = context.viewState();
      viewState.stageConfigOpen = true;
      viewState.boardConfigOpen = false;
      viewState.stageEditor = null;
      viewState.openColumnMenuId = null;
      context.render();
    },
    closeStageConfig() { const viewState = context.viewState(); viewState.stageConfigOpen = false; viewState.stageEditor = null; context.render(); },
    createStage() { if (!context.isBoardOwner()) return; context.viewState().stageEditor = { mode: "create", columnId: null }; context.render(); },
    /** @param {string} columnId */
    editStage(columnId) { if (!context.isBoardOwner()) return; context.viewState().stageEditor = { mode: "edit", columnId }; context.render(); context.scrollToStageEditor(); },
    /** @param {string} columnId */
    requestDeleteStage(columnId) { if (!context.isBoardOwner()) return; context.viewState().stageEditor = { mode: "delete", columnId }; context.render(); },
    cancelStageEditor() { context.viewState().stageEditor = null; context.render(); },

    /** @param {string} columnId */
    toggleColumnMenu(columnId) {
      if (!context.isBoardOwner()) return;
      const viewState = context.viewState();
      viewState.openColumnMenuId = viewState.openColumnMenuId === columnId ? null : columnId;
      context.render();
      if (viewState.openColumnMenuId) queueMicrotask(() => {
        const firstItem = document.querySelector(".column-context-menu button");
        if (firstItem instanceof HTMLButtonElement) firstItem.focus();
      });
    },
    closeColumnMenu() { context.viewState().openColumnMenuId = null; context.render(); },

    /** @param {string} columnId */
    openStageEditorFromMenu(columnId) {
      if (!context.isBoardOwner()) return;
      const viewState = context.viewState();
      viewState.openColumnMenuId = null;
      viewState.boardConfigOpen = false;
      viewState.stageConfigOpen = true;
      viewState.stageEditor = { mode: "edit", columnId };
      context.render();
      context.scrollToStageEditor();
    },
    /** @param {string} columnId */
    openStageDeleteFromMenu(columnId) {
      if (!context.isBoardOwner()) return;
      const viewState = context.viewState();
      viewState.openColumnMenuId = null;
      viewState.boardConfigOpen = false;
      viewState.stageConfigOpen = true;
      viewState.stageEditor = { mode: "delete", columnId };
      context.render();
    },

    /** @param {Event} event */
    submitStage(event) {
      event.preventDefault();
      if (!context.isBoardOwner() || !(event.currentTarget instanceof HTMLFormElement)) return;
      const data = new FormData(event.currentTarget);
      const columnId = String(data.get("columnId") ?? "");
      const input = { title: data.get("title"), color: data.get("color"), kind: data.get("kind"), limit: data.get("limit"), limitMode: data.get("limitMode"), allowedTargetIds: data.getAll("allowedTargetIds"), requireCompletedTodos: data.get("requireCompletedTodos") === "true" };
      if (columnId) updateColumn(context.state(), columnId, input);
      else addColumn(context.state(), input);
      context.viewState().stageEditor = null;
      context.saveState();
      context.render();
    },
    /** @param {string} columnId @param {number} direction */
    moveStage(columnId, direction) {
      if (!context.isBoardOwner()) return;
      const state = context.state();
      moveColumn(state, columnId, state.columns.findIndex(({ id }) => id === columnId) + direction);
      context.viewState().openColumnMenuId = null;
      context.saveState();
      context.render();
    },
    /** @param {Event} event */
    confirmDeleteStage(event) {
      event.preventDefault();
      if (!context.isBoardOwner() || !(event.currentTarget instanceof HTMLFormElement)) return;
      const data = new FormData(event.currentTarget);
      const columnId = String(data.get("columnId") ?? "");
      const state = context.state();
      deleteColumn(state, columnId, { moveTasksTo: String(data.get("moveTasksTo") ?? "") });
      const viewState = context.viewState();
      if (viewState.createTaskColumnId === columnId) viewState.createTaskColumnId = state.columns[0].id;
      viewState.stageEditor = null;
      context.saveState();
      context.render();
    },
  };
}
