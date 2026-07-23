import { getDueDateStatus, matchesTaskFilters } from "../../board/board.state.js";

/**
 * @param {import("../../board/board.state.js").BoardState} state
 * @param {import("../../board/board.view-state.js").BoardViewState} viewState
 * @param {import("./board.types.js").BoardActions} actions
 * @param {import("./board.types.js").UserView[]} users
 * @returns {import("../../core/JaDyDoCo.js").JaDyNode}
 */
export function createTaskList(state, viewState, actions, users) {
  const rows = Object.values(state.tasks)
    .filter((task) => matchesTaskFilters(task, viewState.filters))
    .map((task) => ({
      task,
      column: state.columns.find(({ taskIds }) => taskIds.includes(task.id)),
      assignee: users.find(({ id }) => id === task.assigneeId),
    }))
    .sort((left, right) => compareRows(left, right, viewState.listSort));

  return {
    tagName: "section",
    class: "task-list-view",
    attrs: { "aria-label": "Task-Liste" },
    children: [
      { tagName: "div", class: "task-list-view__summary", text: `${rows.length} ${rows.length === 1 ? "Task" : "Tasks"}` },
      rows.length ? {
        tagName: "div",
        class: "task-table-wrap",
        children: [{
          tagName: "table",
          class: "task-table",
          children: [
            { tagName: "thead", children: [{ tagName: "tr", children: [
              sortHeader("id", "ID", viewState, actions),
              sortHeader("title", "Titel", viewState, actions),
              sortHeader("column", "Status", viewState, actions),
              sortHeader("priority", "Priorität", viewState, actions, "task-table__optional"),
              { tagName: "th", class: "task-table__optional", text: "Kategorie" },
              sortHeader("assignee", "Bearbeiter", viewState, actions),
              sortHeader("dueDate", "Fällig", viewState, actions),
              { tagName: "th", class: "task-table__optional", text: "Todos" },
            ] }] },
            { tagName: "tbody", children: rows.map(({ task, column, assignee }) => taskRow(task, column, assignee, actions)) },
          ],
        }],
      } : {
        tagName: "div",
        class: "task-list-empty",
        children: [
          { tagName: "strong", text: "Keine Aufgaben gefunden" },
          { tagName: "p", text: "Passe die Filter an oder erstelle eine neue Aufgabe." },
        ],
      },
    ],
  };
}

/**
 * @param {import("../../board/board.view-state.js").ListSortKey} key
 * @param {string} label
 * @param {import("../../board/board.view-state.js").BoardViewState} viewState
 * @param {import("./board.types.js").BoardActions} actions
 * @param {string} [className]
 * @returns {import("../../core/JaDyDoCo.js").JaDyNode}
 */
function sortHeader(key, label, viewState, actions, className) {
  const active = viewState.listSort.key === key;
  const direction = active ? viewState.listSort.direction : null;
  return {
    tagName: "th",
    class: className,
    attrs: { "aria-sort": active ? (direction === "asc" ? "ascending" : "descending") : "none" },
    children: [{
      tagName: "button",
      type: "button",
      class: ["task-table__sort", active && "task-table__sort--active"],
      text: `${label}${active ? (direction === "asc" ? " ↑" : " ↓") : ""}`,
      events: { click: () => actions.setListSort(key) },
    }],
  };
}

/**
 * @param {import("../../board/board.state.js").BoardTask} task
 * @param {import("../../board/board.state.js").BoardColumn | undefined} column
 * @param {import("./board.types.js").UserView | undefined} assignee
 * @param {import("./board.types.js").BoardActions} actions
 * @returns {import("../../core/JaDyDoCo.js").JaDyNode}
 */
function taskRow(task, column, assignee, actions) {
  const completed = task.todos.filter(({ completed }) => completed).length;
  return {
    tagName: "tr",
    class: "task-table__row",
    attrs: { tabindex: "0", "aria-label": `${task.id}: ${task.title} öffnen` },
    events: {
      click: () => actions.openTask(task.id),
      keydown: (event) => {
        if (!(event instanceof KeyboardEvent) || !["Enter", " "].includes(event.key)) return;
        event.preventDefault();
        actions.openTask(task.id);
      },
    },
    children: [
      { tagName: "td", children: [{ tagName: "span", class: "task-id", text: task.id }] },
      { tagName: "td", class: "task-table__title", text: task.title },
      { tagName: "td", children: [{ tagName: "span", class: "task-list-status", text: column?.title ?? "Unbekannt" }] },
      { tagName: "td", class: "task-table__optional", children: [{ tagName: "span", class: `priority priority--${task.priority}`, text: priorityLabel(task.priority) }] },
      { tagName: "td", class: "task-table__optional", text: task.category },
      { tagName: "td", text: assignee?.name ?? "Nicht zugewiesen" },
      { tagName: "td", children: task.dueDate ? [dueDateCell(task.dueDate, column?.kind === "done")] : [{ tagName: "span", text: "–" }] },
      { tagName: "td", class: "task-table__optional", text: task.todos.length ? `${completed}/${task.todos.length}` : "–" },
    ],
  };
}

/** @param {string} dueDate @param {boolean} done @returns {import("../../core/JaDyDoCo.js").JaDyNode} */
function dueDateCell(dueDate, done) {
  const status = done ? "done" : getDueDateStatus(dueDate);
  const date = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })
    .format(new Date(`${dueDate}T00:00:00`));
  return { tagName: "span", class: ["task-due-date", `task-due-date--${status}`], text: date };
}

/**
 * @param {{task: import("../../board/board.state.js").BoardTask, column: import("../../board/board.state.js").BoardColumn|undefined, assignee: import("./board.types.js").UserView|undefined}} left
 * @param {{task: import("../../board/board.state.js").BoardTask, column: import("../../board/board.state.js").BoardColumn|undefined, assignee: import("./board.types.js").UserView|undefined}} right
 * @param {{key: import("../../board/board.view-state.js").ListSortKey, direction: "asc"|"desc"}} sort
 */
function compareRows(left, right, sort) {
  const priority = { high: 0, medium: 1, low: 2 };
  const values = {
    id: [left.task.id, right.task.id],
    title: [left.task.title, right.task.title],
    column: [left.column?.title ?? "", right.column?.title ?? ""],
    priority: [priority[left.task.priority], priority[right.task.priority]],
    assignee: [left.assignee?.name ?? "\uffff", right.assignee?.name ?? "\uffff"],
    dueDate: [left.task.dueDate ?? "9999-12-31", right.task.dueDate ?? "9999-12-31"],
  };
  const [a, b] = values[sort.key];
  const result = typeof a === "number" && typeof b === "number"
    ? a - b
    : String(a).localeCompare(String(b), "de", { numeric: true, sensitivity: "base" });
  return sort.direction === "asc" ? result : -result;
}

/** @param {"low"|"medium"|"high"} priority */
function priorityLabel(priority) {
  return ({ low: "Niedrig", medium: "Mittel", high: "Hoch" })[priority];
}
