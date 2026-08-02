import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { createDatabase } from "../server/src/db/database.js";
import { createWorkspaceImportPlan, importWorkspace } from "../server/src/db/workspace-import.js";
import { createInitialBoardState } from "../src/board/board.state.js";
import { serializeWorkspaceBackup } from "../src/board/board.transfer.js";

const databaseUrl = process.env.DATABASE_URL_TEST;
const database = databaseUrl ? createDatabase({ databaseUrl, databaseSsl: false }) : null;
const plan = createWorkspaceImportPlan(backupSource());

before(async () => {
  if (database) await cleanup();
});

after(async () => {
  if (!database) return;
  await cleanup();
  await database.end();
});

test("importiert einen Workspace vollständig in PostgreSQL", { skip: !database }, async () => {
  if (!database) return;
  await importWorkspace(database, plan);

  const counts = await database.query(`
    SELECT
      (SELECT count(*)::int FROM users WHERE id = ANY($1::uuid[])) AS users,
      (SELECT count(*)::int FROM boards WHERE id = ANY($2::uuid[])) AS boards,
      (SELECT count(*)::int FROM stages WHERE board_id = ANY($2::uuid[])) AS stages,
      (SELECT count(*)::int FROM tasks WHERE board_id = ANY($2::uuid[])) AS tasks,
      (SELECT count(*)::int FROM task_todos WHERE task_id = ANY($3::uuid[])) AS todos,
      (SELECT count(*)::int FROM workspace_imports WHERE fingerprint = $4) AS imports
  `, [plan.users.map(({ id }) => id), plan.boards.map(({ id }) => id), plan.tasks.map(({ id }) => id), plan.fingerprint]);

  assert.deepEqual(counts.rows[0], { users: 1, boards: 1, stages: 4, tasks: 1, todos: 1, imports: 1 });
  await assert.rejects(importWorkspace(database, plan), /already imported/);
});

async function cleanup() {
  if (!database) return;
  await database.query("DELETE FROM workspace_imports WHERE fingerprint = $1", [plan.fingerprint]);
  await database.query("DELETE FROM boards WHERE id = ANY($1::uuid[])", [plan.boards.map(({ id }) => id)]);
  await database.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [plan.users.map(({ id }) => id)]);
}

function backupSource() {
  const board = createInitialBoardState();
  board.tasks = {
    "IMP-7": {
      id: "IMP-7", title: "Integration", category: "Test", priority: "medium",
      comments: 3, todos: [{ id: "todo-1", text: "Persistieren", completed: true }],
      dueDate: "2026-08-10", assigneeId: "integration-user",
    },
  };
  board.columns[0].taskIds = ["IMP-7"];
  board.columns.slice(1).forEach((column) => { column.taskIds = []; });
  board.project.ownerId = "integration-user";
  board.project.memberIds = ["integration-user"];
  return serializeWorkspaceBackup({
    activeBoardId: "integration-board",
    boards: { "integration-board": board },
    activeUserId: "integration-user",
    users: {
      "integration-user": { id: "integration-user", name: "Integration", initials: "IT", preferences: { theme: "dark" } },
    },
  }, new Date("2026-08-02T00:00:00.000Z"));
}
