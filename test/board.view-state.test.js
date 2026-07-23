import assert from "node:assert/strict";
import { test } from "node:test";

import { createInitialBoardState } from "../src/board/board.state.js";
import { createBoardViewState } from "../src/board/board.view-state.js";

test("Domain-State und flüchtiger Board-View-State sind getrennt", () => {
  const state = createInitialBoardState();
  const viewState = createBoardViewState(state.columns[0].id);

  assert.equal("ui" in state, false);
  assert.equal(viewState.createTaskColumnId, "backlog");
  assert.equal(viewState.viewMode, "board");
  assert.deepEqual(viewState.listSort, { key: "id", direction: "asc" });
  assert.deepEqual(viewState.filters, {
    query: "", priority: "all", category: "all", assigneeId: "all",
  });

  viewState.selectedTaskId = "KAN-18";
  assert.equal("selectedTaskId" in state, false);
});
