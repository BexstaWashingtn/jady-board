import { createEmptyFilters } from "../board.state.js";
import { syncFilterControls, updateClearFilterButton, updateFilterOptionCounts } from "../board.dom.js";

/** @param {import("./action-context.js").BoardActionContext} context */
export function createFilterActions(context) {
  return {
    /** @param {"board" | "list"} mode */
    setViewMode(mode) {
      if (mode !== "board" && mode !== "list") return;
      context.viewState().viewMode = mode;
      context.render();
    },

    /** @param {import("../board.view-state.js").ListSortKey} key */
    setListSort(key) {
      const sort = context.viewState().listSort;
      context.viewState().listSort = sort.key === key
        ? { key, direction: sort.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" };
      context.renderBoardContent();
    },

    /** @param {"query" | "priority" | "category" | "assigneeId"} key @param {string} value */
    setFilter(key, value) {
      const viewState = context.viewState();
      viewState.filters[key] = value;
      updateClearFilterButton(viewState.filters);
      updateFilterOptionCounts(context.state(), viewState.filters);
      context.renderBoardContent();
    },

    clearFilters() {
      const viewState = context.viewState();
      viewState.filters = createEmptyFilters();
      syncFilterControls(viewState.filters);
      updateFilterOptionCounts(context.state(), viewState.filters);
      context.renderBoardContent();
    },
  };
}
