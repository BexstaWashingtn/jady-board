import { canAcceptTasks, getDueDateStatus, hasActiveFilters, matchesTaskFilters } from "../board/board.state.js";
import { canConfigureBoard as userCanConfigureBoard } from "../board/board.permissions.js";
import { createFilterControls } from "../features/filters/filter.map.js";
import { createNoticeSnackbar, createUndoSnackbar } from "../features/feedback/feedback.map.js";
import { createUserSettings } from "../features/users/user-settings.map.js";
import { createAppSettings } from "../features/settings/app-settings.map.js";

/**
 * @typedef {Object} BoardActions
 * @property {(columnId?: string) => void} openCreateTask
 * @property {() => void} closeCreateTask
 * @property {EventListener} submitCreateTask
 * @property {() => void} resetBoard
 * @property {(taskId: string) => void} openTask
 * @property {() => void} closeTask
 * @property {EventListener} submitTaskDetails
 * @property {(taskId: string) => void} deleteTask
 * @property {(taskId: string) => void} addTodo
 * @property {(taskId: string, todoId: string, completed: boolean) => void} toggleTodo
 * @property {(taskId: string, todoId: string, text: string) => void} updateTodo
 * @property {(taskId: string, todoId: string) => void} deleteTodo
 * @property {(event: DragEvent, taskId: string) => void} startTaskDrag
 * @property {(event: DragEvent) => void} endTaskDrag
 * @property {(event: DragEvent, columnId: string) => void} dragTaskOverColumn
 * @property {(event: DragEvent) => void} leaveTaskColumn
 * @property {(event: DragEvent, columnId: string) => void} dropTask
 * @property {(key: "query" | "priority" | "category" | "assignee", value: string) => void} setFilter
 * @property {() => void} clearFilters
 * @property {() => void} undoLastAction
 * @property {() => void} dismissUndo
 * @property {() => void} dismissNotice
 * @property {() => void} openBoardConfig
 * @property {() => void} closeBoardConfig
 * @property {() => void} openStageConfig
 * @property {() => void} closeStageConfig
 * @property {() => void} createStage
 * @property {(columnId: string) => void} editStage
 * @property {(columnId: string) => void} requestDeleteStage
 * @property {() => void} cancelStageEditor
 * @property {EventListener} submitStage
 * @property {(columnId: string, direction: number) => void} moveStage
 * @property {EventListener} confirmDeleteStage
 * @property {(columnId: string) => void} toggleColumnMenu
 * @property {() => void} closeColumnMenu
 * @property {(columnId: string) => void} openStageEditorFromMenu
 * @property {(columnId: string) => void} openStageDeleteFromMenu
 * @property {(boardId: string) => void} switchBoard
 * @property {() => void} openCreateBoard
 * @property {() => void} closeCreateBoard
 * @property {EventListener} submitCreateBoard
 * @property {EventListener} submitBoardDetails
 * @property {() => void} deleteBoard
 * @property {() => void} openUserSettings
 * @property {() => void} closeUserSettings
 * @property {() => void} openAppSettings
 * @property {() => void} closeAppSettings
 * @property {(userId: string) => void} switchUser
 * @property {EventListener} submitUser
 * @property {EventListener} createUser
 * @property {() => void} deleteUser
 * @property {(theme: string) => void} setTheme
 * @property {() => void} retryPersistence
 */

/**
 * @param {import("../board/board.state.js").BoardState} state
 * @param {import("../board/board.view-state.js").BoardViewState} viewState
 * @param {BoardActions} actions
 * @param {{ activeBoardId: string, boards: Array<{id: string, name: string}>, createOpen: boolean, userSettingsOpen: boolean, appSettingsOpen: boolean, activeUserId: string, users: Array<{id: string, name: string, initials: string, preferences: {theme: string}}>, persistenceError: boolean }} workspace
 * @returns {import("../core/JaDyDoCo.js").JaDyNode}
 */
export function createBoardPage(state, viewState, actions, workspace) {
  const canConfigureBoard = userCanConfigureBoard(state, workspace.activeUserId);
  /** @type {import("../core/JaDyDoCo.js").JaDyNode[]} */
  const configurationButtons = canConfigureBoard
    ? [
        { tagName: "button", type: "button", class: "button button--secondary", text: "Board konfigurieren", events: { click: actions.openBoardConfig } },
        { tagName: "button", type: "button", class: "button button--secondary", text: "Stages konfigurieren", events: { click: actions.openStageConfig } },
      ]
    : [];
  return {
  tagName: "div",
  class: "board-app",
  children: [
    {
      tagName: "header",
      class: "topbar",
      children: [
        {
          tagName: "a",
          class: "brand",
          href: "#board",
          children: [
            { tagName: "span", class: "brand__mark", text: "J" },
            { tagName: "strong", class: "brand__name", text: "JaDy Board" },
          ],
        },
        {
          tagName: "nav",
          class: "topbar__nav",
          attrs: { "aria-label": "Hauptnavigation" },
          children: [
            { tagName: "a", class: "topbar__link topbar__link--active", href: "#board", text: "Board" },
            { tagName: "a", class: "topbar__link", href: "#timeline", text: "Timeline" },
            { tagName: "a", class: "topbar__link", href: "#reports", text: "Reports" },
          ],
        },
        {
          tagName: "div",
          class: "topbar__actions",
          children: [
            {
              tagName: "button",
              type: "button",
              class: "icon-button",
              attrs: { "aria-label": "Suche öffnen" },
              text: "⌕",
            },
            {
              tagName: "button",
              type: "button",
              class: "avatar",
              attrs: { "aria-label": "Benutzerprofil öffnen" },
              text: workspace.users.find(({ id }) => id === workspace.activeUserId)?.initials ?? "?",
              events: { click: actions.openUserSettings },
            },
          ],
        },
      ],
    },
    {
      tagName: "div",
      class: "workspace",
      children: [
        {
          tagName: "aside",
          class: "sidebar",
          children: [
            {
              tagName: "div",
              class: "sidebar__team",
              children: [
                { tagName: "span", class: "team-logo", text: "JD" },
                {
                  tagName: "div",
                  children: [
                    { tagName: "strong", text: "JaDyDoCo" },
                    { tagName: "small", text: "Produktteam" },
                  ],
                },
                { tagName: "button", type: "button", class: "team-switch", text: "⌄", attrs: { "aria-label": "Team wechseln" } },
              ],
            },
            {
              tagName: "nav",
              class: "sidebar__nav",
              attrs: { "aria-label": "Projektnavigation" },
              children: [
                sidebarLink("⌂", "Übersicht", "#overview"),
                sidebarLink("▦", "Mein Board", "#board", true),
                sidebarLink("◷", "Aktivitäten", "#activity"),
                sidebarLink("◇", "Ziele", "#goals"),
              ],
            },
            {
              tagName: "div",
              class: "sidebar__section",
              children: [
                {
                  tagName: "div",
                  class: "sidebar__label-row",
                  children: [
                    { tagName: "span", class: "sidebar__label", text: "Boards" },
                    { tagName: "button", type: "button", class: "sidebar__add", text: "+", attrs: { "aria-label": "Board hinzufügen" }, events: { click: actions.openCreateBoard } },
                  ],
                },
                ...workspace.boards.map((board, index) => boardLink(board, workspace.activeBoardId, index, actions)),
              ],
            },
            {
              tagName: "div",
              class: "sidebar__footer",
              children: [
                sidebarLink("?", "Hilfe & Feedback", "#help"),
                { tagName: "button", type: "button", class: "sidebar-link sidebar-settings", events: { click: actions.openAppSettings }, children: [
                  { tagName: "span", class: "sidebar-link__icon", text: "⚙" },
                  { tagName: "span", text: "JaDyBoard Einstellungen" },
                ] },
              ],
            },
          ],
        },
        {
          tagName: "main",
          id: "board",
          class: "board-main",
          children: [
            ...(workspace.persistenceError ? [createPersistenceWarning(actions)] : []),
            {
              tagName: "header",
              class: "board-header",
              children: [
                {
                  tagName: "div",
                  children: [
                    { tagName: "span", class: "breadcrumb", text: state.project.path },
                    { tagName: "h1", text: state.project.name },
                    { tagName: "p", text: state.project.description },
                  ],
                },
                {
                  tagName: "div",
                  class: "board-header__actions",
                  children: [
                    ...configurationButtons,
                    { tagName: "button", type: "button", class: "button button--primary", text: "+ Neue Aufgabe", events: { click: () => actions.openCreateTask("backlog") } },
                  ],
                },
              ],
            },
            {
              tagName: "section",
              class: "board-toolbar",
              attrs: { "aria-label": "Board-Werkzeuge" },
              children: [
                {
                  tagName: "div",
                  class: "view-tabs",
                  children: [
                    { tagName: "button", type: "button", class: "view-tab view-tab--active", text: "Board" },
                    { tagName: "button", type: "button", class: "view-tab", text: "Liste" },
                  ],
                },
                boardMemberStack(state.project, workspace.users, actions, canConfigureBoard),
              ],
            },
            {
              tagName: "form",
              class: "filter-bar",
              attrs: { role: "search" },
              events: { submit: (event) => event.preventDefault() },
              children: createFilterControls(state, viewState, actions),
            },
            {
              tagName: "div",
              id: "kanban-region",
              children: [createKanbanBoard(state, viewState, actions, workspace.users, canConfigureBoard)],
            },
          ],
        },
      ],
    },
    {
      tagName: "div",
      id: "undo-region",
      attrs: { "aria-live": "polite", "aria-atomic": "true" },
      children: viewState.undo
        ? [createUndoSnackbar(viewState.undo.message, actions)]
        : viewState.notice
          ? [createNoticeSnackbar(viewState.notice, actions)]
          : [],
    },
    ...(viewState.createTaskOpen ? [createTaskDialog(state, viewState, actions)] : []),
    ...(viewState.selectedTaskId && state.tasks[viewState.selectedTaskId]
      ? [createTaskDetails(state, actions, state.tasks[viewState.selectedTaskId], workspace.users)]
      : []),
    ...(canConfigureBoard && viewState.boardConfigOpen ? [createBoardConfig(state, actions, workspace.boards.length > 1, workspace.users, workspace.activeUserId)] : []),
    ...(canConfigureBoard && viewState.stageConfigOpen ? [createStageConfig(state, viewState, actions)] : []),
    ...(workspace.createOpen ? [createBoardDialog(actions)] : []),
    ...(workspace.userSettingsOpen ? [createUserSettings(workspace, actions)] : []),
    ...(workspace.appSettingsOpen ? [createAppSettings(workspace, actions)] : []),
  ],
  };
}

/** @param {BoardActions} actions @returns {import("../core/JaDyDoCo.js").JaDyNode} */
function createPersistenceWarning(actions) {
  return {
    tagName: "aside",
    class: "persistence-warning",
    attrs: { role: "alert" },
    children: [
      {
        tagName: "span",
        text: "Änderungen sind nur vorübergehend gespeichert. Der Browserspeicher ist derzeit nicht verfügbar.",
      },
      {
        tagName: "button",
        type: "button",
        class: "button button--secondary",
        text: "Erneut speichern",
        events: { click: actions.retryPersistence },
      },
    ],
  };
}

/**
 * @param {import("../board/board.state.js").BoardState} state
 * @param {BoardActions} actions
 * @param {boolean} canDelete
 * @param {UserView[]} users
 * @param {string} activeUserId
 * @returns {import("../core/JaDyDoCo.js").JaDyNode}
 */
function createBoardConfig(state, actions, canDelete, users, activeUserId) {
  const canManageMembers = activeUserId === state.project.ownerId;
  return {
    tagName: "div",
    class: "drawer-backdrop config-backdrop",
    children: [
      {
        tagName: "aside",
        class: "task-drawer config-drawer",
        attrs: { role: "dialog", "aria-modal": "true", "aria-labelledby": "board-config-title" },
        children: [
          {
            tagName: "header",
            class: "drawer-header",
            children: [
              {
                tagName: "div",
                children: [
                  { tagName: "span", class: "modal__eyebrow", text: "Board-Einstellungen" },
                  { tagName: "h2", id: "board-config-title", text: "Board konfigurieren" },
                ],
              },
              { tagName: "button", type: "button", class: "modal__close", text: "×", attrs: { "aria-label": "Konfiguration schließen" }, events: { click: actions.closeBoardConfig } },
            ],
          },
          {
            tagName: "div",
            class: "config-content",
            children: [
              {
                tagName: "form",
                class: "board-details-form",
                events: { submit: actions.submitBoardDetails },
                children: [
                  { tagName: "h3", text: "Board-Daten" },
                  { tagName: "label", class: "form-label", for: "board-name", text: "Boardname" },
                  { tagName: "input", id: "board-name", type: "text", name: "name", value: state.project.name, required: true },
                  { tagName: "label", class: "form-label", for: "board-description", text: "Untertitel" },
                  { tagName: "textarea", id: "board-description", name: "description", text: state.project.description, attrs: { rows: "3" } },
                  { tagName: "label", class: "form-label", for: "board-owner", text: "Board-Owner" },
                  { tagName: "select", id: "board-owner", name: "ownerId", disabled: !canManageMembers, options: users.map((user) => ({ value: user.id, text: user.name, selected: user.id === state.project.ownerId })) },
                  { tagName: "p", class: ["permission-hint", canManageMembers && "permission-hint--hidden"], text: "Nur der Board-Owner kann Owner und Mitglieder ändern." },
                  { tagName: "fieldset", class: "member-settings", attrs: { disabled: !canManageMembers }, children: [
                    { tagName: "legend", text: "Board-Mitglieder" },
                    ...users.map((user) => memberOption(user, "memberIds", state.project.memberIds.includes(user.id), user.id === state.project.ownerId)),
                  ] },
                  { tagName: "button", type: "submit", class: "button button--secondary", text: "Board-Daten speichern" },
                ],
              },
              {
                tagName: "section",
                class: "board-danger-zone",
                children: [
                  { tagName: "div", children: [
                    { tagName: "h3", text: "Board löschen" },
                    { tagName: "p", text: canDelete ? "Löscht dieses Board inklusive aller Stages und Tasks dauerhaft." : "Das letzte verbleibende Board kann nicht gelöscht werden." },
                  ] },
                  { tagName: "button", type: "button", class: "button button--danger", text: "Board löschen", disabled: !canDelete, events: { click: actions.deleteBoard } },
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
 * @param {import("../board/board.state.js").BoardState} state
 * @param {import("../board/board.view-state.js").BoardViewState} viewState
 * @param {BoardActions} actions
 * @returns {import("../core/JaDyDoCo.js").JaDyNode}
 */
function createStageConfig(state, viewState, actions) {
  return {
    tagName: "div",
    class: "drawer-backdrop config-backdrop",
    children: [{
      tagName: "aside",
      class: "task-drawer config-drawer",
      attrs: { role: "dialog", "aria-modal": "true", "aria-labelledby": "stage-config-title" },
      children: [
        {
          tagName: "header",
          class: "drawer-header",
          children: [
            { tagName: "div", children: [
              { tagName: "span", class: "modal__eyebrow", text: "Workflow-Einstellungen" },
              { tagName: "h2", id: "stage-config-title", text: "Stages konfigurieren" },
            ] },
            { tagName: "button", type: "button", class: "modal__close", text: "×", attrs: { "aria-label": "Stage-Konfiguration schließen" }, events: { click: actions.closeStageConfig } },
          ],
        },
        {
          tagName: "div",
          class: "config-content",
          children: [
            { tagName: "p", class: "config-intro", text: "Lege den Arbeitsablauf fest. Die Reihenfolge entspricht der Darstellung im Board." },
            { tagName: "div", class: "stage-list", children: state.columns.map((column, index) => stageRow(column, index, state.columns.length, actions)) },
            { tagName: "button", type: "button", class: "add-stage", text: "+ Stage hinzufügen", events: { click: actions.createStage } },
            ...(viewState.stageEditor ? [stageEditor(state, viewState, actions)] : []),
          ],
        },
      ],
    }],
  };
}

/**
 * @param {import("../board/board.state.js").BoardColumn} column
 * @param {number} index
 * @param {number} total
 * @param {BoardActions} actions
 * @returns {import("../core/JaDyDoCo.js").JaDyNode}
 */
function stageRow(column, index, total, actions) {
  return {
    tagName: "article",
    class: "stage-row",
    children: [
      { tagName: "span", class: "stage-color", style: { backgroundColor: column.color } },
      {
        tagName: "div",
        class: "stage-row__content",
        children: [
          { tagName: "strong", text: column.title },
          {
            tagName: "small",
            text: column.limit
              ? `${kindLabel(column.kind)} · ${column.taskIds.length} Tasks · Limit ${column.limit} · ${column.limitMode === "strict" ? "blockiert" : "warnt"}`
              : `${kindLabel(column.kind)} · ${column.taskIds.length} Tasks · Kein WIP-Limit`,
          },
        ],
      },
      {
        tagName: "div",
        class: "stage-row__actions",
        children: [
          { tagName: "button", type: "button", text: "←", disabled: index === 0, attrs: { "aria-label": `${column.title} nach links` }, events: { click: () => actions.moveStage(column.id, -1) } },
          { tagName: "button", type: "button", text: "→", disabled: index === total - 1, attrs: { "aria-label": `${column.title} nach rechts` }, events: { click: () => actions.moveStage(column.id, 1) } },
          { tagName: "button", type: "button", text: "Bearbeiten", events: { click: () => actions.editStage(column.id) } },
          { tagName: "button", type: "button", class: "stage-delete", text: "Löschen", disabled: total === 1, events: { click: () => actions.requestDeleteStage(column.id) } },
        ],
      },
    ],
  };
}

/**
 * @param {import("../board/board.state.js").BoardState} state
 * @param {import("../board/board.view-state.js").BoardViewState} viewState
 * @param {BoardActions} actions
 * @returns {import("../core/JaDyDoCo.js").JaDyNode}
 */
function stageEditor(state, viewState, actions) {
  const editor = viewState.stageEditor;
  if (!editor) return { tagName: "div" };
  const column = editor.columnId ? state.columns.find(({ id }) => id === editor.columnId) : null;

  if (editor.mode === "delete" && column) {
    const targets = state.columns.filter(({ id }) => id !== column.id);
    const firstAvailableTarget = targets.find((target) =>
      canAcceptTasks(state, target.id, column.taskIds.length),
    );
    return {
      tagName: "form",
      class: "stage-editor stage-editor--delete",
      events: { submit: actions.confirmDeleteStage },
      children: [
        { tagName: "input", type: "hidden", name: "columnId", value: column.id },
        { tagName: "h3", text: `„${column.title}“ löschen?` },
        { tagName: "p", text: column.taskIds.length ? `${column.taskIds.length} Tasks müssen in eine andere Stage verschoben werden.` : "Diese Stage enthält keine Tasks." },
        { tagName: "label", class: "form-label", for: "delete-target", text: "Tasks verschieben nach" },
        {
          tagName: "select",
          id: "delete-target",
          name: "moveTasksTo",
          disabled: !column.taskIds.length,
          options: targets.map((target) => ({
            value: target.id,
            text: canAcceptTasks(state, target.id, column.taskIds.length)
              ? target.title
              : `${target.title} – nicht genügend Kapazität`,
            disabled: !canAcceptTasks(state, target.id, column.taskIds.length),
            selected: target.id === firstAvailableTarget?.id,
          })),
        },
        editorButtons(actions, true, Boolean(column.taskIds.length && !firstAvailableTarget)),
      ],
    };
  }

  const values = column ?? { id: "", title: "", color: "#9297a0", kind: "active", limit: null, limitMode: "warning", allowedTargetIds: null, requireCompletedTodos: false };
  return {
    tagName: "form",
    id: "stage-editor",
    class: "stage-editor",
    events: { submit: actions.submitStage },
    children: [
      { tagName: "input", type: "hidden", name: "columnId", value: values.id },
      { tagName: "h3", text: column ? "Stage bearbeiten" : "Neue Stage" },
      { tagName: "label", class: "form-label", for: "stage-title", text: "Name" },
      { tagName: "input", id: "stage-title", type: "text", name: "title", value: values.title, required: true },
      {
        tagName: "div",
        class: "form-grid",
        children: [
          {
            tagName: "div",
            children: [
              { tagName: "label", class: "form-label", for: "stage-color", text: "Farbe" },
              { tagName: "input", id: "stage-color", type: "color", name: "color", value: values.color },
            ],
          },
          {
            tagName: "div",
            children: [
              { tagName: "label", class: "form-label", for: "stage-kind", text: "Typ" },
              { tagName: "select", id: "stage-kind", name: "kind", options: ["backlog", "active", "review", "done"].map((kind) => ({ value: kind, text: kindLabel(kind), selected: kind === values.kind })) },
            ],
          },
        ],
      },
      {
        tagName: "fieldset",
        class: "wip-settings",
        children: [
          { tagName: "legend", text: "WIP-Limit" },
          {
            tagName: "p",
            class: "field-help",
            text: "Begrenzt die Anzahl gleichzeitig erlaubter Tasks in dieser Stage. Ohne Zahl besteht kein Limit.",
          },
          { tagName: "label", class: "form-label", for: "stage-limit", text: "Maximale Tasks" },
          {
            tagName: "input",
            id: "stage-limit",
            type: "number",
            name: "limit",
            value: values.limit ?? "",
            min: 1,
            step: 1,
            placeholder: "z. B. 3",
            events: {
              input: (event) => {
                if (!(event.currentTarget instanceof HTMLInputElement)) return;
                const form = event.currentTarget.form;
                const mode = form?.elements.namedItem("limitMode");
                if (!(mode instanceof HTMLSelectElement)) return;
                mode.disabled = event.currentTarget.value === "";
                if (mode.disabled) mode.value = "warning";
              },
            },
          },
          { tagName: "label", class: "form-label", for: "stage-limit-mode", text: "Bei erreichtem Limit" },
          {
            tagName: "select",
            id: "stage-limit-mode",
            name: "limitMode",
            disabled: values.limit === null,
            options: [
              { value: "warning", text: "Nur warnen", selected: values.limitMode === "warning" },
              { value: "strict", text: "Weitere Tasks blockieren", selected: values.limitMode === "strict" },
            ],
          },
          {
            tagName: "p",
            class: values.limit ? "wip-status" : "wip-status wip-status--none",
            text: values.limit
              ? `Aktuell: maximal ${values.limit} Tasks, danach ${values.limitMode === "strict" ? "blockieren" : "warnen"}`
              : "Aktuell: Kein WIP-Limit",
          },
        ],
      },
      {
        tagName: "fieldset",
        class: "transition-settings",
        children: [
          { tagName: "legend", text: "Erlaubte Übergänge" },
          { tagName: "p", class: "field-help", text: "Bestimmt, in welche Stages Tasks von hier aus verschoben werden dürfen." },
          ...state.columns
            .filter((target) => target.id !== values.id)
            .map((target) => transitionOption(target, values.allowedTargetIds)),
        ],
      },
      {
        tagName: "fieldset",
        class: "completion-rule",
        children: [
          { tagName: "legend", text: "Abschlussregel" },
          { tagName: "label", class: "transition-option", children: [
            { tagName: "input", type: "checkbox", name: "requireCompletedTodos", value: "true", checked: values.requireCompletedTodos },
            { tagName: "span", children: [
              { tagName: "strong", text: "Erledigte Todos voraussetzen" },
              { tagName: "small", text: "Tasks mit offenen Todos dürfen nicht in diese Stage verschoben werden." },
            ] },
          ] },
        ],
      },
      editorButtons(actions, false, false),
    ],
  };
}

/**
 * @param {import("../board/board.state.js").BoardColumn} target
 * @param {string[] | null} allowedTargetIds
 * @returns {import("../core/JaDyDoCo.js").JaDyNode}
 */
function transitionOption(target, allowedTargetIds) {
  return {
    tagName: "label",
    class: "transition-option",
    children: [
      { tagName: "input", type: "checkbox", name: "allowedTargetIds", value: target.id, checked: allowedTargetIds === null || allowedTargetIds.includes(target.id) },
      { tagName: "span", class: "stage-color", style: { backgroundColor: target.color } },
      { tagName: "span", text: target.title },
    ],
  };
}

/**
 * @param {BoardActions} actions
 * @param {boolean} destructive
 * @param {boolean} disabled
 * @returns {import("../core/JaDyDoCo.js").JaDyNode}
 */
function editorButtons(actions, destructive, disabled) {
  return {
    tagName: "footer",
    class: "stage-editor__actions",
    children: [
      { tagName: "button", type: "button", class: "button button--secondary", text: "Abbrechen", events: { click: actions.cancelStageEditor } },
      { tagName: "button", type: "submit", class: ["button", destructive ? "button--danger" : "button--primary"], text: destructive ? "Stage löschen" : "Speichern", disabled },
    ],
  };
}

/** @param {string} kind */
function kindLabel(kind) {
  /** @type {Record<string, string>} */
  const labels = { backlog: "Backlog", active: "In Arbeit", review: "Review", done: "Erledigt" };
  return labels[kind] ?? "In Arbeit";
}

/**
 * @param {import("../board/board.state.js").BoardState} state
 * @param {import("../board/board.view-state.js").BoardViewState} viewState
 * @param {BoardActions} actions
 * @param {UserView[]} [users]
 * @param {boolean} [canConfigure]
 * @returns {import("../core/JaDyDoCo.js").JaDyNode}
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

  /** @type {import("../core/JaDyDoCo.js").JaDyNode[]} */
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
 * @param {import("../board/board.state.js").BoardState} state
 * @param {import("../board/board.view-state.js").BoardViewState} viewState
 * @param {BoardActions} actions
 * @returns {import("../core/JaDyDoCo.js").JaDyNode[]}
 */
/**
 * @param {boolean} filtered
 * @returns {import("../core/JaDyDoCo.js").JaDyNode}
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
 * @param {string} icon
 * @param {string} label
 * @param {string} href
 * @param {boolean} [active]
 * @returns {import("../core/JaDyDoCo.js").JaDyNode}
 */
function sidebarLink(icon, label, href, active = false) {
  return {
    tagName: "a",
    class: ["sidebar-link", active && "sidebar-link--active"],
    href,
    children: [
      { tagName: "span", class: "sidebar-link__icon", text: icon },
      { tagName: "span", text: label },
    ],
  };
}

/** @param {import("../board/board.state.js").BoardProject} project @param {UserView[]} users @param {BoardActions} actions @param {boolean} canConfigure @returns {import("../core/JaDyDoCo.js").JaDyNode} */
function boardMemberStack(project, users, actions, canConfigure) {
  const owner = users.find((item) => item.id === project.ownerId);
  const memberIds = [...new Set(project.memberIds.filter((id) => id !== project.ownerId))];
  const visible = memberIds.slice(0, 3);
  const remaining = Math.max(0, memberIds.length - visible.length);
  /** @type {import("../core/JaDyDoCo.js").JaDyNode[]} */
  const avatars = visible.map((id, index) => {
    const user = users.find((item) => item.id === id);
    return {
      tagName: "span",
      class: ["member", `member--${index + 1}`],
      text: user?.initials ?? "?",
      attrs: { title: `${user?.name ?? "Unbekannt"} · Board-Mitglied` },
    };
  });
  if (remaining) avatars.push({ tagName: "span", class: "member member--more", text: `+${remaining}`, attrs: { title: `${remaining} weitere Board-Mitglieder` } });
  /** @type {import("../core/JaDyDoCo.js").JaDyNode[]} */
  const children = [{ tagName: "span", class: "board-owner", children: [
    { tagName: "span", class: "member board-owner__avatar", text: owner?.initials ?? "?", attrs: { title: `${owner?.name ?? "Unbekannt"} · Board-Owner` } },
  ] }];
  if (avatars.length) {
    children.push({ tagName: "span", class: "member-stack__members", children: avatars });
  }
  if (canConfigure) {
    return {
      tagName: "button",
      type: "button",
      class: "member-stack",
      attrs: { "aria-label": `Board-Owner und ${memberIds.length} Mitglieder verwalten` },
      events: { click: actions.openBoardConfig },
      children,
    };
  }
  return {
    tagName: "div",
    class: "member-stack",
    attrs: { "aria-label": `Board-Owner und ${memberIds.length} Mitglieder` },
    children,
  };
}

/**
 * @param {{id: string, name: string}} board
 * @param {string} activeBoardId
 * @param {number} index
 * @param {BoardActions} actions
 * @returns {import("../core/JaDyDoCo.js").JaDyNode}
 */
function boardLink(board, activeBoardId, index, actions) {
  const colors = ["#8b7cf6", "#57b894", "#e5a84b", "#ef8d8d"];
  return {
    tagName: "button",
    type: "button",
    class: ["project-link", "board-link", board.id === activeBoardId && "board-link--active"],
    attrs: { "aria-current": board.id === activeBoardId ? "page" : undefined },
    events: { click: () => actions.switchBoard(board.id) },
    children: [
      { tagName: "span", class: "project-dot", style: { backgroundColor: colors[index % colors.length] } },
      { tagName: "span", text: board.name },
    ],
  };
}

/**
 * @param {string} title
 * @param {string} count
 * @param {string} status
 * @param {string} color
 * @param {number | null} limit
 * @param {import("../board/board.state.js").LimitMode} limitMode
 * @param {number} totalTasks
 * @param {boolean} canAddTask
 * @param {boolean} menuOpen
 * @param {number} columnIndex
 * @param {number} columnCount
 * @param {import("../core/JaDyDoCo.js").JaDyNode[]} cards
 * @param {BoardActions} actions
 * @param {boolean} dragEnabled
 * @param {boolean} canConfigure
 * @returns {import("../core/JaDyDoCo.js").JaDyNode}
 */
function kanbanColumn(title, count, status, color, limit, limitMode, totalTasks, canAddTask, menuOpen, columnIndex, columnCount, cards, actions, dragEnabled, canConfigure) {
  const limitReached = limit !== null && totalTasks >= limit;
  /** @type {import("../core/JaDyDoCo.js").JaDyNode[]} */
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
 * @param {BoardActions} actions
 * @returns {import("../core/JaDyDoCo.js").JaDyNode}
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
 * @param {BoardActions} actions
 * @returns {import("../core/JaDyDoCo.js").JaDyNode}
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
 * @returns {import("../core/JaDyDoCo.js").JaDyNode}
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

/** @typedef {{id: string, name: string, initials: string, preferences: {theme: string}}} UserView */
/** @param {UserView} user @param {string} name @param {boolean} checked @param {boolean} disabled @returns {import("../core/JaDyDoCo.js").JaDyNode} */
function memberOption(user, name, checked, disabled) {
  return {
    tagName: "label",
    class: "member-option",
    children: [
      { tagName: "input", type: "checkbox", name, value: user.id, checked, disabled },
      { tagName: "span", class: "avatar", text: user.initials },
      { tagName: "span", text: user.name },
    ],
  };
}

/** @param {import("../board/board.state.js").BoardTask} task @param {UserView[]} users @returns {import("../core/JaDyDoCo.js").JaDyNode[]} */
function taskPeople(task, users) {
  const ids = [...new Set([task.ownerId, ...task.memberIds].filter(Boolean))];
  if (!ids.length) return [{ tagName: "span", class: "task-member", text: task.assignee, attrs: { title: "Verantwortlich (Bestandsdaten)" } }];
  return ids.slice(0, 3).map((id) => {
    const user = users.find((item) => item.id === id);
    return { tagName: "span", class: ["task-member", id === task.ownerId && "task-member--owner"], text: user?.initials ?? "?", attrs: { title: `${user?.name ?? "Unbekannt"}${id === task.ownerId ? " · Owner" : ""}` } };
  });
}

/** @param {BoardActions} actions @returns {import("../core/JaDyDoCo.js").JaDyNode} */
function createBoardDialog(actions) {
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

/** @param {string} value @param {string} label @param {boolean} checked @returns {import("../core/JaDyDoCo.js").JaDyNode} */
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
 * @param {import("../board/board.state.js").BoardTask} task
 * @param {boolean} done
 * @param {BoardActions} actions
 * @param {boolean} dragEnabled
 * @param {UserView[]} [users]
 * @returns {import("../core/JaDyDoCo.js").JaDyNode}
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

/** @param {string} dueDate @param {boolean} done @returns {import("../core/JaDyDoCo.js").JaDyNode} */
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

/** @param {import("../board/board.state.js").BoardTask} task @param {number} completedTodos @returns {import("../core/JaDyDoCo.js").JaDyNode} */
function taskTodoPreview(task, completedTodos) {
  const ready = completedTodos === task.todos.length;
  const hiddenCount = Math.max(0, task.todos.length - 3);
  /** @type {import("../core/JaDyDoCo.js").JaDyNode[]} */
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

/** @param {import("../board/board.state.js").BoardTask} task @param {number} completedTodos @returns {import("../core/JaDyDoCo.js").JaDyNode} */
function taskCardStats(task, completedTodos) {
  /** @type {import("../core/JaDyDoCo.js").JaDyNode[]} */
  const children = [];
  if (task.todos.length) children.push({ tagName: "span", class: ["task-todos", completedTodos === task.todos.length && "task-todos--complete"], text: `✓ ${completedTodos}/${task.todos.length}` });
  children.push({ tagName: "span", class: "task-comments", text: commentLabel(task.comments) });
  return { tagName: "div", class: "task-card__stats", children };
}

/**
 * @param {import("../board/board.state.js").BoardState} state
 * @param {import("../board/board.view-state.js").BoardViewState} viewState
 * @param {BoardActions} actions
 * @returns {import("../core/JaDyDoCo.js").JaDyNode}
 */
function createTaskDialog(state, viewState, actions) {
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
 * @param {import("../board/board.state.js").BoardState} state
 * @param {BoardActions} actions
 * @param {import("../board/board.state.js").BoardTask} task
 * @param {UserView[]} users
 * @returns {import("../core/JaDyDoCo.js").JaDyNode}
 */
function createTaskDetails(state, actions, task, users) {
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

/** @param {import("../board/board.state.js").BoardTask} task @param {BoardActions} actions @returns {import("../core/JaDyDoCo.js").JaDyNode} */
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

/** @param {string} taskId @param {import("../board/board.state.js").TaskTodo} todo @param {BoardActions} actions @returns {import("../core/JaDyDoCo.js").JaDyNode} */
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

/** @param {"low" | "medium" | "high"} priority */
function priorityLabel(priority) {
  return { low: "Niedrig", medium: "Mittel", high: "Hoch" }[priority] ?? "Mittel";
}

/** @param {number} comments @returns {string} */
function commentLabel(comments) {
  if (!comments) return "";
  return `${comments} ${comments === 1 ? "Kommentar" : "Kommentare"}`;
}

