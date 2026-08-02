import {
  addTask, addTaskTodo, applyUndo, canAcceptTasks, canMoveTaskTo,
  createDeleteUndo, createInitialBoardState, createMoveUndo,
  deleteTask as removeTask, deleteTaskTodo, moveTask, updateTask, updateTaskTodo,
} from "../board.state.js";
import {
  canAssignTask, canClaimTask, canCreateTask, canDeleteTask, canEditTask,
  canReleaseTask, canViewTask, canWorkOnTask,
} from "../board.permissions.js";
import { createBoardViewState } from "../board.view-state.js";

/** @param {import("./action-context.js").BoardActionContext} context */
export function createTaskActions(context) {
  return {
    /** @param {string} [columnId] */
    openCreateTask(columnId) {
      const state = context.state();
      if (!canCreateTask(state, context.workspace.activeUserId)) return;
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
      if (!canViewTask(context.state(), taskId, context.workspace.activeUserId)) return;
      context.viewState().selectedTaskId = taskId;
      context.viewState().taskEditOpen = false;
      context.render();
    },
    closeTask() { context.viewState().selectedTaskId = null; context.viewState().taskEditOpen = false; context.render(); },
    /** @param {string} taskId */
    openTaskEditor(taskId) {
      if (!canEditTask(context.state(), taskId, context.workspace.activeUserId)) return;
      context.viewState().taskEditOpen = true;
      context.render();
    },
    closeTaskEditor() { context.viewState().taskEditOpen = false; context.render(); },

    /** @param {string} taskId */
    addTodo(taskId) {
      if (!canWorkOnTask(context.state(), taskId, context.workspace.activeUserId)) return;
      const input = document.querySelector("#new-todo");
      if (!(input instanceof HTMLInputElement)) return;
      const previous = todoSnapshot(context.state(), taskId);
      addTaskTodo(context.state(), taskId, input.value);
      const finish = () => {
        context.saveState();
        context.render();
        queueMicrotask(() => {
        const nextInput = document.querySelector("#new-todo");
        if (nextInput instanceof HTMLInputElement) nextInput.focus();
        });
      };
      if (context.syncTaskTodosRemote) return persistRemoteTodos(context, context.state(), taskId, previous).then(finish);
      finish();
    },
    /** @param {string} taskId @param {string} todoId @param {boolean} completed */
    toggleTodo(taskId, todoId, completed) { if (!canWorkOnTask(context.state(), taskId, context.workspace.activeUserId)) return; const previous = todoSnapshot(context.state(), taskId); updateTaskTodo(context.state(), taskId, todoId, { completed }); const finish = () => { context.saveState(); context.render(); }; if (context.syncTaskTodosRemote) return persistRemoteTodos(context, context.state(), taskId, previous).then(finish); finish(); },
    /** @param {string} taskId @param {string} todoId @param {string} text */
    updateTodo(taskId, todoId, text) { if (!canWorkOnTask(context.state(), taskId, context.workspace.activeUserId)) return; const previous = todoSnapshot(context.state(), taskId); updateTaskTodo(context.state(), taskId, todoId, { text }); const finish = () => context.saveState(); if (context.syncTaskTodosRemote) return persistRemoteTodos(context, context.state(), taskId, previous).then(finish); finish(); },
    /** @param {string} taskId @param {string} todoId */
    deleteTodo(taskId, todoId) { if (!canWorkOnTask(context.state(), taskId, context.workspace.activeUserId)) return; const previous = todoSnapshot(context.state(), taskId); deleteTaskTodo(context.state(), taskId, todoId); const finish = () => { context.saveState(); context.render(); }; if (context.syncTaskTodosRemote) return persistRemoteTodos(context, context.state(), taskId, previous).then(finish); finish(); },

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
    async submitCreateTask(event) {
      event.preventDefault();
      if (!(event.currentTarget instanceof HTMLFormElement)) return;
      if (!canCreateTask(context.state(), context.workspace.activeUserId)) return;
      const data = new FormData(event.currentTarget);
      const state = context.state();
      const assigneeId = String(data.get("assigneeId") ?? "");
      const userId = context.workspace.activeUserId;
      const canSelectAssignee = context.isBoardOwner() || assigneeId === userId;
      const columnId = String(data.get("columnId") ?? "backlog");
      const created = addTask(state, { title: data.get("title"), category: data.get("category"), priority: data.get("priority"), assigneeId: canSelectAssignee && state.project.memberIds.includes(assigneeId) ? assigneeId : null, dueDate: data.get("dueDate"), columnId });
      if (context.createTaskRemote) {
        const temporaryId = created.id;
        try {
          const saved = await context.createTaskRemote(context.workspace.activeBoardId, created, columnId);
          const column = state.columns.find(({ id }) => id === columnId);
          const index = column?.taskIds.indexOf(temporaryId) ?? -1;
          if (column && index >= 0) column.taskIds[index] = saved.id;
          delete state.tasks[temporaryId];
          state.tasks[saved.id] = { ...created, ...saved, id: saved.id };
          incrementBoardVersion(state);
        } catch (error) {
          const column = state.columns.find(({ id }) => id === columnId);
          if (column) column.taskIds = column.taskIds.filter((id) => id !== temporaryId);
          delete state.tasks[temporaryId];
          throw error;
        }
      }
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
    async submitTaskDetails(event) {
      event.preventDefault();
      if (!(event.currentTarget instanceof HTMLFormElement)) return;
      const data = new FormData(event.currentTarget);
      const state = context.state();
      const taskId = String(data.get("taskId") ?? "");
      if (!canEditTask(state, taskId, context.workspace.activeUserId)) return;
      const previous = structuredClone(state.tasks[taskId]);
      updateTask(state, taskId, { title: data.get("title"), category: data.get("category"), priority: data.get("priority"), dueDate: data.get("dueDate") });
      if (context.updateTaskRemote) {
        try {
          const saved = await context.updateTaskRemote(context.workspace.activeBoardId, state.tasks[taskId]);
          Object.assign(state.tasks[taskId], saved);
        } catch (error) {
          state.tasks[taskId] = previous;
          throw error;
        }
      }
      context.viewState().taskEditOpen = false;
      context.saveState();
      context.render();
    },

    /** @param {Event} event */
    async submitTaskWork(event) {
      event.preventDefault();
      if (!(event.currentTarget instanceof HTMLFormElement)) return;
      const data = new FormData(event.currentTarget);
      const state = context.state();
      const taskId = String(data.get("taskId") ?? "");
      if (!canWorkOnTask(state, taskId, context.workspace.activeUserId)) return;
      const targetColumnId = String(data.get("columnId") ?? "backlog");
      const sourceColumn = state.columns.find((column) => column.taskIds.includes(taskId));
      if (sourceColumn?.id !== targetColumnId && !canMoveTaskTo(state, taskId, targetColumnId)) {
        context.registerNotice(context.moveRejectionMessage(taskId, targetColumnId));
        return;
      }
      if (sourceColumn?.id !== targetColumnId && !canAcceptTasks(state, targetColumnId, 1, taskId)) {
        context.registerNotice(`Verschieben nicht erlaubt: „${context.columnTitle(targetColumnId)}“ hat das WIP-Limit erreicht.`);
        return;
      }
      if (sourceColumn?.id !== targetColumnId) {
        const undo = createMoveUndo(state, taskId);
        const previousColumns = structuredClone(state.columns);
        const previousVersion = state.tasks[taskId].version;
        moveTask(state, taskId, targetColumnId);
        if (context.moveTaskRemote) {
          try {
            const targetIndex = state.columns.find(({ id }) => id === targetColumnId)?.taskIds.indexOf(taskId) ?? 0;
            const saved = await context.moveTaskRemote(context.workspace.activeBoardId, state.tasks[taskId], targetColumnId, targetIndex);
            state.tasks[taskId].version = saved.version;
            incrementBoardVersion(state);
          } catch (error) {
            state.columns = previousColumns;
            state.tasks[taskId].version = previousVersion;
            throw error;
          }
        }
        if (context.moveTaskRemote) context.registerNotice(`${taskId} wurde nach „${context.columnTitle(targetColumnId)}“ verschoben.`);
        else context.registerUndo(undo, `${taskId} nach „${context.columnTitle(targetColumnId)}“ verschoben.`);
      }
      context.saveState();
      context.render();
    },

    /** @param {string} taskId */
    async claimTask(taskId) {
      const state = context.state();
      const userId = context.workspace.activeUserId;
      if (!canClaimTask(state, taskId, userId)) return;
      updateTask(state, taskId, { assigneeId: userId });
      if (context.assignTaskRemote) await persistRemoteAssignment(context, state, taskId, null);
      context.saveState();
      context.render();
    },

    /** @param {string} taskId */
    async releaseTask(taskId) {
      const state = context.state();
      if (!canReleaseTask(state, taskId, context.workspace.activeUserId)) return;
      const previous = state.tasks[taskId].assigneeId;
      updateTask(state, taskId, { assigneeId: null });
      if (context.assignTaskRemote) await persistRemoteAssignment(context, state, taskId, previous);
      context.saveState();
      context.render();
    },

    /** @param {Event} event */
    async assignTask(event) {
      event.preventDefault();
      if (!(event.currentTarget instanceof HTMLFormElement)) return;
      const data = new FormData(event.currentTarget);
      const state = context.state();
      const taskId = String(data.get("taskId") ?? "");
      if (!canAssignTask(state, taskId, context.workspace.activeUserId)) return;
      const assigneeId = String(data.get("assigneeId") ?? "");
      const previous = state.tasks[taskId].assigneeId;
      updateTask(state, taskId, { assigneeId: state.project.memberIds.includes(assigneeId) ? assigneeId : null });
      if (context.assignTaskRemote) await persistRemoteAssignment(context, state, taskId, previous);
      context.saveState();
      context.render();
    },

    /** @param {string} taskId */
    async deleteTask(taskId) {
      const state = context.state();
      if (!canDeleteTask(state, taskId, context.workspace.activeUserId)) return;
      const undo = createDeleteUndo(state, taskId);
      const deleted = structuredClone(state.tasks[taskId]);
      removeTask(state, taskId);
      if (context.deleteTaskRemote) {
        try { await context.deleteTaskRemote(context.workspace.activeBoardId, deleted); incrementBoardVersion(state); }
        catch (error) { applyUndo(state, undo); throw error; }
      }
      if (context.viewState().selectedTaskId === taskId) context.viewState().selectedTaskId = null;
      if (context.deleteTaskRemote) context.registerNotice(`${taskId} wurde gelöscht.`);
      else context.registerUndo(undo, `${taskId} wurde gelöscht.`);
      context.saveState();
      context.render();
    },
  };
}

/** @param {import("../board.state.js").BoardState} state */
function incrementBoardVersion(state) {
  if (Number.isInteger(state.version)) state.version = Number(state.version) + 1;
}

/** @param {import("./action-context.js").BoardActionContext} context @param {import("../board.state.js").BoardState} state @param {string} taskId @param {string|null} previous */
async function persistRemoteAssignment(context, state, taskId, previous) {
  if (!context.assignTaskRemote) return;
  try {
    const saved = await context.assignTaskRemote(context.workspace.activeBoardId, state.tasks[taskId]);
    Object.assign(state.tasks[taskId], saved);
  } catch (error) {
    state.tasks[taskId].assigneeId = previous;
    throw error;
  }
}

/** @param {import("../board.state.js").BoardState} state @param {string} taskId */
function todoSnapshot(state, taskId) {
  return { todos: structuredClone(state.tasks[taskId].todos), version: state.tasks[taskId].version };
}

/** @param {import("./action-context.js").BoardActionContext} context @param {import("../board.state.js").BoardState} state @param {string} taskId @param {{todos: import("../board.state.js").TaskTodo[], version: number|undefined}} previous */
async function persistRemoteTodos(context, state, taskId, previous) {
  if (!context.syncTaskTodosRemote) return;
  try {
    const saved = await context.syncTaskTodosRemote(context.workspace.activeBoardId, state.tasks[taskId]);
    Object.assign(state.tasks[taskId], saved);
  } catch (error) {
    state.tasks[taskId].todos = previous.todos;
    state.tasks[taskId].version = previous.version;
    throw error;
  }
}
