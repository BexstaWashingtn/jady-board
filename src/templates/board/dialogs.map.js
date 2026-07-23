import { canAcceptTasks } from "../../board/board.state.js";
import {
  canAssignTask, canClaimTask, canDeleteTask, canEditTask, canReleaseTask, canWorkOnTask,
} from "../../board/board.permissions.js";

/** @param {import("./board.types.js").BoardActions} actions @returns {import("../../core/JaDyDoCo.js").JaDyNode} */
export function createBoardDialog(actions) {
  return {
    tagName: "div",
    class: "modal-backdrop",
    children: [{
      tagName: "section",
      class: "modal board-create-modal",
      attrs: { role: "dialog", "aria-modal": "true", "aria-labelledby": "create-board-title" },
      children: [
        {
          tagName: "header",
          class: "modal__header",
          children: [
            { tagName: "div", children: [{ tagName: "span", class: "modal__eyebrow", text: "Neues Board" }, { tagName: "h2", id: "create-board-title", text: "Board konfigurieren" }] },
            { tagName: "button", type: "button", class: "modal__close", text: "×", attrs: { "aria-label": "Dialog schließen" }, events: { click: actions.closeCreateBoard } },
          ],
        },
        {
          tagName: "form",
          class: "modal__body board-create-form",
          events: { submit: actions.submitCreateBoard },
          children: [
            { tagName: "label", class: "form-label", for: "new-board-name", text: "Boardname" },
            { tagName: "input", id: "new-board-name", type: "text", name: "name", placeholder: "z. B. Website Relaunch", required: true },
            { tagName: "label", class: "form-label", for: "new-board-description", text: "Untertitel" },
            { tagName: "textarea", id: "new-board-description", name: "description", placeholder: "Worum geht es in diesem Board?", attrs: { rows: "3" } },
            { tagName: "fieldset", class: "board-template-stages", children: [
              { tagName: "legend", text: "Standard-Stages" },
              { tagName: "p", class: "field-help", text: "Wähle die Stages, mit denen das Board starten soll." },
              defaultStageOption("backlog", "Backlog", true),
              defaultStageOption("progress", "In Arbeit", true),
              defaultStageOption("review", "Review", true),
              defaultStageOption("done", "Erledigt", true),
            ] },
            { tagName: "label", class: "form-label", for: "custom-stages", text: "Weitere Stages" },
            { tagName: "textarea", id: "custom-stages", name: "customStages", placeholder: "Eine Stage pro Zeile, z. B. Freigabe", attrs: { rows: "3" } },
            { tagName: "footer", class: "modal__footer", children: [
              { tagName: "button", type: "button", class: "button button--secondary", text: "Abbrechen", events: { click: actions.closeCreateBoard } },
              { tagName: "button", type: "submit", class: "button button--primary", text: "Board anlegen" },
            ] },
          ],
        },
      ],
    }],
  };
}

/** @param {string} value @param {string} label @param {boolean} checked @returns {import("../../core/JaDyDoCo.js").JaDyNode} */
function defaultStageOption(value, label, checked) {
  return {
    tagName: "label",
    class: "transition-option",
    children: [
      { tagName: "input", type: "checkbox", name: "defaultStages", value, checked },
      { tagName: "span", text: label },
    ],
  };
}

/**
 * @param {import("../../board/board.state.js").BoardState} state
 * @param {import("../../board/board.view-state.js").BoardViewState} viewState
 * @param {import("./board.types.js").BoardActions} actions
 * @param {import("./board.types.js").UserView[]} users
 * @param {string} activeUserId
 * @returns {import("../../core/JaDyDoCo.js").JaDyNode}
 */
export function createTaskDialog(state, viewState, actions, users, activeUserId) {
  const assignableUsers = state.project.ownerId === activeUserId
    ? users
    : users.filter((user) => user.id === activeUserId);
  return {
    tagName: "div",
    class: "modal-backdrop",
    attrs: { role: "presentation" },
    children: [
      {
        tagName: "section",
        class: "modal",
        attrs: { role: "dialog", "aria-modal": "true", "aria-labelledby": "create-task-title" },
        children: [
          {
            tagName: "header",
            class: "modal__header",
            children: [
              {
                tagName: "div",
                children: [
                  { tagName: "span", class: "modal__eyebrow", text: "Neue Aufgabe" },
                  { tagName: "h2", id: "create-task-title", text: "Task zum Board hinzufügen" },
                ],
              },
              { tagName: "button", type: "button", class: "modal__close", text: "×", attrs: { "aria-label": "Dialog schließen" }, events: { click: actions.closeCreateTask } },
            ],
          },
          {
            tagName: "form",
            class: "task-form",
            events: { submit: actions.submitCreateTask },
            children: [
              { tagName: "label", class: "form-label", for: "task-title", text: "Titel" },
              { tagName: "input", id: "task-title", type: "text", name: "title", placeholder: "Was soll erledigt werden?", autocomplete: "off", required: true },
              {
                tagName: "div",
                class: "form-grid",
                children: [
                  {
                    tagName: "div",
                    children: [
                      { tagName: "label", class: "form-label", for: "task-column", text: "Status" },
                      {
                        tagName: "select",
                        id: "task-column",
                        name: "columnId",
                        options: state.columns.map((column) => {
                          const available = canAcceptTasks(state, column.id);
                          return {
                            value: column.id,
                            text: available ? column.title : `${column.title} – Limit erreicht`,
                            selected: column.id === viewState.createTaskColumnId,
                            disabled: !available,
                          };
                        }),
                      },
                    ],
                  },
                  {
                    tagName: "div",
                    children: [
                      { tagName: "label", class: "form-label", for: "task-priority", text: "Priorität" },
                      {
                        tagName: "select",
                        id: "task-priority",
                        name: "priority",
                        options: [
                          { value: "low", text: "Niedrig" },
                          { value: "medium", text: "Mittel", selected: true },
                          { value: "high", text: "Hoch" },
                        ],
                      },
                    ],
                  },
                ],
              },
              { tagName: "label", class: "form-label task-due-label", for: "task-due-date", text: "Fälligkeitsdatum (optional)" },
              { tagName: "input", id: "task-due-date", type: "date", name: "dueDate" },
              {
                tagName: "div",
                class: "form-grid",
                children: [
                  {
                    tagName: "div",
                    children: [
                      { tagName: "label", class: "form-label", for: "task-category", text: "Kategorie" },
                      { tagName: "input", id: "task-category", type: "text", name: "category", placeholder: "z. B. Design", autocomplete: "off" },
                    ],
                  },
                  {
                    tagName: "div",
                    children: [
                      { tagName: "label", class: "form-label", for: "task-assignee", text: "Bearbeiter" },
                      { tagName: "select", id: "task-assignee", name: "assigneeId", options: assigneeOptions(state, assignableUsers, null) },
                    ],
                  },
                ],
              },
              {
                tagName: "footer",
                class: "modal__footer",
                children: [
                  { tagName: "button", type: "button", class: "button button--secondary", text: "Abbrechen", events: { click: actions.closeCreateTask } },
                  { tagName: "button", type: "submit", class: "button button--primary", text: "Aufgabe erstellen" },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

/**
 * @param {import("../../board/board.state.js").BoardState} state
 * @param {import("./board.types.js").BoardActions} actions
 * @param {import("../../board/board.state.js").BoardTask} task
 * @param {import("./board.types.js").UserView[]} users
 * @param {string} activeUserId
 * @param {boolean} editOpen
 * @returns {import("../../core/JaDyDoCo.js").JaDyNode}
 */
export function createTaskDetails(state, actions, task, users, activeUserId, editOpen) {
  return editOpen
    ? createTaskEditor(state, actions, task, activeUserId)
    : createTaskWorkView(state, actions, task, users, activeUserId);
}

/** @param {import("../../board/board.state.js").BoardState} state @param {import("./board.types.js").BoardActions} actions @param {import("../../board/board.state.js").BoardTask} task @param {import("./board.types.js").UserView[]} users @param {string} activeUserId @returns {import("../../core/JaDyDoCo.js").JaDyNode} */
function createTaskWorkView(state, actions, task, users, activeUserId) {
  const currentColumn = state.columns.find((column) => column.taskIds.includes(task.id));
  const canWork = canWorkOnTask(state, task.id, activeUserId);
  const assignee = users.find((user) => user.id === task.assigneeId);
  /** @type {import("../../core/JaDyDoCo.js").JaDyNode[]} */
  const editControl = canEditTask(state, task.id, activeUserId)
    ? [{ tagName: "button", type: "button", class: "task-edit-button", text: "Bearbeiten", attrs: { "aria-label": "Task bearbeiten" }, events: { click: () => actions.openTaskEditor(task.id) } }]
    : [];
  /** @type {import("../../core/JaDyDoCo.js").JaDyNode[]} */
  const statusControl = canWork
    ? [{ tagName: "button", type: "submit", class: "button button--secondary", text: "Status speichern" }]
    : [];

  return {
    tagName: "div",
    class: "drawer-backdrop",
    children: [
      {
        tagName: "aside",
        class: "task-drawer",
        attrs: { role: "dialog", "aria-modal": "true", "aria-labelledby": "task-detail-title" },
        children: [
          {
            tagName: "header",
            class: "drawer-header",
            children: [
              {
                tagName: "div",
                children: [
                  { tagName: "span", class: "task-id", text: task.id },
                  { tagName: "h2", id: "task-detail-title", text: task.title },
                ],
              },
              { tagName: "div", class: "drawer-header__actions", children: [
                ...editControl,
                { tagName: "button", type: "button", class: "modal__close", text: "×", attrs: { "aria-label": "Details schließen" }, events: { click: actions.closeTask } },
              ] },
            ],
          },
          {
            tagName: "div",
            class: "detail-form task-work-form",
            children: [
              {
                tagName: "form",
                class: "task-status-form",
                events: { submit: actions.submitTaskWork },
                children: [
                  { tagName: "input", type: "hidden", name: "taskId", value: task.id },
                  { tagName: "label", class: "form-label", for: "detail-status", text: "Status" },
                  { tagName: "div", class: "task-assignment__controls", children: [
                    {
                      tagName: "select",
                      id: "detail-status",
                      name: "columnId",
                      disabled: !canWork,
                      options: state.columns.map((column) => {
                        const available = canAcceptTasks(state, column.id, 1, task.id);
                        return {
                          value: column.id,
                          text: available ? column.title : `${column.title} – Limit erreicht`,
                          selected: column.id === currentColumn?.id,
                          disabled: !available,
                        };
                      }),
                    },
                    ...statusControl,
                  ] },
                ],
              },
              taskAssignment(state, task, users, activeUserId, assignee, actions),
              taskTodoEditor(task, actions, canWork),
            ],
          },
        ],
      },
    ],
  };
}

/** @param {import("../../board/board.state.js").BoardState} state @param {import("./board.types.js").BoardActions} actions @param {import("../../board/board.state.js").BoardTask} task @param {string} activeUserId @returns {import("../../core/JaDyDoCo.js").JaDyNode} */
function createTaskEditor(state, actions, task, activeUserId) {
  /** @type {import("../../core/JaDyDoCo.js").JaDyNode[]} */
  const deleteControl = canDeleteTask(state, task.id, activeUserId)
    ? [{ tagName: "button", type: "button", class: "button button--danger", text: "Aufgabe löschen", events: { click: () => actions.deleteTask(task.id) } }]
    : [{ tagName: "span" }];
  return {
    tagName: "div",
    class: "drawer-backdrop",
    children: [{
      tagName: "aside",
      class: "task-drawer",
      attrs: { role: "dialog", "aria-modal": "true", "aria-labelledby": "task-edit-title" },
      children: [
        { tagName: "header", class: "drawer-header", children: [
          { tagName: "div", children: [
            { tagName: "span", class: "task-id", text: task.id },
            { tagName: "h2", id: "task-edit-title", text: "Task bearbeiten" },
          ] },
          { tagName: "div", class: "drawer-header__actions", children: [
            { tagName: "button", type: "button", class: "button button--secondary task-edit-back", text: "Zurück", events: { click: actions.closeTaskEditor } },
            { tagName: "button", type: "button", class: "modal__close", text: "×", attrs: { "aria-label": "Details schließen" }, events: { click: actions.closeTask } },
          ] },
        ] },
        { tagName: "form", class: "detail-form task-edit-form", events: { submit: actions.submitTaskDetails }, children: [
          { tagName: "input", type: "hidden", name: "taskId", value: task.id },
          { tagName: "label", class: "form-label", for: "detail-title", text: "Titel" },
          { tagName: "input", id: "detail-title", type: "text", name: "title", value: task.title, required: true },
          { tagName: "label", class: "form-label", for: "detail-priority", text: "Priorität" },
          { tagName: "select", id: "detail-priority", name: "priority", options: [
            { value: "low", text: "Niedrig", selected: task.priority === "low" },
            { value: "medium", text: "Mittel", selected: task.priority === "medium" },
            { value: "high", text: "Hoch", selected: task.priority === "high" },
          ] },
          { tagName: "label", class: "form-label", for: "detail-category", text: "Kategorie" },
          { tagName: "input", id: "detail-category", type: "text", name: "category", value: task.category },
          { tagName: "label", class: "form-label", for: "detail-due-date", text: "Fälligkeitsdatum" },
          { tagName: "input", id: "detail-due-date", type: "date", name: "dueDate", value: task.dueDate ?? "" },
          { tagName: "footer", class: "drawer-footer", children: [
            ...deleteControl,
            { tagName: "button", type: "submit", class: "button button--primary", text: "Änderungen speichern" },
          ] },
        ] },
      ],
    }],
  };
}

/** @param {import("../../board/board.state.js").BoardState} state @param {import("../../board/board.state.js").BoardTask} task @param {import("./board.types.js").UserView[]} users @param {string} activeUserId @param {import("./board.types.js").UserView|undefined} assignee @param {import("./board.types.js").BoardActions} actions @returns {import("../../core/JaDyDoCo.js").JaDyNode} */
function taskAssignment(state, task, users, activeUserId, assignee, actions) {
  if (canAssignTask(state, task.id, activeUserId)) {
    return {
      tagName: "form",
      class: "task-assignment",
      events: { submit: actions.assignTask },
      children: [
        { tagName: "input", type: "hidden", name: "taskId", value: task.id },
        { tagName: "label", class: "form-label", for: "work-assignee", text: "Bearbeiter" },
        { tagName: "div", class: "task-assignment__controls", children: [
          { tagName: "select", id: "work-assignee", name: "assigneeId", options: assigneeOptions(state, users, task.assigneeId) },
          { tagName: "button", type: "submit", class: "button button--secondary", text: "Zuweisen" },
        ] },
      ],
    };
  }
  /** @type {import("../../core/JaDyDoCo.js").JaDyNode[]} */
  const assignmentActions = [];
  if (canClaimTask(state, task.id, activeUserId)) {
    assignmentActions.push({ tagName: "button", type: "button", class: "button button--primary", text: "Task übernehmen", events: { click: () => actions.claimTask(task.id) } });
  }
  if (canReleaseTask(state, task.id, activeUserId)) {
    assignmentActions.push({ tagName: "button", type: "button", class: "button button--secondary", text: "Zuweisung zurückgeben", events: { click: () => actions.releaseTask(task.id) } });
  }
  return {
    tagName: "section",
    class: "task-assignment",
    children: [
      { tagName: "span", class: "form-label", text: "Bearbeiter" },
      { tagName: "strong", text: assignee?.name ?? "Nicht zugewiesen" },
      ...assignmentActions,
    ],
  };
}

/** @param {import("../../board/board.state.js").BoardState} state @param {import("./board.types.js").UserView[]} users @param {string|null} selectedId */
function assigneeOptions(state, users, selectedId) {
  return [
    { value: "", text: "Nicht zugewiesen", selected: !selectedId },
    ...users
      .filter((user) => state.project.memberIds.includes(user.id))
      .map((user) => ({ value: user.id, text: user.name, selected: user.id === selectedId })),
  ];
}

/** @param {import("../../board/board.state.js").BoardTask} task @param {import("./board.types.js").BoardActions} actions @param {boolean} editable @returns {import("../../core/JaDyDoCo.js").JaDyNode} */
function taskTodoEditor(task, actions, editable) {
  const completed = task.todos.filter((todo) => todo.completed).length;
  const progress = task.todos.length ? Math.round((completed / task.todos.length) * 100) : 0;
  /** @type {import("../../core/JaDyDoCo.js").JaDyNode[]} */
  const addControls = editable ? [{
    tagName: "div",
    class: "todo-add",
    children: [
      { tagName: "input", id: "new-todo", type: "text", placeholder: "Neues Todo …", attrs: { "aria-label": "Neues Todo" }, events: { keydown: (event) => {
        if (event instanceof KeyboardEvent && event.key === "Enter") { event.preventDefault(); actions.addTodo(task.id); }
      } } },
      { tagName: "button", type: "button", class: "button button--secondary", text: "Hinzufügen", events: { click: () => actions.addTodo(task.id) } },
    ],
  }] : [];
  return {
    tagName: "section",
    class: "task-todo-editor",
    children: [
      { tagName: "div", class: "task-todo-editor__header", children: [
        { tagName: "strong", text: "Todos" },
        { tagName: "span", text: `${completed} von ${task.todos.length} erledigt` },
      ] },
      { tagName: "div", class: "todo-progress", children: [{ tagName: "span", style: { width: `${progress}%` } }] },
      { tagName: "div", class: "todo-list", children: task.todos.length
        ? task.todos.map((todo) => todoRow(task.id, todo, actions, editable))
        : [{ tagName: "p", class: "todo-empty", text: "Noch keine Todos vorhanden." }] },
      ...addControls,
    ],
  };
}

/** @param {string} taskId @param {import("../../board/board.state.js").TaskTodo} todo @param {import("./board.types.js").BoardActions} actions @param {boolean} editable @returns {import("../../core/JaDyDoCo.js").JaDyNode} */
function todoRow(taskId, todo, actions, editable) {
  /** @type {import("../../core/JaDyDoCo.js").JaDyNode[]} */
  const deleteControl = editable
    ? [{ tagName: "button", type: "button", text: "×", attrs: { "aria-label": `${todo.text} löschen` }, events: { click: () => actions.deleteTodo(taskId, todo.id) } }]
    : [];
  return {
    tagName: "div",
    class: ["todo-row", todo.completed && "todo-row--complete"],
    children: [
      { tagName: "input", type: "checkbox", checked: todo.completed, disabled: !editable, attrs: { "aria-label": `${todo.text} erledigt` }, events: { change: (event) => {
        if (event.currentTarget instanceof HTMLInputElement) actions.toggleTodo(taskId, todo.id, event.currentTarget.checked);
      } } },
      { tagName: "input", type: "text", value: todo.text, readonly: !editable, attrs: { "aria-label": "Todo bearbeiten" }, events: { change: (event) => {
        if (event.currentTarget instanceof HTMLInputElement) actions.updateTodo(taskId, todo.id, event.currentTarget.value);
      } } },
      ...deleteControl,
    ],
  };
}
