import { canAcceptTasks, canMoveTaskTo, createMoveUndo, moveTask } from "../board.state.js";
import { clearDropTargets, updateDropPosition } from "../board.dom.js";

/** @param {import("./action-context.js").BoardActionContext} context */
export function createDragDropActions(context) {
  return {
    /** @param {DragEvent} event @param {string} taskId */
    startTaskDrag(event, taskId) {
      context.viewState().draggingTaskId = taskId;
      event.dataTransfer?.setData("text/plain", taskId);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
      if (event.currentTarget instanceof HTMLElement) event.currentTarget.classList.add("task-card--dragging");
    },
    /** @param {DragEvent} event */
    endTaskDrag(event) {
      context.viewState().draggingTaskId = null;
      context.interaction.taskOpenUntil = Date.now() + 180;
      if (event.currentTarget instanceof HTMLElement) event.currentTarget.classList.remove("task-card--dragging");
      clearDropTargets();
    },
    /** @param {DragEvent} event @param {string} columnId */
    dragTaskOverColumn(event, columnId) {
      event.preventDefault();
      const state = context.state();
      const taskId = context.viewState().draggingTaskId;
      const transitionAllowed = !taskId || canMoveTaskTo(state, taskId, columnId);
      if (!transitionAllowed || !canAcceptTasks(state, columnId, 1, taskId ?? undefined)) {
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
        if (event.currentTarget instanceof HTMLElement) {
          event.currentTarget.classList.add("kanban-column--drop-rejected");
          event.currentTarget.dataset.dropRejection = taskId && !transitionAllowed ? context.moveRejectionLabel(taskId, columnId) : "WIP-Limit erreicht";
        }
        return;
      }
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      if (event.currentTarget instanceof HTMLElement) {
        event.currentTarget.classList.add("kanban-column--drop-target");
        updateDropPosition(event.currentTarget, event.clientY);
      }
    },
    /** @param {DragEvent} event */
    leaveTaskColumn(event) {
      if (!(event.currentTarget instanceof HTMLElement)) return;
      const next = event.relatedTarget;
      if (!(next instanceof Node) || !event.currentTarget.contains(next)) event.currentTarget.classList.remove("kanban-column--drop-target");
    },
    /** @param {DragEvent} event @param {string} columnId */
    dropTask(event, columnId) {
      event.preventDefault();
      const state = context.state();
      const viewState = context.viewState();
      const taskId = event.dataTransfer?.getData("text/plain") || viewState.draggingTaskId;
      const column = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
      const targetIndex = Number(column?.dataset.dropIndex);
      clearDropTargets();
      if (!taskId || !state.tasks[taskId]) return;
      if (!canMoveTaskTo(state, taskId, columnId)) { context.registerNotice(context.moveRejectionMessage(taskId, columnId)); return; }
      if (!canAcceptTasks(state, columnId, 1, taskId)) return;
      const undo = createMoveUndo(state, taskId);
      const moved = moveTask(state, taskId, columnId, Number.isInteger(targetIndex) ? targetIndex : undefined);
      if (!moved) {
        viewState.draggingTaskId = null;
        context.interaction.taskOpenUntil = Date.now() + 180;
        return;
      }
      context.registerUndo(undo, `${taskId} nach „${context.columnTitle(columnId)}“ verschoben.`);
      viewState.draggingTaskId = null;
      context.interaction.taskOpenUntil = Date.now() + 180;
      context.saveState();
      context.render();
    },
  };
}
