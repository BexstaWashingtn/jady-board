import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

import {
  BOARD_BACKUP_STORAGE_KEY,
  backupWorkspace,
  loadWorkspace,
  persistWorkspace,
} from "../src/board/board.persistence.js";
import {
  BOARD_SCHEMA_VERSION,
  BOARD_STORAGE_KEY,
  LEGACY_BOARD_STORAGE_KEY,
  createInitialBoardState,
} from "../src/board/board.state.js";

const values = new Map();

globalThis.localStorage = {
  getItem(key) {
    return values.has(key) ? values.get(key) : null;
  },
  setItem(key, value) {
    values.set(key, String(value));
  },
  removeItem(key) {
    values.delete(key);
  },
};

beforeEach(() => values.clear());

function workspace() {
  return {
    activeBoardId: "board-1",
    boards: { "board-1": createInitialBoardState() },
    activeUserId: "user-1",
    users: { "user-1": { id: "user-1", name: "Thomas", initials: "TB", preferences: { theme: "system" } } },
  };
}

describe("Board-Persistenz", () => {
  test("speichert unter dem neutralen Key mit expliziter Schema-Version", () => {
    assert.equal(persistWorkspace(workspace()), true);
    const saved = JSON.parse(values.get(BOARD_STORAGE_KEY));

    assert.equal(BOARD_STORAGE_KEY, "jadydoco.board");
    assert.equal(saved.version, BOARD_SCHEMA_VERSION);
    assert.equal(values.has(LEGACY_BOARD_STORAGE_KEY), false);
  });

  test("legt vor einem Import ein kanonisches Workspace-Backup an", () => {
    const current = workspace();

    assert.equal(backupWorkspace(current), true);
    const backup = JSON.parse(values.get(BOARD_BACKUP_STORAGE_KEY));
    assert.equal(backup.version, BOARD_SCHEMA_VERSION);
    assert.equal(backup.boards["board-1"].project.name, "Product Board");
  });

  test("übernimmt Daten vom alten Key und entfernt ihn nach erfolgreicher Migration", () => {
    const saved = workspace();
    values.set(LEGACY_BOARD_STORAGE_KEY, JSON.stringify({
      version: 3,
      activeBoardId: saved.activeBoardId,
      boards: saved.boards,
      activeUserId: saved.activeUserId,
      users: saved.users,
    }));

    const loaded = loadWorkspace();

    assert.equal(loaded.boards["board-1"].project.name, saved.boards["board-1"].project.name);
    assert.equal(values.has(BOARD_STORAGE_KEY), true);
    assert.equal(values.has(LEGACY_BOARD_STORAGE_KEY), false);
  });

  test("bevorzugt den aktuellen Key, wenn beide Einträge existieren", () => {
    const current = workspace();
    current.boards["board-1"].project.name = "Aktuell";
    const legacy = workspace();
    legacy.boards["board-1"].project.name = "Alt";
    values.set(BOARD_STORAGE_KEY, JSON.stringify(current));
    values.set(LEGACY_BOARD_STORAGE_KEY, JSON.stringify(legacy));

    assert.equal(loadWorkspace().boards["board-1"].project.name, "Aktuell");
    assert.equal(values.has(LEGACY_BOARD_STORAGE_KEY), true);
  });

  test("repariert inkonsistente Referenzen und sichert das Original", () => {
    const damaged = workspace();
    damaged.version = 3;
    damaged.activeUserId = "missing-user";
    damaged.boards["board-1"].project.ownerId = "missing-user";
    damaged.boards["board-1"].project.memberIds = ["missing-user", "user-1"];
    damaged.boards["board-1"].columns[0].taskIds = ["KAN-18", "KAN-18", "missing-task"];
    damaged.boards["board-1"].columns[1].taskIds.push("KAN-18");
    damaged.boards["board-1"].tasks["KAN-21"].assigneeId = "missing-user";
    const original = JSON.stringify(damaged);
    values.set(BOARD_STORAGE_KEY, original);

    const loaded = loadWorkspace();
    const board = loaded.boards["board-1"];
    const occurrences = board.columns.flatMap(({ taskIds }) => taskIds)
      .filter((id) => id === "KAN-18").length;

    assert.equal(loaded.activeUserId, "user-1");
    assert.equal(board.project.ownerId, "user-1");
    assert.deepEqual(board.project.memberIds, ["user-1"]);
    assert.equal(occurrences, 1);
    assert.equal(board.columns.some(({ taskIds }) => taskIds.includes("missing-task")), false);
    assert.equal(board.tasks["KAN-21"].assigneeId, null);
    assert.equal(values.get(BOARD_BACKUP_STORAGE_KEY), original);
    assert.equal(JSON.parse(values.get(BOARD_STORAGE_KEY)).version, BOARD_SCHEMA_VERSION);
  });

  test("ordnet gültige verwaiste Tasks der ersten Stage zu", () => {
    const saved = workspace();
    saved.version = BOARD_SCHEMA_VERSION;
    saved.boards["board-1"].columns.forEach((column) => {
      column.taskIds = column.taskIds.filter((id) => id !== "KAN-18");
    });
    values.set(BOARD_STORAGE_KEY, JSON.stringify(saved));

    const loaded = loadWorkspace();

    assert.equal(loaded.boards["board-1"].columns[0].taskIds.includes("KAN-18"), true);
  });

  test("fällt bei ungültigem JSON sicher zurück und bewahrt die Rohdaten", () => {
    values.set(BOARD_STORAGE_KEY, "{invalid-json");

    const loaded = loadWorkspace();

    assert.equal(loaded.activeBoardId, "board-1");
    assert.equal(values.get(BOARD_BACKUP_STORAGE_KEY), "{invalid-json");
  });

  test("überschreibt Daten einer neueren Schema-Version nicht", () => {
    const future = { ...workspace(), version: BOARD_SCHEMA_VERSION + 1 };
    const original = JSON.stringify(future);
    values.set(BOARD_STORAGE_KEY, original);

    const loaded = loadWorkspace();

    assert.equal(loaded.activeBoardId, "board-1");
    assert.equal(values.get(BOARD_STORAGE_KEY), original);
    assert.equal(values.get(BOARD_BACKUP_STORAGE_KEY), original);
  });
});
