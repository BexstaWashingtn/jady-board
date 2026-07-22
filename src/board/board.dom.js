import { countActiveFilters, countTasksByFacet } from "./board.state.js";

export function clearDropTargets() {
  document.querySelectorAll(".kanban-column--drop-target").forEach((element) => {
    element.classList.remove("kanban-column--drop-target");
    if (element instanceof HTMLElement) delete element.dataset.dropIndex;
  });
  document.querySelectorAll(".task-card--drop-before").forEach((element) => element.classList.remove("task-card--drop-before"));
  document.querySelectorAll(".kanban-column--drop-at-end").forEach((element) => element.classList.remove("kanban-column--drop-at-end"));
  document.querySelectorAll(".kanban-column--drop-rejected").forEach((element) => {
    element.classList.remove("kanban-column--drop-rejected");
    if (element instanceof HTMLElement) delete element.dataset.dropRejection;
  });
}

/** @param {HTMLElement} column @param {number} pointerY */
export function updateDropPosition(column, pointerY) {
  document.querySelectorAll(".task-card--drop-before").forEach((element) => element.classList.remove("task-card--drop-before"));
  document.querySelectorAll(".kanban-column--drop-at-end").forEach((element) => element.classList.remove("kanban-column--drop-at-end"));

  const cards = [...column.querySelectorAll(".task-card:not(.task-card--dragging)")];
  const targetIndex = cards.findIndex((card) => {
    const rect = card.getBoundingClientRect();
    return pointerY < rect.top + rect.height / 2;
  });
  const index = targetIndex === -1 ? cards.length : targetIndex;
  column.dataset.dropIndex = String(index);
  if (targetIndex === -1) column.classList.add("kanban-column--drop-at-end");
  else cards[targetIndex].classList.add("task-card--drop-before");
}

/** @param {import("./board.state.js").BoardFilters} filters */
export function syncFilterControls(filters) {
  const form = document.querySelector(".filter-bar");
  if (!(form instanceof HTMLFormElement)) return;
  setFormValue(form, "query", filters.query);
  setFormValue(form, "priority", filters.priority);
  setFormValue(form, "category", filters.category);
  setFormValue(form, "assignee", filters.assignee);
  updateClearFilterButton(filters);
}

/** @param {HTMLFormElement} form @param {string} name @param {string} value */
function setFormValue(form, name, value) {
  const control = form.elements.namedItem(name);
  if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement) control.value = value;
}

/** @param {import("./board.state.js").BoardFilters} filters */
export function updateClearFilterButton(filters) {
  const button = document.querySelector(".clear-filters");
  if (!(button instanceof HTMLButtonElement)) return;
  const count = countActiveFilters(filters);
  button.disabled = count === 0;
  button.textContent = count ? `Filter zurücksetzen (${count})` : "Filter zurücksetzen";
}

/** @param {import("./board.state.js").BoardState} state @param {import("./board.state.js").BoardFilters} filters */
export function updateFilterOptionCounts(state, filters) {
  /** @type {Array<"priority" | "category" | "assignee">} */
  const facets = ["priority", "category", "assignee"];
  for (const facet of facets) {
    const select = document.querySelector(`.filter-select[name="${facet}"]`);
    if (!(select instanceof HTMLSelectElement)) continue;
    const counts = countTasksByFacet(state, facet, filters);
    [...select.options].forEach((option) => {
      const label = option.textContent.replace(/\s+\(\d+\)$/, "");
      const count = counts[option.value] ?? 0;
      option.textContent = `${label} (${count})`;
      option.disabled = option.value !== "all" && option.value !== select.value && count === 0;
    });
  }
}
