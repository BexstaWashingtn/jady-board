import { createBoardPage, createKanbanBoard } from "../templates/board.map.js";
import { createBoardActions } from "./actions/board.actions.js";
import { createDragDropActions } from "./actions/drag-drop.actions.js";
import { createFilterActions } from "./actions/filter.actions.js";
import { createStageActions } from "./actions/stage.actions.js";
import { createTaskActions } from "./actions/task.actions.js";
import { createTransferActions } from "./actions/transfer.actions.js";
import { createUserActions } from "./actions/user.actions.js";
import { actionErrorMessage, guardActions } from "./actions/action-guard.js";
import { ensureShowcaseData } from "./board.demo-data.js";
import { createDialogManager } from "./board.dialog-manager.js";
import { canConfigureBoard, canCreateTask } from "./board.permissions.js";
import { loadWorkspace, persistWorkspace } from "./board.persistence.js";
import { createBoardViewState } from "./board.view-state.js";

/** @param {import("../core/JaDyDoCo.js").JaDyDoCo} app */
export function createBoardController(app) {
  const workspace = loadWorkspace();
  let persistenceError = ensureShowcaseData(workspace) && !persistWorkspace(workspace);
  let state = workspace.boards[workspace.activeBoardId];
  /** @type {Record<string, import("./board.view-state.js").BoardViewState>} */
  const boardViewStates = {};
  let viewState = getBoardViewState(workspace.activeBoardId);
  const overlays = {
    boardCreateOpen: false,
    userSettingsOpen: false,
    appSettingsOpen: false,
    transfer: { preview: null, error: null, lastExportedAt: null },
  };
  const interaction = { taskOpenUntil: 0 };
  const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
  /** @type {ReturnType<typeof setTimeout> | null} */
  let undoTimer = null;

  /** @type {import("./actions/action-context.js").BoardActionContext} */
  const context = {
    state: () => state,
    setState: (nextState) => { state = nextState; },
    viewState: () => viewState,
    setViewState: (nextViewState) => { viewState = nextViewState; },
    workspace,
    boardViewStates,
    overlays,
    interaction,
    render,
    renderKanban,
    renderUndoRegion,
    saveState,
    clearUndoTimer,
    registerUndo,
    registerNotice,
    isBoardOwner,
    applyUserTheme,
    getBoardViewState,
    closeBoardAdministration,
    scrollToStageEditor,
    columnTitle,
    moveRejectionMessage,
    moveRejectionLabel,
    replaceWorkspace,
  };

  const rawActions = {
    ...createBoardActions(context),
    ...createUserActions(context),
    ...createStageActions(context),
    ...createTaskActions(context),
    ...createDragDropActions(context),
    ...createFilterActions(context),
    ...createTransferActions(context),
  };
  const actions = guardActions(rawActions, (error) => registerNotice(actionErrorMessage(error)));

  const dialogManager = createDialogManager({ onEscape: closeActiveDialog });

  applyUserTheme();
  colorScheme.addEventListener("change", handleColorSchemeChange);

  function handleColorSchemeChange() {
    if (workspace.users[workspace.activeUserId].preferences.theme === "system") applyUserTheme();
  }

  function closeActiveDialog() {
    if (overlays.appSettingsOpen) actions.closeAppSettings();
    else if (overlays.userSettingsOpen) actions.closeUserSettings();
    else if (overlays.boardCreateOpen) actions.closeCreateBoard();
    else if (viewState.createTaskOpen) actions.closeCreateTask();
    else if (viewState.selectedTaskId) actions.closeTask();
    else if (viewState.stageConfigOpen) actions.closeStageConfig();
    else if (viewState.stageEditor) actions.cancelStageEditor();
    else if (viewState.boardConfigOpen) actions.closeBoardConfig();
  }

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
    dialogManager.beforeRender();
    app.replace(createBoardPage(state, viewState, actions, {
      activeBoardId: workspace.activeBoardId,
      boards: Object.entries(workspace.boards).map(([id, board]) => ({ id, name: board.project.name })),
      createOpen: overlays.boardCreateOpen,
      userSettingsOpen: overlays.userSettingsOpen,
      appSettingsOpen: overlays.appSettingsOpen,
      activeUserId: workspace.activeUserId,
      users: Object.values(workspace.users),
      persistenceError,
      transfer: overlays.transfer,
    }));
    dialogManager.afterRender();
  }

  function renderKanban() {
    const region = document.querySelector("#kanban-region");
    if (!(region instanceof HTMLElement)) { render(); return; }
    app.replace(createKanbanBoard(state, viewState, actions, Object.values(workspace.users), isBoardOwner(), workspace.activeUserId, canCreateTask(state, workspace.activeUserId)), region);
  }

  function renderUndoRegion() {
    const region = document.querySelector("#undo-region");
    if (region instanceof HTMLElement) app.clear(region);
  }

  /** @param {import("./board.state.js").UndoCommand} command @param {string} message */
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
    return target?.requireCompletedTodos && task?.todos.some(({ completed }) => !completed)
      ? "Offene Todos zuerst erledigen"
      : "Übergang nicht erlaubt";
  }

  function saveState() {
    workspace.boards[workspace.activeBoardId] = state;
    persistenceError = !persistWorkspace(workspace);
  }

  /** @param {import("./board.persistence.js").BoardWorkspace} nextWorkspace */
  function replaceWorkspace(nextWorkspace) {
    workspace.activeBoardId = nextWorkspace.activeBoardId;
    workspace.boards = nextWorkspace.boards;
    workspace.activeUserId = nextWorkspace.activeUserId;
    workspace.users = nextWorkspace.users;
    Object.keys(boardViewStates).forEach((id) => delete boardViewStates[id]);
    state = workspace.boards[workspace.activeBoardId];
    viewState = getBoardViewState(workspace.activeBoardId);
    clearUndoTimer();
    closeBoardAdministration();
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
    if (!boardViewStates[boardId]) boardViewStates[boardId] = createBoardViewState(board?.columns[0]?.id);
    return boardViewStates[boardId];
  }

  function destroy() {
    clearUndoTimer();
    colorScheme.removeEventListener("change", handleColorSchemeChange);
    dialogManager.destroy();
  }

  render();
  return { getState: () => state, actions, render, destroy };
}
