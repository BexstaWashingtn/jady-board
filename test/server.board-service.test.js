import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createBoardService } from "../server/src/modules/boards/board.service.js";

describe("Board-Service", () => {
  test("mappt die Board-Liste auf den öffentlichen Vertrag", async () => {
    const service = createBoardService({
      async listForUser() {
        return [{ id: BOARD_ID, name: "Produkt", path: "Boards / Produkt", description: "Plan", role: "owner", version: "2", stage_count: "4", task_count: "9" }];
      },
      async findForUser() { return null; },
    });

    assert.deepEqual(await service.listBoards(USER_ID), [{
      id: BOARD_ID, name: "Produkt", path: "Boards / Produkt", description: "Plan",
      role: "owner", version: 2, stageCount: 4, taskCount: 9,
    }]);
  });

  test("setzt relationale Board-Daten einschließlich Übergangssemantik zusammen", async () => {
    const service = createBoardService({
      async listForUser() { return []; },
      async findForUser() {
        return {
          board: { id: BOARD_ID, name: "Produkt", path: "Boards / Produkt", description: "Plan", owner_id: USER_ID, task_prefix: "KAN", version: 3, role: "owner" },
          members: [{ id: USER_ID, display_name: "Thomas", initials: "TB", role: "owner" }],
          stages: [
            { id: STAGE_ID, title: "Backlog", color: "#9297a0", kind: "backlog", wip_limit: null, wip_limit_mode: "warning", require_completed_todos: false, transitions_restricted: true, version: 1 },
            { id: TARGET_STAGE_ID, title: "Erledigt", color: "#57b894", kind: "done", wip_limit: 3, wip_limit_mode: "strict", require_completed_todos: true, transitions_restricted: false, version: 2 },
          ],
          tasks: [{ id: TASK_ID, stage_id: STAGE_ID, task_number: 18, title: "API", category: "Core", priority: "high", assignee_id: USER_ID, due_date: "2026-08-10", comments_count: 2, version: 4 }],
          todos: [{ id: TODO_ID, task_id: TASK_ID, text: "Testen", completed: true }],
          transitions: [{ source_stage_id: STAGE_ID, target_stage_id: TARGET_STAGE_ID }],
        };
      },
    });

    const board = await service.getBoard(BOARD_ID, USER_ID);

    assert.equal(board?.tasks[TASK_ID].key, "KAN-18");
    assert.deepEqual(board?.tasks[TASK_ID].todos, [{ id: TODO_ID, text: "Testen", completed: true }]);
    assert.deepEqual(board?.columns[0].allowedTargetIds, [TARGET_STAGE_ID]);
    assert.equal(board?.columns[1].allowedTargetIds, null);
    assert.deepEqual(board?.columns[0].taskIds, [TASK_ID]);
    assert.equal(board?.project.ownerId, USER_ID);
  });

  test("gibt für ein nicht zugängliches Board null zurück", async () => {
    const service = createBoardService({
      async listForUser() { return []; },
      async findForUser() { return null; },
    });
    assert.equal(await service.getBoard(BOARD_ID, USER_ID), null);
  });
  test("aktualisiert Task-Metadaten mit optimistischer Versionsprüfung", async () => {
    let received;
    const service = createBoardService({
      async listForUser() { return []; }, async findForUser() { return null; },
      async findTaskForUser() { return { id: TASK_ID, assignee_id: USER_ID, version: 4, role: "member" }; },
      async updateTaskMetadata(boardId, taskId, version, changes) {
        received = { boardId, taskId, version, changes };
        return { id: taskId, ...changes, due_date: changes.dueDate, assignee_id: USER_ID, version: 5 };
      },
    });
    const result = await service.updateTask(BOARD_ID, TASK_ID, USER_ID, {
      title: " API schreiben ", category: "Backend", priority: "high", dueDate: "2026-08-15", version: 4,
    });
    assert.equal(result.status, "updated");
    assert.equal(result.status === "updated" && result.task.version, 5);
    assert.deepEqual(received, {
      boardId: BOARD_ID, taskId: TASK_ID, version: 4,
      changes: { title: "API schreiben", category: "Backend", priority: "high", dueDate: "2026-08-15", version: 4 },
    });
  });

  test("weist ungültige, unberechtigte und veraltete Task-Updates zurück", async () => {
    const repository = {
      async listForUser() { return []; }, async findForUser() { return null; },
      async findTaskForUser() { return { id: TASK_ID, assignee_id: null, version: 3, role: "member" }; },
      async updateTaskMetadata() { throw new Error("must not update"); },
    };
    const service = createBoardService(repository);
    const valid = { title: "Task", category: "Core", priority: "medium", dueDate: null, version: 3 };
    assert.equal((await service.updateTask(BOARD_ID, TASK_ID, USER_ID, { ...valid, title: "" })).status, "invalid");
    assert.equal((await service.updateTask(BOARD_ID, TASK_ID, USER_ID, valid)).status, "forbidden");
    repository.findTaskForUser = async () => ({ id: TASK_ID, assignee_id: USER_ID, version: 4, role: "member" });
    assert.equal((await service.updateTask(BOARD_ID, TASK_ID, USER_ID, valid)).status, "conflict");
  });
});

const USER_ID = "8acf3017-cf6e-589b-bd47-a1d8ccec16a8";
const BOARD_ID = "46ed3b71-86cb-5eb7-a01e-dd5885e41c6a";
const STAGE_ID = "39f804e9-4ac3-58da-a623-a161d97182e7";
const TARGET_STAGE_ID = "c358d08d-6fdd-5752-8fe2-a4004c0e5ad9";
const TASK_ID = "912e8124-aa18-5848-bac7-3486be614b78";
const TODO_ID = "fe659c0c-b709-59e9-9ff7-d42d1d35afbf";
