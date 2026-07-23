import { createEmptyFilters } from "../board.state.js";
import { syncFilterControls, updateClearFilterButton, updateFilterOptionCounts } from "../board.dom.js";

/** @param {import("./action-context.js").BoardActionContext} context */
export function createFilterActions(context) {
  return {
    /** @param {"query" | "priority" | "category" | "assigneeId"} key @param {string} value */
    setFilter(key, value) {
      const viewState = context.viewState();
      viewState.filters[key] = value;
      updateClearFilterButton(viewState.filters);
      updateFilterOptionCounts(context.state(), viewState.filters);
      context.renderKanban();
    },

    clearFilters() {
      const viewState = context.viewState();
      viewState.filters = createEmptyFilters();
      syncFilterControls(viewState.filters);
      updateFilterOptionCounts(context.state(), viewState.filters);
      context.renderKanban();
    },
  };
}
