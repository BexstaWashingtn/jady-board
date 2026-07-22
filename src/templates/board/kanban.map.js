import { canAcceptTasks, getDueDateStatus, hasActiveFilters, matchesTaskFilters } from "../../board/board.state.js";

/**
 * @param {import("../../board/board.state.js").BoardState} state
 * @param {import("../../board/board.view-state.js").BoardViewState} viewState
 * @param {import("./board.types.js").BoardActions} actions
 * @param {import("./board.types.js").UserView[]} [users]
 * @param {boolean} [canConfigure]
 * @returns {import("../../core/JaDyDoCo.js").JaDyNode}
 */
export function createKanbanBoard(state, viewState, actions, users = [], canConfigure = true) {
  const filtersActive = hasActiveFilters(viewState.filters);
  let totalVisible = 0;

  const columns = state.columns.map((column, columnIndex) => {
    const tasks = column.taskIds
      .map((taskId) => state.tasks[taskId])
      .filter((task) => task && matchesTaskFilters(task, viewState.filters));
    totalVisible += tasks.length;

    const count = filtersActive
      ? `${tasks.length} / ${column.taskIds.length}`
      : String(column.taskIds.length);
    const cards = tasks.length
      ? tasks.map((task) => taskCard(task, column.kind === "done", actions, !filtersActive, users))
      : [emptyColumn(filtersActive)];

    return kanbanColumn(
      column.title,
      count,
      column.id,
      column.color,
      column.limit,
      column.limitMode,
      column.taskIds.length,
      canAcceptTasks(state, column.id),
      viewState.openColumnMenuId === column.id,
      columnIndex,
      state.columns.length,
      cards,
      actions,
      !filtersActive,
      canConfigure,
    );
  });

  /** @type {import("../../core/JaDyDoCo.js").JaDyNode[]} */
  const children = [];
  if (filtersActive) {
    children.push({
      tagName: "p",
      class: "filter-summary",
      text: totalVisible
        ? `${totalVisible} passende ${totalVisible === 1 ? "Aufgabe" : "Aufgaben"}. Sortieren ist während des Filterns deaktiviert.`
        : "Keine Aufgabe entspricht den aktiven Filtern.",
    });
  }
  children.push({
    tagName: "section",
    class: "kanban",
    attrs: { "aria-label": "Kanban-Board" },
    children: columns,
  });

  return { tagName: "div", children };
}

/**
 * @param {import("../../board/board.state.js").BoardState} state
 * @param {import("../../board/board.view-state.js").BoardViewState} viewState
 * @param {import("./board.types.js").BoardActions} actions
 * @returns {import("../../core/JaDyDoCo.js").JaDyNode[]}
 */
/**
 * @param {boolean} filtered
 * @returns {import("../../core/JaDyDoCo.js").JaDyNode}
 */
function emptyColumn(filtered) {
  return {
    tagName: "div",
    class: "empty-column",
    children: [
      { tagName: "span", text: filtered ? "⌕" : "+" },
      { tagName: "strong", text: filtered ? "Keine Treffer" : "Noch keine Aufgaben" },
      { tagName: "p", text: filtered ? "Passe die Filter an, um Aufgaben zu sehen." : "Erstelle die erste Aufgabe in dieser Spalte." },
    ],
  };
}

/**
 * @param {string} title
 * @param {string} count
 * @param {string} status
 * @param {string} color
 * @param {number | null} limit
 * @param {import("../../board/board.state.js").LimitMode} limitMode
 * @param {number} totalTasks
 * @param {boolean} canAddTask
 * @param {boolean} menuOpen
 * @param {number} columnIndex
 * @param {number} columnCount
 * @param {import("../../core/JaDyDoCo.js").JaDyNode[]} cards
 * @param {import("./board.types.js").BoardActions} actions
 * @param {boolean} dragEnabled
 * @param {boolean} canConfigure
 * @returns {import("../../core/JaDyDoCo.js").JaDyNode}
 */
function kanbanColumn(title, count, status, color, limit, limitMode, totalTasks, canAddTask, menuOpen, columnIndex, columnCount, cards, actions, dragEnabled, canConfigure) {
  const limitReached = limit !== null && totalTasks >= limit;
  /** @type {import("../../core/JaDyDoCo.js").JaDyNode[]} */
  const configurationMenu = canConfigure
    ? [{
        tagName: "div",
        class: "column-menu-wrap",
        children: [
          {
            tagName: "button",
            type: "button",
            class: "column-menu",
            text: "•••",
            attrs: {
              "aria-label": `${title} Optionen`,
              "aria-haspopup": "menu",
              "aria-expanded": String(menuOpen),
            },
            events: { click: () => actions.toggleColumnMenu(status) },
          },
          ...(menuOpen
            ? [columnMenuBackdrop(actions), columnContextMenu(title, status, columnIndex, columnCount, canAddTask, actions)]
            : []),
        ],
      }]
    : [];
  return {
    tagName: "section",
    class: [
      "kanban-column",
      limitReached && "kanban-column--limit-reached",
      limitReached && limitMode === "strict" && "kanban-column--limit-strict",
    ],
    dataset: { status },
    events: {
      dragover: (event) => {
        if (!dragEnabled) return;
        if (event instanceof DragEvent) actions.dragTaskOverColumn(event, status);
      },
      dragleave: (event) => {
        if (!dragEnabled) return;
        if (event instanceof DragEvent) actions.leaveTaskColumn(event);
      },
      drop: (event) => {
        if (!dragEnabled) return;
        if (event instanceof DragEvent) actions.dropTask(event, status);
      },
    },
    children: [
      {
        tagName: "header",
        class: "column-header",
        children: [
          { tagName: "span", class: "status-dot", style: { backgroundColor: color } },
          { tagName: "h2", text: title },
          { tagName: "span", class: ["column-count", limitReached && "column-count--limit"], text: limit ? `${count} · Limit ${limit}` : count },
          ...configurationMenu,
        ],
      },
      { tagName: "div", class: "task-list", children: cards },
      {
        tagName: "button",
        type: "button",
        class: "add-task",
        text: canAddTask ? "+ Aufgabe hinzufügen" : "WIP-Limit erreicht",
        disabled: !canAddTask,
        events: { click: () => actions.openCreateTask(status) },
      },
    ],
  };
}

/**
 * @param {import("./board.types.js").BoardActions} actions
 * @returns {import("../../core/JaDyDoCo.js").JaDyNode}
 */
function columnMenuBackdrop(actions) {
  return {
    tagName: "button",
    type: "button",
    class: "column-menu-backdrop",
    attrs: { "aria-label": "Menü schließen" },
    events: { click: actions.closeColumnMenu },
  };
}

/**
 * @param {string} title
 * @param {string} columnId
 * @param {number} columnIndex
 * @param {number} columnCount
 * @param {boolean} canAddTask
 * @param {import("./board.types.js").BoardActions} actions
 * @returns {import("../../core/JaDyDoCo.js").JaDyNode}
 */
function columnContextMenu(title, columnId, columnIndex, columnCount, canAddTask, actions) {
  return {
    tagName: "div",
    class: "column-context-menu",
    attrs: { role: "menu", "aria-label": `${title} Aktionen` },
    events: {
      keydown: (event) => {
        if (event instanceof KeyboardEvent && event.key === "Escape") actions.closeColumnMenu();
      },
    },
    children: [
      menuButton("+ Aufgabe hinzufügen", () => actions.openCreateTask(columnId), !canAddTask),
      menuButton("Stage bearbeiten", () => actions.openStageEditorFromMenu(columnId)),
      { tagName: "div", class: "column-context-menu__separator", attrs: { role: "separator" } },
      menuButton("Nach links verschieben", () => actions.moveStage(columnId, -1), columnIndex === 0),
      menuButton("Nach rechts verschieben", () => actions.moveStage(columnId, 1), columnIndex === columnCount - 1),
      { tagName: "div", class: "column-context-menu__separator", attrs: { role: "separator" } },
      menuButton("Stage löschen", () => actions.openStageDeleteFromMenu(columnId), columnCount === 1, true),
    ],
  };
}

/**
 * @param {string} text
 * @param {() => void} onClick
 * @param {boolean} [disabled]
 * @param {boolean} [danger]
 * @returns {import("../../core/JaDyDoCo.js").JaDyNode}
 */
function menuButton(text, onClick, disabled = false, danger = false) {
  return {
    tagName: "button",
    type: "button",
    class: ["column-context-menu__item", danger && "column-context-menu__item--danger"],
    text,
    disabled,
    attrs: { role: "menuitem" },
    events: { click: onClick },
  };
}

/** @param {import("../../board/board.state.js").BoardTask} task @param {import("./board.types.js").UserView[]} users @returns {import("../../core/JaDyDoCo.js").JaDyNode[]} */
function taskPeople(task, users) {
  const ids = [...new Set([task.ownerId, ...task.memberIds].filter(Boolean))];
  if (!ids.length) return [{ tagName: "span", class: "task-member", text: task.assignee, attrs: { title: "Verantwortlich (Bestandsdaten)" } }];
  return ids.slice(0, 3).map((id) => {
    const user = users.find((item) => item.id === id);
    return { tagName: "span", class: ["task-member", id === task.ownerId && "task-member--owner"], text: user?.initials ?? "?", attrs: { title: `${user?.name ?? "Unbekannt"}${id === task.ownerId ? " · Owner" : ""}` } };
  });
}

/**
 * @param {import("../../board/board.state.js").BoardTask} task
 * @param {boolean} done
 * @param {import("./board.types.js").BoardActions} actions
 * @param {boolean} dragEnabled
 * @param {import("./board.types.js").UserView[]} [users]
 * @returns {import("../../core/JaDyDoCo.js").JaDyNode}
 */
function taskCard(task, done = false, actions, dragEnabled, users = []) {
  const completedTodos = task.todos.filter(({ completed }) => completed).length;
  return {
    tagName: "article",
    class: ["task-card", done && "task-card--done"],
    dataset: { taskId: task.id },
    attrs: {
      role: "button",
      tabindex: "0",
      draggable: String(dragEnabled),
      title: dragEnabled ? "Ziehen zum Verschieben" : "Sortieren ist bei aktiven Filtern deaktiviert",
      "aria-label": `${task.id}: ${task.title} öffnen`,
    },
    events: {
      click: () => actions.openTask(task.id),
      dragstart: (event) => {
        if (!dragEnabled) return;
        if (event instanceof DragEvent) actions.startTaskDrag(event, task.id);
      },
      dragend: (event) => {
        if (event instanceof DragEvent) actions.endTaskDrag(event);
      },
      keydown: (event) => {
        if (!(event instanceof KeyboardEvent)) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          actions.openTask(task.id);
        }
      },
    },
    children: [
      {
        tagName: "div",
        class: "task-card__meta",
        children: [
          { tagName: "span", class: "task-id", text: task.id },
          { tagName: "div", class: "task-card__badges", children: [
            ...(task.dueDate ? [taskDueDate(task.dueDate, done)] : []),
            { tagName: "span", class: `priority priority--${task.priority}`, text: priorityLabel(task.priority) },
          ] },
        ],
      },
      { tagName: "h3", text: task.title },
      { tagName: "span", class: "task-category", text: task.category },
      ...(task.todos.length ? [taskTodoPreview(task, completedTodos)] : []),
      {
        tagName: "footer",
        class: "task-card__footer",
        children: [
          { tagName: "div", class: "task-card__people", children: taskPeople(task, users) },
          taskCardStats(task, completedTodos),
        ],
      },
    ],
  };
}

/** @param {string} dueDate @param {boolean} done @returns {import("../../core/JaDyDoCo.js").JaDyNode} */
function taskDueDate(dueDate, done) {
  const status = done ? "done" : getDueDateStatus(dueDate);
  /** @type {Record<string, string>} */
  const labels = { overdue: "Überfällig", today: "Heute fällig", soon: "Bald fällig", upcoming: "Fällig", done: "Erledigt" };
  const date = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(`${dueDate}T00:00:00`));
  return {
    tagName: "span",
    class: ["task-due-date", `task-due-date--${status}`],
    text: `◷ ${date}`,
    attrs: { title: labels[status] ?? "Fällig", "aria-label": `${labels[status] ?? "Fällig"}: ${date}` },
  };
}

/** @param {import("../../board/board.state.js").BoardTask} task @param {number} completedTodos @returns {import("../../core/JaDyDoCo.js").JaDyNode} */
function taskTodoPreview(task, completedTodos) {
  const ready = completedTodos === task.todos.length;
  const hiddenCount = Math.max(0, task.todos.length - 3);
  /** @type {import("../../core/JaDyDoCo.js").JaDyNode[]} */
  const items = task.todos.slice(0, 3).map((todo) => ({
    tagName: "li",
    class: todo.completed ? "task-todo-preview__item task-todo-preview__item--complete" : "task-todo-preview__item",
    children: [
      { tagName: "span", class: "task-todo-preview__check", text: todo.completed ? "✓" : "○" },
      { tagName: "span", class: "task-todo-preview__text", text: todo.text },
    ],
  }));
  if (hiddenCount) items.push({ tagName: "li", class: "task-todo-preview__more", text: `+${hiddenCount} weitere` });
  return {
    tagName: "section",
    class: "task-todo-preview",
    attrs: { "aria-label": `Todos: ${ready ? "Ready" : "Open"}` },
    children: [
      { tagName: "header", class: "task-todo-preview__header", children: [
        { tagName: "span", text: "Todos" },
        { tagName: "span", class: ["task-todo-status", ready ? "task-todo-status--ready" : "task-todo-status--open"], text: ready ? "Ready" : "Open" },
      ] },
      { tagName: "ul", class: "task-todo-preview__list", children: items },
    ],
  };
}

/** @param {import("../../board/board.state.js").BoardTask} task @param {number} completedTodos @returns {import("../../core/JaDyDoCo.js").JaDyNode} */
function taskCardStats(task, completedTodos) {
  /** @type {import("../../core/JaDyDoCo.js").JaDyNode[]} */
  const children = [];
  if (task.todos.length) children.push({ tagName: "span", class: ["task-todos", completedTodos === task.todos.length && "task-todos--complete"], text: `✓ ${completedTodos}/${task.todos.length}` });
  children.push({ tagName: "span", class: "task-comments", text: commentLabel(task.comments) });
  return { tagName: "div", class: "task-card__stats", children };
}
/** @param {"low" | "medium" | "high"} priority */
function priorityLabel(priority) {
  return { low: "Niedrig", medium: "Mittel", high: "Hoch" }[priority] ?? "Mittel";
}

/** @param {number} comments @returns {string} */
function commentLabel(comments) {
  if (!comments) return "";
  return `${comments} ${comments === 1 ? "Kommentar" : "Kommentare"}`;
}


