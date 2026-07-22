import { BOARD_SCHEMA_VERSION } from "./board.state.js";
import { normalizeWorkspace, serializeWorkspace } from "./board.persistence.js";

export const BOARD_BACKUP_FORMAT = "jady-board-backup";
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

/** @typedef {{ format: typeof BOARD_BACKUP_FORMAT, exportedAt: string, schemaVersion: number, workspace: Record<string, unknown> }} WorkspaceBackup */
/** @typedef {{ workspace: import("./board.persistence.js").BoardWorkspace, exportedAt: string, boardCount: number, userCount: number, taskCount: number }} ImportPreview */

/** @param {import("./board.persistence.js").BoardWorkspace} workspace @param {Date} [now] @returns {WorkspaceBackup} */
export function createWorkspaceBackup(workspace, now = new Date()) {
  return {
    format: BOARD_BACKUP_FORMAT,
    exportedAt: now.toISOString(),
    schemaVersion: BOARD_SCHEMA_VERSION,
    workspace: JSON.parse(serializeWorkspace(workspace)),
  };
}

/** @param {import("./board.persistence.js").BoardWorkspace} workspace @param {Date} [now] */
export function serializeWorkspaceBackup(workspace, now = new Date()) {
  return JSON.stringify(createWorkspaceBackup(workspace, now), null, 2);
}

/** @param {Date} [now] */
export function backupFilename(now = new Date()) {
  return `jady-board-backup-${now.toISOString().slice(0, 10)}.json`;
}

/** @param {string} source @returns {ImportPreview} */
export function parseWorkspaceBackup(source) {
  if (new Blob([source]).size > MAX_BACKUP_BYTES) throw new Error("Die Backup-Datei ist größer als 5 MB.");

  let value;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error("Die ausgewählte Datei enthält kein gültiges JSON.");
  }
  if (!isRecord(value) || value.format !== BOARD_BACKUP_FORMAT) {
    throw new Error("Die Datei ist kein JaDy-Board-Backup.");
  }
  if (!Number.isInteger(value.schemaVersion)) throw new Error("Dem Backup fehlt eine gültige Schema-Version.");
  if (Number(value.schemaVersion) > BOARD_SCHEMA_VERSION) {
    throw new Error("Das Backup wurde mit einer neueren JaDy-Board-Version erstellt.");
  }
  if (typeof value.exportedAt !== "string" || Number.isNaN(Date.parse(value.exportedAt))) {
    throw new Error("Dem Backup fehlt ein gültiger Exportzeitpunkt.");
  }
  if (!isRecord(value.workspace) || !hasEntries(value.workspace.boards) || !hasEntries(value.workspace.users)) {
    throw new Error("Das Backup enthält keinen vollständigen Workspace.");
  }

  const workspace = normalizeWorkspace(value.workspace);
  return {
    workspace,
    exportedAt: value.exportedAt,
    boardCount: Object.keys(workspace.boards).length,
    userCount: Object.keys(workspace.users).length,
    taskCount: Object.values(workspace.boards).reduce((count, board) => count + Object.keys(board.tasks).length, 0),
  };
}

/** @param {unknown} value @returns {value is Record<string, any>} */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** @param {unknown} value */
function hasEntries(value) {
  return isRecord(value) && Object.keys(value).length > 0;
}
