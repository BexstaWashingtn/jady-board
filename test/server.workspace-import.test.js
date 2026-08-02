import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createInitialBoardState } from "../src/board/board.state.js";
import { serializeWorkspaceBackup } from "../src/board/board.transfer.js";
import { createWorkspaceImportPlan, importWorkspace } from "../server/src/db/workspace-import.js";

describe("Workspace-Importplanung", () => {
  test("bildet ein Backup vollständig und deterministisch auf relationale Zeilen ab", () => {
    const source = backupSource();
    const first = createWorkspaceImportPlan(source);
    const second = createWorkspaceImportPlan(source);

    assert.equal(first.fingerprint, second.fingerprint);
    assert.equal(first.importId, second.importId);
    assert.match(first.users[0].id, UUID_PATTERN);
    assert.equal(first.users[0].email, "user-1@local.jady.invalid");
    assert.equal(first.boards.length, 1);
    assert.equal(first.boards[0].path, "Projekte / Website 2.0");
    assert.equal(first.stages.length, 4);
    assert.equal(first.stages[0].transitionsRestricted, true);
    assert.equal(first.stages[1].transitionsRestricted, false);
    assert.equal(first.tasks.length, 1);
    assert.equal(first.tasks[0].sourceId, "KAN-18");
    assert.equal(first.tasks[0].taskNumber, 18);
    assert.equal(first.tasks[0].commentsCount, 2);
    assert.equal(first.todos.length, 1);
    assert.equal(first.transitions.length, 1);
  });

  test("vergibt eindeutige Präfixe und Tasknummern für uneinheitliche Legacy-IDs", () => {
    const workspace = workspaceFixture();
    const firstBoard = workspace.boards["board-1"];
    firstBoard.tasks = {
      "TASK-1": taskFixture("TASK-1"),
      "other": taskFixture("other"),
    };
    firstBoard.columns[0].taskIds = ["TASK-1", "other"];
    firstBoard.columns.slice(1).forEach((column) => { column.taskIds = []; });
    workspace.boards["board-2"] = structuredClone(firstBoard);
    workspace.boards["board-2"].project.name = "Zweites Board";

    const plan = createWorkspaceImportPlan(serializeWorkspaceBackup(workspace));

    assert.deepEqual(plan.boards.map(({ taskPrefix }) => taskPrefix), ["TASK", "TASK2"]);
    assert.deepEqual(plan.tasks.slice(0, 2).map(({ taskNumber }) => taskNumber), [1, 2]);
  });
});

describe("Workspace-Datenbankimport", () => {
  test("schreibt alle Bereiche in einer Transaktion", async () => {
    const plan = createWorkspaceImportPlan(backupSource());
    const harness = databaseHarness();

    await importWorkspace(harness.database, plan);

    assert.equal(harness.statements[0], "BEGIN");
    assert.equal(harness.statements.at(-1), "COMMIT");
    assert.equal(harness.statements.some((sql) => sql.includes("INSERT INTO workspace_imports")), true);
    assert.equal(harness.released, true);
  });

  test("weist doppelte Backups zurück und rollt zurück", async () => {
    const plan = createWorkspaceImportPlan(backupSource());
    const harness = databaseHarness(true);

    await assert.rejects(importWorkspace(harness.database, plan), /already imported/);

    assert.deepEqual(harness.statements, [
      "BEGIN",
      "SELECT 1 FROM workspace_imports WHERE fingerprint = $1",
      "ROLLBACK",
    ]);
    assert.equal(harness.released, true);
  });
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function backupSource() {
  return serializeWorkspaceBackup(workspaceFixture(), new Date("2026-07-23T10:15:00.000Z"));
}

function workspaceFixture() {
  const board = createInitialBoardState();
  board.tasks = { "KAN-18": { ...taskFixture("KAN-18"), comments: 2, todos: [{ id: "todo-1", text: "Prüfen", completed: false }] } };
  board.columns[0].taskIds = ["KAN-18"];
  board.columns[0].allowedTargetIds = [board.columns[1].id];
  board.columns.slice(1).forEach((column) => { column.taskIds = []; });
  return {
    activeBoardId: "board-1",
    boards: { "board-1": board },
    activeUserId: "user-1",
    users: {
      "user-1": { id: "user-1", name: "Thomas", initials: "TB", preferences: { theme: "system" } },
    },
  };
}

/** @param {string} id */
function taskFixture(id) {
  return { id, title: "Importieren", category: "Core", priority: "high", comments: 0, todos: [], dueDate: null, assigneeId: "user-1" };
}

/** @param {boolean} [duplicate] */
function databaseHarness(duplicate = false) {
  const statements = [];
  let released = false;
  const client = {
    async query(sql) {
      const statement = String(sql).replace(/\s+/g, " ").trim();
      statements.push(statement);
      if (statement === "SELECT 1 FROM workspace_imports WHERE fingerprint = $1") {
        return { rowCount: duplicate ? 1 : 0, rows: duplicate ? [{ "?column?": 1 }] : [] };
      }
      return { rowCount: 1, rows: [] };
    },
    release() { released = true; },
  };
  return {
    statements,
    get released() { return released; },
    database: { async connect() { return client; } },
  };
}
