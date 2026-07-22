import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createInitialBoardState, BOARD_SCHEMA_VERSION } from "../src/board/board.state.js";
import {
  BOARD_BACKUP_FORMAT,
  MAX_BACKUP_BYTES,
  backupFilename,
  createWorkspaceBackup,
  parseWorkspaceBackup,
  serializeWorkspaceBackup,
} from "../src/board/board.transfer.js";

function workspace() {
  return {
    activeBoardId: "board-1",
    boards: { "board-1": createInitialBoardState() },
    activeUserId: "user-1",
    users: { "user-1": { id: "user-1", name: "Thomas", initials: "TB", preferences: { theme: "system" } } },
  };
}

describe("Workspace-Transfer", () => {
  test("erzeugt ein versioniertes Backup mit stabilem Dateinamen", () => {
    const now = new Date("2026-07-23T10:15:00.000Z");
    const backup = createWorkspaceBackup(workspace(), now);

    assert.equal(backup.format, BOARD_BACKUP_FORMAT);
    assert.equal(backup.schemaVersion, BOARD_SCHEMA_VERSION);
    assert.equal(backup.exportedAt, now.toISOString());
    assert.equal(backup.workspace.version, BOARD_SCHEMA_VERSION);
    assert.equal(backupFilename(now), "jady-board-backup-2026-07-23.json");
  });

  test("liest, normalisiert und beschreibt ein gültiges Backup", () => {
    const source = serializeWorkspaceBackup(workspace(), new Date("2026-07-23T10:15:00.000Z"));
    const preview = parseWorkspaceBackup(source);

    assert.equal(preview.exportedAt, "2026-07-23T10:15:00.000Z");
    assert.equal(preview.boardCount, 1);
    assert.equal(preview.userCount, 1);
    assert.equal(preview.taskCount, 9);
    assert.equal(preview.workspace.boards["board-1"].project.name, "Product Board");
  });

  test("weist ungültiges JSON, falsche Formate und unvollständige Workspaces zurück", () => {
    assert.throws(() => parseWorkspaceBackup("{invalid"), /kein gültiges JSON/);
    assert.throws(() => parseWorkspaceBackup(JSON.stringify({ format: "other" })), /kein JaDy-Board-Backup/);
    assert.throws(() => parseWorkspaceBackup(JSON.stringify({
      format: BOARD_BACKUP_FORMAT,
      schemaVersion: BOARD_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      workspace: {},
    })), /keinen vollständigen Workspace/);
  });

  test("weist Backups neuerer Versionen und zu große Dateien zurück", () => {
    const backup = createWorkspaceBackup(workspace());
    backup.schemaVersion = BOARD_SCHEMA_VERSION + 1;
    assert.throws(() => parseWorkspaceBackup(JSON.stringify(backup)), /neueren JaDy-Board-Version/);
    assert.throws(() => parseWorkspaceBackup("x".repeat(MAX_BACKUP_BYTES + 1)), /größer als 5 MB/);
  });
});
