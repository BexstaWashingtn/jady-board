import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canConfigureBoard, isBoardMember } from "../src/board/board.permissions.js";
import { createInitialBoardState } from "../src/board/board.state.js";

describe("Board-Berechtigungen", () => {
  it("erlaubt ausschließlich dem Owner die Board-Konfiguration", () => {
    const state = createInitialBoardState();
    state.project.ownerId = "owner";
    state.project.memberIds = ["owner", "member"];

    assert.equal(canConfigureBoard(state, "owner"), true);
    assert.equal(canConfigureBoard(state, "member"), false);
    assert.equal(canConfigureBoard(state, ""), false);
  });

  it("erkennt Board-Mitglieder unabhängig von ihrer Owner-Rolle", () => {
    const state = createInitialBoardState();
    state.project.memberIds = ["owner", "member"];

    assert.equal(isBoardMember(state, "owner"), true);
    assert.equal(isBoardMember(state, "member"), true);
    assert.equal(isBoardMember(state, "outsider"), false);
  });
});
