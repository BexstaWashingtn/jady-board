/**
 * Shared capabilities exposed to feature-specific controller actions.
 * Mutable application state stays owned by board.controller.js; action modules
 * access it through getters and explicit setters.
 *
 * @typedef {Object} BoardActionContext
 * @property {() => import("../board.state.js").BoardState} state
 * @property {(state: import("../board.state.js").BoardState) => void} setState
 * @property {() => import("../board.view-state.js").BoardViewState} viewState
 * @property {(viewState: import("../board.view-state.js").BoardViewState) => void} setViewState
 * @property {import("../board.persistence.js").BoardWorkspace} workspace
 * @property {Record<string, import("../board.view-state.js").BoardViewState>} boardViewStates
 * @property {{ boardCreateOpen: boolean, userSettingsOpen: boolean, appSettingsOpen: boolean, transfer: { preview: import("../board.transfer.js").ImportPreview | null, error: string | null, lastExportedAt: string | null } }} overlays
 * @property {{ taskOpenUntil: number }} interaction
 * @property {() => void} render
 * @property {() => void} renderKanban
 * @property {() => void} renderUndoRegion
 * @property {() => void} saveState
 * @property {() => void} clearUndoTimer
 * @property {(command: import("../board.state.js").UndoCommand, message: string) => void} registerUndo
 * @property {(message: string) => void} registerNotice
 * @property {() => boolean} isBoardOwner
 * @property {() => void} applyUserTheme
 * @property {(boardId: string) => import("../board.view-state.js").BoardViewState} getBoardViewState
 * @property {() => void} closeBoardAdministration
 * @property {() => void} scrollToStageEditor
 * @property {(columnId: string) => string} columnTitle
 * @property {(taskId: string, targetColumnId: string) => string} moveRejectionMessage
 * @property {(taskId: string, targetColumnId: string) => string} moveRejectionLabel
 * @property {(workspace: import("../board.persistence.js").BoardWorkspace) => void} replaceWorkspace
 */

export {};
