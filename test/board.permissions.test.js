import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAssignTask, canClaimTask, canConfigureBoard, canCreateTask, canDeleteTask,
  canEditTask, canReleaseTask, canViewTask, canWorkOnTask, isBoardMember,
} from "../src/board/board.permissions.js";
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

  it("trennt Lesen, Arbeiten und Konfigurieren eines zugewiesenen Tasks", () => {
    const state = createInitialBoardState();
    state.project.ownerId = "owner";
    state.project.memberIds = ["owner", "assignee", "member"];
    state.tasks["KAN-18"].assigneeId = "assignee";

    assert.equal(canCreateTask(state, "member"), true);
    assert.equal(canViewTask(state, "KAN-18", "member"), true);
    assert.equal(canWorkOnTask(state, "KAN-18", "member"), false);
    assert.equal(canEditTask(state, "KAN-18", "assignee"), true);
    assert.equal(canWorkOnTask(state, "KAN-18", "owner"), true);
    assert.equal(canAssignTask(state, "KAN-18", "owner"), true);
    assert.equal(canAssignTask(state, "KAN-18", "assignee"), false);
    assert.equal(canDeleteTask(state, "KAN-18", "owner"), true);
    assert.equal(canDeleteTask(state, "KAN-18", "assignee"), false);
    assert.equal(canViewTask(state, "KAN-18", "outsider"), false);
  });

  it("erlaubt Mitgliedern die Übernahme freier Tasks und Bearbeitern die Rückgabe", () => {
    const state = createInitialBoardState();
    state.project.ownerId = "owner";
    state.project.memberIds = ["owner", "member"];
    state.tasks["KAN-18"].assigneeId = null;

    assert.equal(canClaimTask(state, "KAN-18", "member"), true);
    assert.equal(canReleaseTask(state, "KAN-18", "member"), false);
    state.tasks["KAN-18"].assigneeId = "member";
    assert.equal(canClaimTask(state, "KAN-18", "member"), false);
    assert.equal(canReleaseTask(state, "KAN-18", "member"), true);
    assert.equal(canReleaseTask(state, "KAN-18", "owner"), true);
  });
});
