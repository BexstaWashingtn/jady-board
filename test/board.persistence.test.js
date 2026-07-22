import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

import { loadWorkspace, persistWorkspace } from "../src/board/board.persistence.js";
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
});
