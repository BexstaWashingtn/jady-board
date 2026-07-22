import { addColumn, createInitialBoardState } from "../board.state.js";

/** @param {import("./action-context.js").BoardActionContext} context */
export function createBoardActions(context) {
  return {
    retryPersistence() { context.saveState(); context.render(); },

    /** @param {string} boardId */
    switchBoard(boardId) {
      const { workspace } = context;
      if (!workspace.boards[boardId] || boardId === workspace.activeBoardId) return;
      context.clearUndoTimer();
      workspace.activeBoardId = boardId;
      context.setState(workspace.boards[boardId]);
      context.setViewState(context.getBoardViewState(boardId));
      context.saveState();
      context.render();
    },

    openCreateBoard() {
      context.overlays.boardCreateOpen = true;
      context.render();
      queueMicrotask(() => {
        const input = document.querySelector("#new-board-name");
        if (input instanceof HTMLInputElement) input.focus();
      });
    },

    closeCreateBoard() { context.overlays.boardCreateOpen = false; context.render(); },

    /** @param {Event} event */
    submitCreateBoard(event) {
      event.preventDefault();
      if (!(event.currentTarget instanceof HTMLFormElement)) return;
      const data = new FormData(event.currentTarget);
      const name = String(data.get("name") ?? "").trim();
      if (!name) return;
      const { workspace } = context;
      const id = nextBoardId(workspace.boards);
      const board = createInitialBoardState();
      board.project = { name, path: `Boards / ${name}`, description: String(data.get("description") ?? "").trim() || "Ein neues JaDy Board.", ownerId: workspace.activeUserId, memberIds: [workspace.activeUserId] };
      const defaultStages = data.getAll("defaultStages").map(String);
      board.columns = board.columns.filter((column) => defaultStages.includes(column.id));
      if (!board.columns.length) board.columns = [createInitialBoardState().columns[0]];
      board.columns.forEach((column) => { column.taskIds = []; });
      board.tasks = {};
      String(data.get("customStages") ?? "").split(/[\n,]/).map((title) => title.trim()).filter(Boolean)
        .forEach((title) => addColumn(board, { title }));
      workspace.boards[id] = board;
      workspace.activeBoardId = id;
      context.setState(board);
      context.setViewState(context.getBoardViewState(id));
      context.overlays.boardCreateOpen = false;
      context.saveState();
      context.render();
    },

    /** @param {Event} event */
    submitBoardDetails(event) {
      event.preventDefault();
      if (!context.isBoardOwner() || !(event.currentTarget instanceof HTMLFormElement)) return;
      const data = new FormData(event.currentTarget);
      const name = String(data.get("name") ?? "").trim();
      if (!name) return;
      const state = context.state();
      const { workspace } = context;
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
      context.saveState();
      context.render();
    },

    deleteBoard() {
      const { workspace } = context;
      const state = context.state();
      if (!context.isBoardOwner() || Object.keys(workspace.boards).length === 1) return;
      if (!window.confirm(`Board „${state.project.name}“ inklusive aller Tasks wirklich löschen?`)) return;
      delete workspace.boards[workspace.activeBoardId];
      delete context.boardViewStates[workspace.activeBoardId];
      workspace.activeBoardId = Object.keys(workspace.boards)[0];
      context.setState(workspace.boards[workspace.activeBoardId]);
      context.setViewState(context.getBoardViewState(workspace.activeBoardId));
      context.saveState();
      context.render();
    },

    openBoardConfig() {
      if (!context.isBoardOwner()) return;
      const viewState = context.viewState();
      viewState.boardConfigOpen = true;
      viewState.stageConfigOpen = false;
      viewState.stageEditor = null;
      viewState.openColumnMenuId = null;
      context.render();
    },

    closeBoardConfig() {
      const viewState = context.viewState();
      viewState.boardConfigOpen = false;
      viewState.stageEditor = null;
      context.render();
    },
  };
}

/** @param {Record<string, import("../board.state.js").BoardState>} boards */
function nextBoardId(boards) {
  let number = 1;
  while (boards[`board-${number}`]) number += 1;
  return `board-${number}`;
}
