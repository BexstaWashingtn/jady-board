import {
  addTask,
  addTaskTodo,
  addColumn,
  applyUndo,
  canAcceptTasks,
  canMoveTaskTo,
  createDeleteUndo,
  createInitialBoardState,
  createMoveUndo,
  createEmptyFilters,
  deleteTask as removeTask,
  deleteTaskTodo,
  deleteColumn,
  moveTask,
  moveColumn,
  updateColumn,
  updateTask,
  updateTaskTodo,
} from "./board.state.js";
import { createBoardPage } from "../templates/board.map.js";
import { createKanbanBoard } from "../templates/board.map.js";
import { canConfigureBoard } from "./board.permissions.js";
import { clearDropTargets, syncFilterControls, updateClearFilterButton, updateDropPosition, updateFilterOptionCounts } from "./board.dom.js";
import { loadWorkspace, persistWorkspace } from "./board.persistence.js";
import { ensureShowcaseData } from "./board.demo-data.js";
import { createBoardViewState } from "./board.view-state.js";

/** @param {import("../core/JaDyDoCo.js").JaDyDoCo} app */
export function createBoardController(app) {
  let workspace = loadWorkspace();
  if (ensureShowcaseData(workspace)) persistWorkspace(workspace);
  let persistenceError = false;
  let state = workspace.boards[workspace.activeBoardId];
  /** @type {Record<string, import("./board.view-state.js").BoardViewState>} */
  const boardViewStates = {};
  let viewState = getBoardViewState(workspace.activeBoardId);
  let boardCreateOpen = false;
  let userSettingsOpen = false;
  let appSettingsOpen = false;
  const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
  applyUserTheme();
  colorScheme.addEventListener("change", () => {
    if (workspace.users[workspace.activeUserId].preferences.theme === "system") applyUserTheme();
  });
  let suppressTaskOpenUntil = 0;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let undoTimer = null;

  const actions = {
    retryPersistence() {
      saveState(state);
      render();
    },
    openAppSettings() { appSettingsOpen = true; render(); },
    closeAppSettings() { appSettingsOpen = false; render(); },
    openUserSettings() { userSettingsOpen = true; render(); },
    closeUserSettings() { userSettingsOpen = false; render(); },
    /** @param {string} userId */
    switchUser(userId) {
      if (!workspace.users[userId]) return;
      workspace.activeUserId = userId;
      closeBoardAdministration();
      applyUserTheme();
      saveState(state);
      render();
    },
    /** @param {string} theme */
    setTheme(theme) {
      if (theme !== "light" && theme !== "dark" && theme !== "system") return;
      workspace.users[workspace.activeUserId].preferences.theme = theme;
      applyUserTheme();
      saveState(state);
    },
    /** @param {Event} event */
    submitUser(event) {
      event.preventDefault();
      if (!(event.currentTarget instanceof HTMLFormElement)) return;
      const data = new FormData(event.currentTarget);
      const name = String(data.get("name") ?? "").trim();
      if (!name) return;
      const user = workspace.users[workspace.activeUserId];
      user.name = name;
      user.initials = normalizeInitials(data.get("initials"), name);
      saveState(state);
      render();
    },
    /** @param {Event} event */
    createUser(event) {
      event.preventDefault();
      if (!(event.currentTarget instanceof HTMLFormElement)) return;
      const data = new FormData(event.currentTarget);
      const name = String(data.get("name") ?? "").trim();
      if (!name) return;
      const id = nextUserId(workspace.users);
      workspace.users[id] = { id, name, initials: normalizeInitials(data.get("initials"), name), preferences: { theme: "system" } };
      workspace.activeUserId = id;
      saveState(state);
      render();
    },
    deleteUser() {
      if (Object.keys(workspace.users).length === 1) return;
      const user = workspace.users[workspace.activeUserId];
      const ownedBoard = Object.values(workspace.boards).find((board) => board.project.ownerId === user.id);
      if (ownedBoard) { registerNotice(`Benutzer kann nicht gelöscht werden: Er besitzt das Board „${ownedBoard.project.name}“.`); return; }
      if (!window.confirm(`Benutzer „${user.name}“ wirklich löschen?`)) return;
      Object.values(workspace.boards).forEach((board) => {
        board.project.memberIds = board.project.memberIds.filter((id) => id !== user.id);
        Object.values(board.tasks).forEach((task) => {
          if (task.ownerId === user.id) task.ownerId = null;
          task.memberIds = task.memberIds.filter((id) => id !== user.id);
        });
      });
      delete workspace.users[workspace.activeUserId];
      workspace.activeUserId = Object.keys(workspace.users)[0];
      saveState(state);
      render();
    },
    /** @param {string} boardId */
    switchBoard(boardId) {
      if (!workspace.boards[boardId] || boardId === workspace.activeBoardId) return;
      clearUndoTimer();
      workspace.activeBoardId = boardId;
      state = workspace.boards[boardId];
      viewState = getBoardViewState(boardId);
      saveState(state);
      render();
    },

    openCreateBoard() {
      boardCreateOpen = true;
      render();
      queueMicrotask(() => {
        const input = document.querySelector("#new-board-name");
        if (input instanceof HTMLInputElement) input.focus();
      });
    },

    closeCreateBoard() {
      boardCreateOpen = false;
      render();
    },

    /** @param {Event} event */
    submitCreateBoard(event) {
      event.preventDefault();
      if (!(event.currentTarget instanceof HTMLFormElement)) return;
      const data = new FormData(event.currentTarget);
      const name = String(data.get("name") ?? "").trim();
      if (!name) return;
      const id = nextBoardId(workspace.boards);
      const board = createInitialBoardState();
      board.project = { name, path: `Boards / ${name}`, description: String(data.get("description") ?? "").trim() || "Ein neues JaDy Board.", ownerId: workspace.activeUserId, memberIds: [workspace.activeUserId] };
      const defaultStages = data.getAll("defaultStages").map(String);
      board.columns = board.columns.filter((column) => defaultStages.includes(column.id));
      if (!board.columns.length) board.columns = [createInitialBoardState().columns[0]];
      board.columns.forEach((column) => { column.taskIds = []; });
      board.tasks = {};
      const customStages = String(data.get("customStages") ?? "").split(/[\n,]/).map((title) => title.trim()).filter(Boolean);
      customStages.forEach((title) => addColumn(board, { title }));
      workspace.boards[id] = board;
      workspace.activeBoardId = id;
      state = board;
      viewState = getBoardViewState(id);
      boardCreateOpen = false;
      saveState(state);
      render();
    },

    /** @param {Event} event */
    submitBoardDetails(event) {
      event.preventDefault();
      if (!isBoardOwner()) return;
      if (!(event.currentTarget instanceof HTMLFormElement)) return;
      const data = new FormData(event.currentTarget);
      const name = String(data.get("name") ?? "").trim();
      if (!name) return;
      state.project.name = name;
      state.project.description = String(data.get("description") ?? "").trim();
      state.project.path = `Boards / ${name}`;
      const ownerId = String(data.get("ownerId") ?? workspace.activeUserId);
      const validUserIds = new Set(Object.keys(workspace.users));
      state.project.ownerId = validUserIds.has(ownerId) ? ownerId : workspace.activeUserId;
      state.project.memberIds = [...new Set([...data.getAll("memberIds").map(String), state.project.ownerId])].filter((id) => validUserIds.has(id));
      const boardMembers = new Set(state.project.memberIds);
      Object.values(state.tasks).forEach((task) => {
        if (task.ownerId && !boardMembers.has(task.ownerId)) task.ownerId = null;
        task.memberIds = task.memberIds.filter((id) => boardMembers.has(id));
      });
      saveState(state);
      render();
    },

    deleteBoard() {
      if (!isBoardOwner()) return;
      if (Object.keys(workspace.boards).length === 1) return;
      if (!window.confirm(`Board „${state.project.name}“ inklusive aller Tasks wirklich löschen?`)) return;
      delete workspace.boards[workspace.activeBoardId];
      delete boardViewStates[workspace.activeBoardId];
      workspace.activeBoardId = Object.keys(workspace.boards)[0];
      state = workspace.boards[workspace.activeBoardId];
      viewState = getBoardViewState(workspace.activeBoardId);
      saveState(state);
      render();
    },
    openCreateTask(columnId = "backlog") {
      const requested = canAcceptTasks(state, columnId) ? columnId : null;
      const fallback = state.columns.find((column) => canAcceptTasks(state, column.id));
      const targetColumnId = requested ?? fallback?.id;
      if (!targetColumnId) return;
      viewState.openColumnMenuId = null;
      viewState.createTaskOpen = true;
      viewState.createTaskColumnId = targetColumnId;
      render();
    },

    closeCreateTask() {
      viewState.createTaskOpen = false;
      render();
    },

    openBoardConfig() {
      if (!isBoardOwner()) return;
      viewState.boardConfigOpen = true;
      viewState.stageConfigOpen = false;
      viewState.stageEditor = null;
      viewState.openColumnMenuId = null;
      render();
    },

    closeBoardConfig() {
      viewState.boardConfigOpen = false;
      viewState.stageEditor = null;
      render();
    },

    openStageConfig() {
      if (!isBoardOwner()) return;
      viewState.stageConfigOpen = true;
      viewState.boardConfigOpen = false;
      viewState.stageEditor = null;
      viewState.openColumnMenuId = null;
      render();
    },

    closeStageConfig() {
      viewState.stageConfigOpen = false;
      viewState.stageEditor = null;
      render();
    },

    createStage() {
      if (!isBoardOwner()) return;
      viewState.stageEditor = { mode: "create", columnId: null };
      render();
    },

    /** @param {string} columnId */
    editStage(columnId) {
      if (!isBoardOwner()) return;
      viewState.stageEditor = { mode: "edit", columnId };
      render();
      scrollToStageEditor();
    },

    /** @param {string} columnId */
    requestDeleteStage(columnId) {
      if (!isBoardOwner()) return;
      viewState.stageEditor = { mode: "delete", columnId };
      render();
    },

    cancelStageEditor() {
      viewState.stageEditor = null;
      render();
    },

    /** @param {string} columnId */
    toggleColumnMenu(columnId) {
      if (!isBoardOwner()) return;
      viewState.openColumnMenuId = viewState.openColumnMenuId === columnId ? null : columnId;
      render();
      if (viewState.openColumnMenuId) {
        queueMicrotask(() => {
          const firstItem = document.querySelector(".column-context-menu button");
          if (firstItem instanceof HTMLButtonElement) firstItem.focus();
        });
      }
    },

    closeColumnMenu() {
      viewState.openColumnMenuId = null;
      render();
    },

    /** @param {string} columnId */
    openStageEditorFromMenu(columnId) {
      if (!isBoardOwner()) return;
      viewState.openColumnMenuId = null;
      viewState.boardConfigOpen = false;
      viewState.stageConfigOpen = true;
      viewState.stageEditor = { mode: "edit", columnId };
      render();
      scrollToStageEditor();
    },

    /** @param {string} columnId */
    openStageDeleteFromMenu(columnId) {
      if (!isBoardOwner()) return;
      viewState.openColumnMenuId = null;
      viewState.boardConfigOpen = false;
      viewState.stageConfigOpen = true;
      viewState.stageEditor = { mode: "delete", columnId };
      render();
    },

    /** @param {Event} event */
    submitStage(event) {
      event.preventDefault();
      if (!isBoardOwner()) return;
      if (!(event.currentTarget instanceof HTMLFormElement)) return;
      const data = new FormData(event.currentTarget);
      const columnId = String(data.get("columnId") ?? "");
      const input = {
        title: data.get("title"),
        color: data.get("color"),
        kind: data.get("kind"),
        limit: data.get("limit"),
        limitMode: data.get("limitMode"),
        allowedTargetIds: data.getAll("allowedTargetIds"),
        requireCompletedTodos: data.get("requireCompletedTodos") === "true",
      };
      if (columnId) updateColumn(state, columnId, input);
      else addColumn(state, input);
      viewState.stageEditor = null;
      saveState(state);
      render();
    },

    /** @param {string} columnId @param {number} direction */
    moveStage(columnId, direction) {
      if (!isBoardOwner()) return;
      const index = state.columns.findIndex(({ id }) => id === columnId);
      moveColumn(state, columnId, index + direction);
      viewState.openColumnMenuId = null;
      saveState(state);
      render();
    },

    /** @param {Event} event */
    confirmDeleteStage(event) {
      event.preventDefault();
      if (!isBoardOwner()) return;
      if (!(event.currentTarget instanceof HTMLFormElement)) return;
      const data = new FormData(event.currentTarget);
      const columnId = String(data.get("columnId") ?? "");
      deleteColumn(state, columnId, {
        moveTasksTo: String(data.get("moveTasksTo") ?? ""),
      });
      if (viewState.createTaskColumnId === columnId) viewState.createTaskColumnId = state.columns[0].id;
      viewState.stageEditor = null;
      saveState(state);
      render();
    },

    /** @param {string} taskId */
    openTask(taskId) {
      if (Date.now() < suppressTaskOpenUntil) return;
      viewState.selectedTaskId = taskId;
      render();
    },

    /** @param {string} taskId */
    addTodo(taskId) {
      const input = document.querySelector("#new-todo");
      if (!(input instanceof HTMLInputElement)) return;
      addTaskTodo(state, taskId, input.value);
      saveState(state);
      render();
      queueMicrotask(() => {
        const nextInput = document.querySelector("#new-todo");
        if (nextInput instanceof HTMLInputElement) nextInput.focus();
      });
    },

    /** @param {string} taskId @param {string} todoId @param {boolean} completed */
    toggleTodo(taskId, todoId, completed) {
      updateTaskTodo(state, taskId, todoId, { completed });
      saveState(state);
      render();
    },

    /** @param {string} taskId @param {string} todoId @param {string} text */
    updateTodo(taskId, todoId, text) {
      updateTaskTodo(state, taskId, todoId, { text });
      saveState(state);
    },

    /** @param {string} taskId @param {string} todoId */
    deleteTodo(taskId, todoId) {
      deleteTaskTodo(state, taskId, todoId);
      saveState(state);
      render();
    },

    /**
     * @param {DragEvent} event
     * @param {string} taskId
     */
    startTaskDrag(event, taskId) {
      viewState.draggingTaskId = taskId;
      event.dataTransfer?.setData("text/plain", taskId);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
      if (event.currentTarget instanceof HTMLElement) {
        event.currentTarget.classList.add("task-card--dragging");
      }
    },

    /** @param {DragEvent} event */
    endTaskDrag(event) {
      viewState.draggingTaskId = null;
      suppressTaskOpenUntil = Date.now() + 180;
      if (event.currentTarget instanceof HTMLElement) {
        event.currentTarget.classList.remove("task-card--dragging");
      }
      clearDropTargets();
    },

    /** @param {DragEvent} event @param {string} columnId */
    dragTaskOverColumn(event, columnId) {
      event.preventDefault();
      const taskId = viewState.draggingTaskId;
      const transitionAllowed = !taskId || canMoveTaskTo(state, taskId, columnId);
      if (!transitionAllowed || !canAcceptTasks(state, columnId, 1, taskId ?? undefined)) {
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
        if (event.currentTarget instanceof HTMLElement) {
          event.currentTarget.classList.add("kanban-column--drop-rejected");
          event.currentTarget.dataset.dropRejection = taskId && !transitionAllowed
            ? moveRejectionLabel(taskId, columnId)
            : "WIP-Limit erreicht";
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
      if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
        event.currentTarget.classList.remove("kanban-column--drop-target");
      }
    },

    /**
     * @param {DragEvent} event
     * @param {string} columnId
     */
    dropTask(event, columnId) {
      event.preventDefault();
      const taskId = event.dataTransfer?.getData("text/plain") || viewState.draggingTaskId;
      const column = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
      const targetIndex = Number(column?.dataset.dropIndex);
      clearDropTargets();
      if (!taskId || !state.tasks[taskId]) return;
      if (!canMoveTaskTo(state, taskId, columnId)) {
        registerNotice(moveRejectionMessage(taskId, columnId));
        return;
      }
      if (!canAcceptTasks(state, columnId, 1, taskId)) return;

      const undo = createMoveUndo(state, taskId);
      const moved = moveTask(state, taskId, columnId, Number.isInteger(targetIndex) ? targetIndex : undefined);
      if (!moved) {
        viewState.draggingTaskId = null;
        suppressTaskOpenUntil = Date.now() + 180;
        return;
      }
      registerUndo(undo, `${taskId} nach „${columnTitle(columnId)}“ verschoben.`);
      viewState.draggingTaskId = null;
      suppressTaskOpenUntil = Date.now() + 180;
      saveState(state);
      render();
    },

    closeTask() {
      viewState.selectedTaskId = null;
      render();
    },

    undoLastAction() {
      if (!viewState.undo) return;
      applyUndo(state, viewState.undo.command);
      viewState.undo = null;
      clearUndoTimer();
      saveState(state);
      render();
    },

    dismissUndo() {
      viewState.undo = null;
      clearUndoTimer();
      renderUndoRegion();
    },

    dismissNotice() {
      viewState.notice = null;
      clearUndoTimer();
      renderUndoRegion();
    },

    /** @param {"query" | "priority" | "category" | "assignee"} key @param {string} value */
    setFilter(key, value) {
      viewState.filters[key] = value;
      updateClearFilterButton(viewState.filters);
      updateFilterOptionCounts(state, viewState.filters);
      renderKanban();
    },

    clearFilters() {
      viewState.filters = createEmptyFilters();
      syncFilterControls(viewState.filters);
      updateFilterOptionCounts(state, viewState.filters);
      renderKanban();
    },

    /** @param {Event} event */
    submitCreateTask(event) {
      event.preventDefault();
      if (!(event.currentTarget instanceof HTMLFormElement)) return;

      const data = new FormData(event.currentTarget);
      addTask(state, {
        title: data.get("title"),
        category: data.get("category"),
        priority: data.get("priority"),
        assignee: data.get("assignee"),
        dueDate: data.get("dueDate"),
        columnId: String(data.get("columnId") ?? "backlog"),
      });
      viewState.createTaskOpen = false;
      saveState(state);
      render();
    },

    resetBoard() {
      state = createInitialBoardState();
      viewState = createBoardViewState(state.columns[0].id);
      boardViewStates[workspace.activeBoardId] = viewState;
      saveState(state);
      render();
    },

    /** @param {Event} event */
    submitTaskDetails(event) {
      event.preventDefault();
      if (!(event.currentTarget instanceof HTMLFormElement)) return;

      const data = new FormData(event.currentTarget);
      const taskId = String(data.get("taskId") ?? "");
      const targetColumnId = String(data.get("columnId") ?? "backlog");
      const sourceColumn = state.columns.find((column) => column.taskIds.includes(taskId));
      if (sourceColumn?.id !== targetColumnId) {
        if (!canMoveTaskTo(state, taskId, targetColumnId)) {
          registerNotice(moveRejectionMessage(taskId, targetColumnId));
          return;
        }
      }
      updateTask(state, taskId, {
        title: data.get("title"),
        category: data.get("category"),
        priority: data.get("priority"),
        assignee: data.get("assignee"),
        dueDate: data.get("dueDate"),
      });
      const boardMembers = new Set(state.project.memberIds);
      const ownerId = String(data.get("ownerId") ?? "");
      state.tasks[taskId].ownerId = boardMembers.has(ownerId) ? ownerId : null;
      state.tasks[taskId].memberIds = [...new Set(data.getAll("memberIds").map(String))].filter((id) => boardMembers.has(id) && id !== state.tasks[taskId].ownerId);
      if (sourceColumn?.id !== targetColumnId) {
        const undo = createMoveUndo(state, taskId);
        moveTask(state, taskId, targetColumnId);
        registerUndo(undo, `${taskId} nach „${columnTitle(targetColumnId)}“ verschoben.`);
      }
      viewState.selectedTaskId = null;
      saveState(state);
      render();
    },

    /** @param {string} taskId */
    deleteTask(taskId) {
      const undo = createDeleteUndo(state, taskId);
      removeTask(state, taskId);
      if (viewState.selectedTaskId === taskId) viewState.selectedTaskId = null;
      registerUndo(undo, `${taskId} wurde gelöscht.`);
      saveState(state);
      render();
    },
  };

  function isBoardOwner() {
    return canConfigureBoard(state, workspace.activeUserId);
  }

  function closeBoardAdministration() {
    viewState.boardConfigOpen = false;
    viewState.stageConfigOpen = false;
    viewState.stageEditor = null;
    viewState.openColumnMenuId = null;
  }

  function scrollToStageEditor() {
    queueMicrotask(() => {
      const editor = document.querySelector("#stage-editor");
      if (!(editor instanceof HTMLFormElement)) return;
      editor.scrollIntoView({ behavior: "smooth", block: "start" });
      const titleInput = editor.querySelector("#stage-title");
      if (titleInput instanceof HTMLInputElement) titleInput.focus({ preventScroll: true });
    });
  }

  function render() {
    app.replace(createBoardPage(state, viewState, actions, {
      activeBoardId: workspace.activeBoardId,
      boards: Object.entries(workspace.boards).map(([id, board]) => ({ id, name: board.project.name })),
      createOpen: boardCreateOpen,
      userSettingsOpen,
      appSettingsOpen,
      activeUserId: workspace.activeUserId,
      users: Object.values(workspace.users),
      persistenceError,
    }));
  }

  function renderKanban() {
    const region = document.querySelector("#kanban-region");
    if (!(region instanceof HTMLElement)) {
      render();
      return;
    }
    app.replace(createKanbanBoard(state, viewState, actions, Object.values(workspace.users), isBoardOwner()), region);
  }

  function renderUndoRegion() {
    const region = document.querySelector("#undo-region");
    if (region instanceof HTMLElement) app.clear(region);
  }

  /**
   * @param {import("./board.state.js").UndoCommand} command
   * @param {string} message
   */
  function registerUndo(command, message) {
    clearUndoTimer();
    viewState.notice = null;
    viewState.undo = { command, message };
    undoTimer = setTimeout(() => {
      viewState.undo = null;
      undoTimer = null;
      renderUndoRegion();
    }, 6000);
  }

  /** @param {string} message */
  function registerNotice(message) {
    clearUndoTimer();
    viewState.undo = null;
    viewState.notice = message;
    render();
    undoTimer = setTimeout(() => {
      viewState.notice = null;
      undoTimer = null;
      renderUndoRegion();
    }, 5000);
  }

  function clearUndoTimer() {
    if (undoTimer !== null) clearTimeout(undoTimer);
    undoTimer = null;
  }

  /** @param {string} columnId */
  function columnTitle(columnId) {
    return state.columns.find(({ id }) => id === columnId)?.title ?? columnId;
  }

  /** @param {string} taskId @param {string} targetColumnId */
  function moveRejectionMessage(taskId, targetColumnId) {
    const task = state.tasks[taskId];
    const target = state.columns.find(({ id }) => id === targetColumnId);
    if (target?.requireCompletedTodos && task?.todos.some(({ completed }) => !completed)) {
      return `Verschieben nicht erlaubt: Für „${target.title}“ müssen zuerst alle Todos erledigt sein.`;
    }
    const source = state.columns.find(({ taskIds }) => taskIds.includes(taskId));
    return `Verschieben nicht erlaubt: „${source?.title ?? "Diese Stage"}“ erlaubt keinen Übergang nach „${target?.title ?? targetColumnId}“.`;
  }

  /** @param {string} taskId @param {string} targetColumnId */
  function moveRejectionLabel(taskId, targetColumnId) {
    const task = state.tasks[taskId];
    const target = state.columns.find(({ id }) => id === targetColumnId);
    if (target?.requireCompletedTodos && task?.todos.some(({ completed }) => !completed)) {
      return "Offene Todos zuerst erledigen";
    }
    return "Übergang nicht erlaubt";
  }

  /** @param {import("./board.state.js").BoardState} _state */
  function saveState(_state) {
    workspace.boards[workspace.activeBoardId] = state;
    persistenceError = !persistWorkspace(workspace);
  }

  function applyUserTheme() {
    const preference = workspace.users[workspace.activeUserId]?.preferences.theme ?? "system";
    const resolved = preference === "system" ? (colorScheme.matches ? "dark" : "light") : preference;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themePreference = preference;
  }

  /** @param {string} boardId */
  function getBoardViewState(boardId) {
    const board = workspace.boards[boardId];
    if (!boardViewStates[boardId]) {
      boardViewStates[boardId] = createBoardViewState(board?.columns[0]?.id);
    }
    return boardViewStates[boardId];
  }

  render();
  return { getState: () => state, actions, render };
}

/** @typedef {{ id: string, name: string, initials: string, preferences: {theme: "light" | "dark" | "system"} }} BoardUser */
/** @typedef {{ activeBoardId: string, boards: Record<string, import("./board.state.js").BoardState>, activeUserId: string, users: Record<string, BoardUser> }} BoardWorkspace */

/** @param {unknown} value @param {string} name */
function normalizeInitials(value, name) {
  const entered = String(value ?? "").trim();
  return (entered || name.split(/\s+/).map((part) => part[0]).join("")).toUpperCase().slice(0, 2);
}

/** @param {Record<string, BoardUser>} users */
function nextUserId(users) {
  let number = 1;
  while (users[`user-${number}`]) number += 1;
  return `user-${number}`;
}

/** @param {Record<string, import("./board.state.js").BoardState>} boards */
function nextBoardId(boards) {
  let number = 1;
  while (boards[`board-${number}`]) number += 1;
  return `board-${number}`;
}

