import { canAcceptTasks } from "../../board/board.state.js";
import { memberOption } from "./shared.map.js";

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
 * @returns {import("../../core/JaDyDoCo.js").JaDyNode}
 */
export function createTaskDialog(state, viewState, actions) {
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
                      { tagName: "label", class: "form-label", for: "task-assignee", text: "Verantwortlich" },
                      { tagName: "input", id: "task-assignee", type: "text", name: "assignee", placeholder: "Initialen", autocomplete: "off" },
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
 * @returns {import("../../core/JaDyDoCo.js").JaDyNode}
 */
export function createTaskDetails(state, actions, task, users) {
  const currentColumn = state.columns.find((column) => column.taskIds.includes(task.id));

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
                  { tagName: "h2", id: "task-detail-title", text: "Aufgabe bearbeiten" },
                ],
              },
              { tagName: "button", type: "button", class: "modal__close", text: "×", attrs: { "aria-label": "Details schließen" }, events: { click: actions.closeTask } },
            ],
          },
          {
            tagName: "form",
            class: "detail-form",
            events: { submit: actions.submitTaskDetails },
            children: [
              { tagName: "input", type: "hidden", name: "taskId", value: task.id },
              { tagName: "label", class: "form-label", for: "detail-title", text: "Titel" },
              { tagName: "input", id: "detail-title", type: "text", name: "title", value: task.title, required: true },
              { tagName: "label", class: "form-label", for: "detail-status", text: "Status" },
              {
                tagName: "select",
                id: "detail-status",
                name: "columnId",
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
              { tagName: "label", class: "form-label", for: "detail-priority", text: "Priorität" },
              {
                tagName: "select",
                id: "detail-priority",
                name: "priority",
                options: [
                  { value: "low", text: "Niedrig", selected: task.priority === "low" },
                  { value: "medium", text: "Mittel", selected: task.priority === "medium" },
                  { value: "high", text: "Hoch", selected: task.priority === "high" },
                ],
              },
              { tagName: "label", class: "form-label", for: "detail-category", text: "Kategorie" },
              { tagName: "input", id: "detail-category", type: "text", name: "category", value: task.category },
              { tagName: "label", class: "form-label", for: "detail-assignee", text: "Verantwortlich" },
              { tagName: "input", id: "detail-assignee", type: "text", name: "assignee", value: task.assignee },
              { tagName: "label", class: "form-label", for: "detail-due-date", text: "Fälligkeitsdatum" },
              { tagName: "input", id: "detail-due-date", type: "date", name: "dueDate", value: task.dueDate ?? "" },
              { tagName: "label", class: "form-label", for: "detail-owner", text: "Card-Owner" },
              { tagName: "select", id: "detail-owner", name: "ownerId", options: [
                { value: "", text: "Nicht zugewiesen", selected: !task.ownerId },
                ...users.filter((user) => state.project.memberIds.includes(user.id)).map((user) => ({ value: user.id, text: user.name, selected: user.id === task.ownerId })),
              ] },
              { tagName: "fieldset", class: "member-settings", children: [
                { tagName: "legend", text: "Card-Mitglieder" },
                ...users.filter((user) => state.project.memberIds.includes(user.id)).map((user) => memberOption(user, "memberIds", task.memberIds.includes(user.id), user.id === task.ownerId)),
              ] },
              taskTodoEditor(task, actions),
              {
                tagName: "footer",
                class: "drawer-footer",
                children: [
                  { tagName: "button", type: "button", class: "button button--danger", text: "Aufgabe löschen", events: { click: () => actions.deleteTask(task.id) } },
                  { tagName: "button", type: "submit", class: "button button--primary", text: "Änderungen speichern" },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

/** @param {import("../../board/board.state.js").BoardTask} task @param {import("./board.types.js").BoardActions} actions @returns {import("../../core/JaDyDoCo.js").JaDyNode} */
function taskTodoEditor(task, actions) {
  const completed = task.todos.filter((todo) => todo.completed).length;
  const progress = task.todos.length ? Math.round((completed / task.todos.length) * 100) : 0;
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
        ? task.todos.map((todo) => todoRow(task.id, todo, actions))
        : [{ tagName: "p", class: "todo-empty", text: "Noch keine Todos vorhanden." }] },
      { tagName: "div", class: "todo-add", children: [
        { tagName: "input", id: "new-todo", type: "text", placeholder: "Neues Todo …", attrs: { "aria-label": "Neues Todo" }, events: { keydown: (event) => {
          if (event instanceof KeyboardEvent && event.key === "Enter") { event.preventDefault(); actions.addTodo(task.id); }
        } } },
        { tagName: "button", type: "button", class: "button button--secondary", text: "Hinzufügen", events: { click: () => actions.addTodo(task.id) } },
      ] },
    ],
  };
}

/** @param {string} taskId @param {import("../../board/board.state.js").TaskTodo} todo @param {import("./board.types.js").BoardActions} actions @returns {import("../../core/JaDyDoCo.js").JaDyNode} */
function todoRow(taskId, todo, actions) {
  return {
    tagName: "div",
    class: ["todo-row", todo.completed && "todo-row--complete"],
    children: [
      { tagName: "input", type: "checkbox", checked: todo.completed, attrs: { "aria-label": `${todo.text} erledigt` }, events: { change: (event) => {
        if (event.currentTarget instanceof HTMLInputElement) actions.toggleTodo(taskId, todo.id, event.currentTarget.checked);
      } } },
      { tagName: "input", type: "text", value: todo.text, attrs: { "aria-label": "Todo bearbeiten" }, events: { change: (event) => {
        if (event.currentTarget instanceof HTMLInputElement) actions.updateTodo(taskId, todo.id, event.currentTarget.value);
      } } },
      { tagName: "button", type: "button", text: "×", attrs: { "aria-label": `${todo.text} löschen` }, events: { click: () => actions.deleteTodo(taskId, todo.id) } },
    ],
  };
}


