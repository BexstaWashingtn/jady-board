import { countActiveFilters, countTasksByFacet } from "../../board/board.state.js";

/** @typedef {{ setFilter: (key: "query"|"priority"|"category"|"assigneeId", value: string) => void, clearFilters: () => void }} FilterActions */

/**
 * @param {import("../../board/board.state.js").BoardState} state
 * @param {import("../../board/board.view-state.js").BoardViewState} viewState
 * @param {FilterActions} actions
 * @param {Array<{id: string, name: string}>} users
 * @returns {import("../../core/JaDyDoCo.js").JaDyNode[]}
 */
export function createFilterControls(state, viewState, actions, users) {
  const categories = uniqueTaskValues(state, "category");
  const assignees = /** @type {string[]} */ ([...new Set(Object.values(state.tasks).map((task) => task.assigneeId).filter(Boolean))]);
  const activeCount = countActiveFilters(viewState.filters);
  const priorityCounts = countTasksByFacet(state, "priority", viewState.filters);
  const categoryCounts = countTasksByFacet(state, "category", viewState.filters);
  const assigneeCounts = countTasksByFacet(state, "assigneeId", viewState.filters);
  return [
    { tagName: "label", class: "search-field", children: [
      { tagName: "span", class: "search-field__icon", text: "⌕" },
      { tagName: "input", type: "search", name: "query", value: viewState.filters.query, placeholder: "Aufgaben suchen …", autocomplete: "off", attrs: { "aria-label": "Aufgaben suchen" }, events: {
        input: (event) => {
          if (event.currentTarget instanceof HTMLInputElement) actions.setFilter("query", event.currentTarget.value);
        },
        keydown: (event) => {
          if (event instanceof KeyboardEvent && event.key === "Escape") {
            event.preventDefault();
            actions.clearFilters();
          }
        },
      } },
    ] },
    filterSelect("priority", "Priorität", [
      facetOption("all", "Alle Prioritäten", priorityCounts, viewState.filters.priority),
      facetOption("high", "Hoch", priorityCounts, viewState.filters.priority),
      facetOption("medium", "Mittel", priorityCounts, viewState.filters.priority),
      facetOption("low", "Niedrig", priorityCounts, viewState.filters.priority),
    ], viewState.filters.priority, actions),
    filterSelect("category", "Kategorie", [facetOption("all", "Alle Kategorien", categoryCounts, viewState.filters.category), ...categories.map((value) => facetOption(value, value, categoryCounts, viewState.filters.category))], viewState.filters.category, actions),
    filterSelect("assigneeId", "Bearbeiter", [facetOption("all", "Alle Personen", assigneeCounts, viewState.filters.assigneeId), facetOption("", "Nicht zugewiesen", assigneeCounts, viewState.filters.assigneeId), ...assignees.map((value) => facetOption(value, users.find((user) => user.id === value)?.name ?? "Unbekannt", assigneeCounts, viewState.filters.assigneeId))], viewState.filters.assigneeId, actions),
    { tagName: "button", type: "button", class: "clear-filters", text: activeCount ? `Filter zurücksetzen (${activeCount})` : "Filter zurücksetzen", disabled: activeCount === 0, events: { click: actions.clearFilters } },
  ];
}

/** @param {string} value @param {string} label @param {Record<string, number>} counts @param {string} selectedValue @returns {import("../../core/JaDyDoCo.js").SelectOption} */
function facetOption(value, label, counts, selectedValue) {
  const count = counts[value] ?? 0;
  return { value, text: `${label} (${count})`, disabled: value !== "all" && value !== selectedValue && count === 0 };
}

/** @param {"priority"|"category"|"assigneeId"} name @param {string} label @param {import("../../core/JaDyDoCo.js").SelectOption[]} options @param {string} selectedValue @param {FilterActions} actions @returns {import("../../core/JaDyDoCo.js").JaDyNode} */
function filterSelect(name, label, options, selectedValue, actions) {
  return { tagName: "select", class: "filter-select", name, attrs: { "aria-label": label }, options: options.map((option) => ({ ...option, selected: option.value === selectedValue })), events: {
    change: (event) => {
      if (event.currentTarget instanceof HTMLSelectElement) actions.setFilter(name, event.currentTarget.value);
    },
  } };
}

/** @param {import("../../board/board.state.js").BoardState} state @param {"category"} key */
function uniqueTaskValues(state, key) {
  return [...new Set(Object.values(state.tasks).map((task) => task[key]))].sort((a, b) => a.localeCompare(b, "de"));
}

