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
      viewState.stageConfigOpen = false;
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
      viewState.stageConfigOpen = false;
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
      const previous = columnId ? structuredClone(context.state().columns.find(({ id }) => id === columnId)) : null;
      const stage = columnId ? updateColumn(context.state(), columnId, input) : addColumn(context.state(), input);
      const finish = () => {
        context.viewState().stageEditor = null;
        context.saveState();
        context.render();
      };
      if (columnId && context.updateStageRemote) {
        return context.updateStageRemote(context.workspace.activeBoardId, stage)
          .then((saved) => { Object.assign(stage, saved); finish(); })
          .catch((error) => {
            const index = context.state().columns.findIndex(({ id }) => id === columnId);
            if (previous && index >= 0) context.state().columns[index] = previous;
            throw error;
          });
      }
      if (!columnId && context.createStageRemote) {
        return context.createStageRemote(context.workspace.activeBoardId, stage)
          .then((saved) => { Object.assign(stage, saved); finish(); })
          .catch((error) => {
            const index = context.state().columns.indexOf(stage);
            if (index >= 0) context.state().columns.splice(index, 1);
            throw error;
          });
      }
      finish();
    },
    /** @param {string} columnId @param {number} direction */
    moveStage(columnId, direction) {
      if (!context.isBoardOwner()) return;
      const state = context.state();
      const previous = [...state.columns];
      const stage = state.columns.find(({ id }) => id === columnId);
      const targetIndex = Math.max(0, Math.min(state.columns.findIndex(({ id }) => id === columnId) + direction, state.columns.length - 1));
      moveColumn(state, columnId, targetIndex);
      context.viewState().openColumnMenuId = null;
      if (stage && context.moveStageRemote) {
        context.render();
        return context.moveStageRemote(context.workspace.activeBoardId, stage, targetIndex)
          .then((saved) => { stage.version = saved.version; context.saveState(); context.render(); })
          .catch((error) => { state.columns.splice(0, state.columns.length, ...previous); context.render(); throw error; });
      }
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
      const previous = structuredClone(state);
      const stage = state.columns.find(({ id }) => id === columnId);
      const moveTasksTo = String(data.get("moveTasksTo") ?? "") || null;
      deleteColumn(state, columnId, { moveTasksTo: moveTasksTo ?? "" });
      const viewState = context.viewState();
      if (viewState.createTaskColumnId === columnId) viewState.createTaskColumnId = state.columns[0].id;
      viewState.stageEditor = null;
      if (stage && context.deleteStageRemote) {
        context.render();
        return context.deleteStageRemote(context.workspace.activeBoardId, stage, moveTasksTo)
          .then(() => {
            stage.taskIds.forEach((taskId) => {
              const task = state.tasks[taskId];
              if (task && Number.isInteger(task.version)) task.version = Number(task.version) + 1;
            });
            context.saveState(); context.render();
          })
          .catch((error) => { context.setState(previous); context.saveState(); context.render(); throw error; });
      }
      context.saveState();
      context.render();
    },
  };
}
