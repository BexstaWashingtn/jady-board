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
  test("verschiebt Tasks nach zentraler Prüfung der Workflow-Regeln", async () => {
    let received;
    const service = createBoardService({
      async listForUser() { return []; }, async findForUser() { return null; },
      async findTaskMoveContext() {
        return { id: TASK_ID, stage_id: STAGE_ID, assignee_id: USER_ID, version: 4, role: "member", target_stage_id: TARGET_STAGE_ID, transition_allowed: true, require_completed_todos: true, open_todo_count: 0, wip_limit: 2, wip_limit_mode: "strict", target_count: 1 };
      },
      async moveTask(...args) { received = args; return { id: TASK_ID, stage_id: TARGET_STAGE_ID, position: 1, version: 5 }; },
    });
    const result = await service.moveTask(BOARD_ID, TASK_ID, USER_ID, { stageId: TARGET_STAGE_ID, version: 4 });
    assert.deepEqual(received, [BOARD_ID, TASK_ID, TARGET_STAGE_ID, 1, 4]);
    assert.deepEqual(result, { status: "moved", task: { id: TASK_ID, stageId: TARGET_STAGE_ID, position: 1, version: 5 } });
  });

  test("blockiert unerlaubte Übergänge, offene Todos und harte WIP-Limits", async () => {
    const context = { id: TASK_ID, stage_id: STAGE_ID, assignee_id: USER_ID, version: 4, role: "member", target_stage_id: TARGET_STAGE_ID, transition_allowed: false, require_completed_todos: false, open_todo_count: 0, wip_limit: null, wip_limit_mode: "warning", target_count: 0 };
    const repository = {
      async listForUser() { return []; }, async findForUser() { return null; },
      async findTaskMoveContext() { return context; }, async moveTask() { throw new Error("must not move"); },
    };
    const service = createBoardService(repository);
    const input = { stageId: TARGET_STAGE_ID, version: 4 };
    assert.equal((await service.moveTask(BOARD_ID, TASK_ID, USER_ID, input)).status, "rejected");
    context.transition_allowed = true; context.require_completed_todos = true; context.open_todo_count = 1;
    assert.equal((await service.moveTask(BOARD_ID, TASK_ID, USER_ID, input)).status, "rejected");
    context.require_completed_todos = false; context.open_todo_count = 0; context.wip_limit = 1; context.wip_limit_mode = "strict"; context.target_count = 1;
    assert.equal((await service.moveTask(BOARD_ID, TASK_ID, USER_ID, input)).status, "rejected");
  });

  test("erstellt normalisierte Tasks mit serverseitiger UUID und Tasknummer", async () => {
    let received;
    const service = createBoardService({
      async listForUser() { return []; }, async findForUser() { return null; },
      async createTask(boardId, userId, input) {
        received = { boardId, userId, input };
        return { status: /** @type {const} */ ("created"), task: { ...input, task_prefix: "KAN", task_number: 19, stage_id: input.stageId, due_date: input.dueDate, assignee_id: input.assigneeId, position: 2, version: 1 } };
      },
    });
    const result = await service.createTask(BOARD_ID, USER_ID, { stageId: STAGE_ID, title: " Neu ", category: "Core", priority: "high", assigneeId: USER_ID, dueDate: null });
    assert.match(received.input.id, /^[0-9a-f-]{36}$/);
    assert.equal(result.status === "created" && result.task.key, "KAN-19");
    assert.equal(result.status === "created" && result.task.title, "Neu");
  });

  test("übersetzt ein hartes WIP-Limit beim Erstellen", async () => {
    const service = createBoardService({
      async listForUser() { return []; }, async findForUser() { return null; },
      async createTask() { return { status: /** @type {const} */ ("wip_limit") }; },
    });
    const result = await service.createTask(BOARD_ID, USER_ID, { stageId: STAGE_ID, title: "Neu", category: "Core", priority: "medium" });
    assert.deepEqual(result, { status: "rejected", code: "WIP_LIMIT_REACHED", message: "The target stage has reached its WIP limit." });
  });

  test("erlaubt Selbstübernahme und versionierte Zuweisung", async () => {
    let received;
    const service = createBoardService({
      async listForUser() { return []; }, async findForUser() { return null; },
      async findTaskForUser() { return { id: TASK_ID, assignee_id: null, version: 2, role: "member" }; },
      async isBoardMember() { return true; },
      async updateTaskAssignment(...args) { received = args; return { id: TASK_ID, assignee_id: USER_ID, version: 3 }; },
    });
    const result = await service.assignTask(BOARD_ID, TASK_ID, USER_ID, { assigneeId: USER_ID, version: 2 });
    assert.deepEqual(received, [BOARD_ID, TASK_ID, 2, USER_ID]);
    assert.deepEqual(result, { status: "updated", task: { id: TASK_ID, assigneeId: USER_ID, version: 3 } });
  });

  test("verbietet Mitgliedern die Zuweisung an andere Personen", async () => {
    const service = createBoardService({
      async listForUser() { return []; }, async findForUser() { return null; },
      async findTaskForUser() { return { id: TASK_ID, assignee_id: null, version: 2, role: "member" }; },
      async isBoardMember() { return true; }, async updateTaskAssignment() { throw new Error("must not update"); },
    });
    assert.equal((await service.assignTask(BOARD_ID, TASK_ID, USER_ID, { assigneeId: TARGET_STAGE_ID, version: 2 })).status, "forbidden");
  });

  test("synchronisiert Todos und ersetzt temporäre IDs", async () => {
    let received;
    const service = createBoardService({
      async listForUser() { return []; }, async findForUser() { return null; },
      async findTaskForUser() { return { id: TASK_ID, assignee_id: USER_ID, version: 2, role: "member" }; },
      async replaceTaskTodos(_boardId, _taskId, _version, todos) { received = todos; return { id: TASK_ID, version: 3, todos }; },
    });
    const result = await service.syncTaskTodos(BOARD_ID, TASK_ID, USER_ID, { version: 2, todos: [{ id: "temporary", text: " Testen ", completed: false }] });
    assert.match(received[0].id, /^[0-9a-f-]{36}$/);
    assert.equal(result.status === "updated" && result.task.todos[0].text, "Testen");
    assert.equal(result.status === "updated" && result.task.version, 3);
  });

  test("löscht Tasks ausschließlich als Owner und mit aktueller Version", async () => {
    let deleted = false;
    const repository = {
      async listForUser() { return []; }, async findForUser() { return null; },
      async findTaskForUser() { return { id: TASK_ID, version: 2, role: "owner" }; },
      async deleteTask() { deleted = true; return true; },
    };
    const service = createBoardService(repository);
    assert.deepEqual(await service.deleteTask(BOARD_ID, TASK_ID, USER_ID, "2"), { status: "deleted" });
    assert.equal(deleted, true);
    repository.findTaskForUser = async () => ({ id: TASK_ID, version: 2, role: "member" });
    assert.equal((await service.deleteTask(BOARD_ID, TASK_ID, USER_ID, 2)).status, "forbidden");
  });

  test("aktualisiert Stage-Regeln ausschließlich versioniert als Owner", async () => {
    let received;
    const service = createBoardService({
      async listForUser() { return []; }, async findForUser() { return null; },
      async findStageForUser() { return { id: STAGE_ID, version: 2, role: "owner" }; },
      async updateStage(...args) { received = args; return { id: STAGE_ID, title: "Review", color: "#336699", kind: "review", wip_limit: 2, wip_limit_mode: "strict", require_completed_todos: true, allowed_target_ids: [TARGET_STAGE_ID], version: 3 }; },
    });
    const input = { title: "Review", color: "#336699", kind: "review", limit: 2, limitMode: "strict", allowedTargetIds: [TARGET_STAGE_ID], requireCompletedTodos: true, version: 2 };
    const result = await service.updateStage(BOARD_ID, STAGE_ID, USER_ID, input);
    assert.equal(received[2], 2);
    assert.deepEqual(result.status === "updated" && result.stage.allowedTargetIds, [TARGET_STAGE_ID]);
    assert.equal(result.status === "updated" && result.stage.version, 3);
  });
});

const USER_ID = "8acf3017-cf6e-589b-bd47-a1d8ccec16a8";
const BOARD_ID = "46ed3b71-86cb-5eb7-a01e-dd5885e41c6a";
const STAGE_ID = "39f804e9-4ac3-58da-a623-a161d97182e7";
const TARGET_STAGE_ID = "c358d08d-6fdd-5752-8fe2-a4004c0e5ad9";
const TASK_ID = "912e8124-aa18-5848-bac7-3486be614b78";
const TODO_ID = "fe659c0c-b709-59e9-9ff7-d42d1d35afbf";
