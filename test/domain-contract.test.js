import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { canAcceptTasks, canMoveTaskTo } from "../src/board/board.state.js";
import { createBoardService } from "../server/src/modules/boards/board.service.js";

const BOARD_ID = "46ed3b71-86cb-5eb7-a01e-dd5885e41c6a";
const USER_ID = "8acf3017-cf6e-589b-bd47-a1d8ccec16a8";
const TASK_ID = "9e709c02-070a-5c5c-bc4e-7e4ea5d2e518";
const SOURCE_ID = "69e6279d-d32e-5aac-9c40-c50ea24e9d9d";
const TARGET_ID = "2de17850-e179-5dde-ae3c-506ed159597c";

describe("Client-/Server-Domain-Vertrag", () => {
  const cases = [
    { name: "freier Übergang", transition: true, completed: true, strict: false, count: 0, limit: null, allowed: true },
    { name: "gesperrter Übergang", transition: false, completed: true, strict: false, count: 0, limit: null, allowed: false },
    { name: "offene Todos am Abschluss-Gate", transition: true, completed: false, strict: false, count: 0, limit: null, allowed: false },
    { name: "erreichtes hartes WIP-Limit", transition: true, completed: true, strict: true, count: 2, limit: 2, allowed: false },
    { name: "warnendes WIP-Limit", transition: true, completed: true, strict: false, count: 2, limit: 2, allowed: true },
  ];

  for (const scenario of cases) {
    test(scenario.name, async () => {
      const state = createClientState(scenario);
      const clientAllows = canMoveTaskTo(state, TASK_ID, TARGET_ID)
        && canAcceptTasks(state, TARGET_ID, 1, TASK_ID);
      const service = createBoardService({
        async listForUser() { return []; },
        async findForUser() { return null; },
        async findTaskMoveContext() {
          return {
            id: TASK_ID, stage_id: SOURCE_ID, assignee_id: USER_ID, version: 1, role: "member",
            target_stage_id: TARGET_ID, transition_allowed: scenario.transition,
            require_completed_todos: true, open_todo_count: scenario.completed ? 0 : 1,
            wip_limit: scenario.limit, wip_limit_mode: scenario.strict ? "strict" : "warning",
            target_count: scenario.count,
          };
        },
        async moveTask() { return { id: TASK_ID, stage_id: TARGET_ID, position: scenario.count, version: 2 }; },
      });
      const serverResult = await service.moveTask(BOARD_ID, TASK_ID, USER_ID, { stageId: TARGET_ID, version: 1 });
      assert.equal(clientAllows, scenario.allowed);
      assert.equal(serverResult.status === "moved", scenario.allowed);
    });
  }
});

/** @param {{transition: boolean, completed: boolean, strict: boolean, count: number, limit: number|null}} scenario */
function createClientState(scenario) {
  const fillerIds = Array.from({ length: scenario.count }, (_, index) => `filler-${index}`);
  const tasks = Object.fromEntries(fillerIds.map((id) => [id, { id, title: id, category: "Test", priority: "medium", comments: 0, todos: [], dueDate: null, assigneeId: null }]));
  tasks[TASK_ID] = { id: TASK_ID, title: "Contract", category: "Test", priority: "medium", comments: 0, todos: [{ id: "todo", text: "Check", completed: scenario.completed }], dueDate: null, assigneeId: USER_ID };
  return {
    project: { name: "Contract", path: "", description: "", ownerId: USER_ID, memberIds: [USER_ID] },
    columns: [
      { id: SOURCE_ID, title: "Source", color: "#9297a0", kind: "active", limit: null, limitMode: "warning", allowedTargetIds: scenario.transition ? [TARGET_ID] : [], requireCompletedTodos: false, taskIds: [TASK_ID] },
      { id: TARGET_ID, title: "Target", color: "#57b894", kind: "done", limit: scenario.limit, limitMode: scenario.strict ? "strict" : "warning", allowedTargetIds: null, requireCompletedTodos: true, taskIds: fillerIds },
    ],
    tasks,
  };
}
