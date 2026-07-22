import {
  addTask, addTaskTodo, applyUndo, canAcceptTasks, canMoveTaskTo,
  createDeleteUndo, createInitialBoardState, createMoveUndo,
  deleteTask as removeTask, deleteTaskTodo, moveTask, updateTask, updateTaskTodo,
} from "../board.state.js";
import { createBoardViewState } from "../board.view-state.js";

/** @param {import("./action-context.js").BoardActionContext} context */
export function createTaskActions(context) {
  return {
    /** @param {string} [columnId] */
    openCreateTask(columnId) {
      const state = context.state();
      const requestedColumn = state.columns.find((column) => column.id === columnId);
      const requested = requestedColumn && canAcceptTasks(state, requestedColumn.id)
        ? requestedColumn.id
        : null;
      const targetColumnId = requested ?? state.columns.find((column) => canAcceptTasks(state, column.id))?.id;
      if (!targetColumnId) return;
      const viewState = context.viewState();
      viewState.openColumnMenuId = null;
      viewState.createTaskOpen = true;
      viewState.createTaskColumnId = targetColumnId;
      context.render();
    },
    closeCreateTask() { context.viewState().createTaskOpen = false; context.render(); },

    /** @param {string} taskId */
    openTask(taskId) {
      if (Date.now() < context.interaction.taskOpenUntil) return;
      context.viewState().selectedTaskId = taskId;
      context.render();
    },
    closeTask() { context.viewState().selectedTaskId = null; context.render(); },

    /** @param {string} taskId */
    addTodo(taskId) {
      const input = document.querySelector("#new-todo");
      if (!(input instanceof HTMLInputElement)) return;
      addTaskTodo(context.state(), taskId, input.value);
      context.saveState();
      context.render();
      queueMicrotask(() => {
        const nextInput = document.querySelector("#new-todo");
        if (nextInput instanceof HTMLInputElement) nextInput.focus();
      });
    },
    /** @param {string} taskId @param {string} todoId @param {boolean} completed */
    toggleTodo(taskId, todoId, completed) { updateTaskTodo(context.state(), taskId, todoId, { completed }); context.saveState(); context.render(); },
    /** @param {string} taskId @param {string} todoId @param {string} text */
    updateTodo(taskId, todoId, text) { updateTaskTodo(context.state(), taskId, todoId, { text }); context.saveState(); },
    /** @param {string} taskId @param {string} todoId */
    deleteTodo(taskId, todoId) { deleteTaskTodo(context.state(), taskId, todoId); context.saveState(); context.render(); },

    undoLastAction() {
      const viewState = context.viewState();
      if (!viewState.undo) return;
      applyUndo(context.state(), viewState.undo.command);
      viewState.undo = null;
      context.clearUndoTimer();
      context.saveState();
      context.render();
    },
    dismissUndo() { context.viewState().undo = null; context.clearUndoTimer(); context.renderUndoRegion(); },
    dismissNotice() { context.viewState().notice = null; context.clearUndoTimer(); context.renderUndoRegion(); },

    /** @param {Event} event */
    submitCreateTask(event) {
      event.preventDefault();
      if (!(event.currentTarget instanceof HTMLFormElement)) return;
      const data = new FormData(event.currentTarget);
      addTask(context.state(), { title: data.get("title"), category: data.get("category"), priority: data.get("priority"), assignee: data.get("assignee"), dueDate: data.get("dueDate"), columnId: String(data.get("columnId") ?? "backlog") });
      context.viewState().createTaskOpen = false;
      context.saveState();
      context.render();
    },

    resetBoard() {
      const state = createInitialBoardState();
      const viewState = createBoardViewState(state.columns[0].id);
      context.setState(state);
      context.setViewState(viewState);
      context.boardViewStates[context.workspace.activeBoardId] = viewState;
      context.saveState();
      context.render();
    },

    /** @param {Event} event */
    submitTaskDetails(event) {
      event.preventDefault();
      if (!(event.currentTarget instanceof HTMLFormElement)) return;
      const data = new FormData(event.currentTarget);
      const state = context.state();
      const taskId = String(data.get("taskId") ?? "");
      const targetColumnId = String(data.get("columnId") ?? "backlog");
      const sourceColumn = state.columns.find((column) => column.taskIds.includes(taskId));
      if (sourceColumn?.id !== targetColumnId && !canMoveTaskTo(state, taskId, targetColumnId)) {
        context.registerNotice(context.moveRejectionMessage(taskId, targetColumnId));
        return;
      }
      updateTask(state, taskId, { title: data.get("title"), category: data.get("category"), priority: data.get("priority"), assignee: data.get("assignee"), dueDate: data.get("dueDate") });
      const boardMembers = new Set(state.project.memberIds);
      const ownerId = String(data.get("ownerId") ?? "");
      state.tasks[taskId].ownerId = boardMembers.has(ownerId) ? ownerId : null;
      state.tasks[taskId].memberIds = [...new Set(data.getAll("memberIds").map(String))].filter((id) => boardMembers.has(id) && id !== state.tasks[taskId].ownerId);
      if (sourceColumn?.id !== targetColumnId) {
        const undo = createMoveUndo(state, taskId);
        moveTask(state, taskId, targetColumnId);
        context.registerUndo(undo, `${taskId} nach „${context.columnTitle(targetColumnId)}“ verschoben.`);
      }
      context.viewState().selectedTaskId = null;
      context.saveState();
      context.render();
    },

    /** @param {string} taskId */
    deleteTask(taskId) {
      const state = context.state();
      const undo = createDeleteUndo(state, taskId);
      removeTask(state, taskId);
      if (context.viewState().selectedTaskId === taskId) context.viewState().selectedTaskId = null;
      context.registerUndo(undo, `${taskId} wurde gelöscht.`);
      context.saveState();
      context.render();
    },
  };
}
