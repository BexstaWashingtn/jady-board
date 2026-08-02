import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, test } from "node:test";

import { createDatabase } from "../server/src/db/database.js";
import { createWorkspaceImportPlan, importWorkspace } from "../server/src/db/workspace-import.js";
import { createApiHandler } from "../server/src/http/app.js";
import { createBoardRepository } from "../server/src/modules/boards/board.repository.js";
import { createBoardService } from "../server/src/modules/boards/board.service.js";
import { createInitialBoardState } from "../src/board/board.state.js";
import { serializeWorkspaceBackup } from "../src/board/board.transfer.js";

const databaseUrl = process.env.DATABASE_URL_TEST;
const database = databaseUrl ? createDatabase({ databaseUrl, databaseSsl: false }) : null;
const plan = createWorkspaceImportPlan(backupSource());
const userId = plan.users[0].id;
const boardId = plan.boards[0].id;
/** @type {import("node:http").Server|null} */
let server = null;
let baseUrl = "";

before(async () => {
  if (!database) return;
  await cleanup();
  await importWorkspace(database, plan);
  const boardService = createBoardService(createBoardRepository(database));
  server = createServer(createApiHandler({ database, boardService, currentUserId: userId }));
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server has no TCP address.");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (!database) return;
  await cleanup();
  await database.end();
});

test("liefert importierte Boards durch den vollständigen Lese-API-Stack", { skip: !database }, async () => {
  const listResponse = await fetch(`${baseUrl}/api/boards`);
  assert.equal(listResponse.status, 200);
  const list = await listResponse.json();
  assert.equal(list.boards.length, 1);
  assert.deepEqual(list.boards[0], {
    id: boardId, name: "API Integration", path: "/api-integration",
    description: "PostgreSQL bis HTTP", role: "owner", version: 1,
    stageCount: 4, taskCount: 1,
  });

  const detailResponse = await fetch(`${baseUrl}/api/boards/${boardId}`);
  assert.equal(detailResponse.status, 200);
  const { board } = await detailResponse.json();
  const task = Object.values(board.tasks)[0];
  assert.equal(board.id, boardId);
  assert.equal(board.project.ownerId, userId);
  assert.equal(board.members[0].name, "API User");
  assert.equal(task.key, "API-11");
  assert.equal(task.todos[0].text, "End-to-End prüfen");
  assert.equal(board.columns[0].taskIds.length, 1);
});

test("persistiert Task-Metadaten mit Versionsschutz in PostgreSQL", { skip: !database }, async () => {
  const detailResponse = await fetch(`${baseUrl}/api/boards/${boardId}`);
  const { board } = await detailResponse.json();
  const task = Object.values(board.tasks)[0];
  const response = await fetch(`${baseUrl}/api/boards/${boardId}/tasks/${task.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Schreibpfad getestet", category: "Integration", priority: "medium",
      dueDate: null, version: task.version,
    }),
  });
  assert.equal(response.status, 200);
  const updated = (await response.json()).task;
  assert.equal(updated.title, "Schreibpfad getestet");
  assert.equal(updated.version, task.version + 1);

  const staleResponse = await fetch(`${baseUrl}/api/boards/${boardId}/tasks/${task.id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Veraltet", category: "Integration", priority: "low", dueDate: null, version: task.version }),
  });
  assert.equal(staleResponse.status, 409);
});

test("verschiebt einen Task transaktional in PostgreSQL", { skip: !database }, async () => {
  const detailResponse = await fetch(`${baseUrl}/api/boards/${boardId}`);
  const { board } = await detailResponse.json();
  const task = Object.values(board.tasks)[0];
  const target = board.columns[1];
  const response = await fetch(`${baseUrl}/api/boards/${boardId}/tasks/${task.id}/position`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stageId: target.id, targetIndex: 0, version: task.version }),
  });
  assert.equal(response.status, 200);
  const moved = (await response.json()).task;
  assert.equal(moved.stageId, target.id);
  assert.equal(moved.position, 0);
  assert.equal(moved.version, task.version + 1);

  const refreshed = (await (await fetch(`${baseUrl}/api/boards/${boardId}`)).json()).board;
  assert.deepEqual(refreshed.columns[1].taskIds, [task.id]);
  assert.equal(refreshed.columns[0].taskIds.includes(task.id), false);
});

async function cleanup() {
  if (!database) return;
  await database.query("DELETE FROM workspace_imports WHERE fingerprint = $1", [plan.fingerprint]);
  await database.query("DELETE FROM boards WHERE id = ANY($1::uuid[])", [plan.boards.map(({ id }) => id)]);
  await database.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [plan.users.map(({ id }) => id)]);
}

function backupSource() {
  const board = createInitialBoardState();
  board.project = {
    name: "API Integration", path: "/api-integration", description: "PostgreSQL bis HTTP",
    ownerId: "api-user", memberIds: ["api-user"],
  };
  board.tasks = {
    "API-11": {
      id: "API-11", title: "Lesepfad testen", category: "Test", priority: "high",
      comments: 2, todos: [{ id: "api-todo", text: "End-to-End prüfen", completed: true }],
      dueDate: "2026-08-12", assigneeId: "api-user",
    },
  };
  board.columns[0].taskIds = ["API-11"];
  board.columns.slice(1).forEach((column) => { column.taskIds = []; });
  return serializeWorkspaceBackup({
    activeBoardId: "api-board", boards: { "api-board": board }, activeUserId: "api-user",
    users: {
      "api-user": { id: "api-user", name: "API User", initials: "AU", preferences: { theme: "system" } },
    },
  }, new Date("2026-08-02T00:00:00.000Z"));
}
