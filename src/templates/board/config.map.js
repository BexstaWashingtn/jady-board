import { canAcceptTasks } from "../../board/board.state.js";
import { memberOption } from "./shared.map.js";

/**
 * @param {import("../../board/board.state.js").BoardState} state
 * @param {import("./board.types.js").BoardActions} actions
 * @param {boolean} canDelete
 * @param {import("./board.types.js").UserView[]} users
 * @param {string} activeUserId
 * @returns {import("../../core/JaDyDoCo.js").JaDyNode}
 */
export function createBoardConfig(state, actions, canDelete, users, activeUserId) {
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
 * @param {import("../../board/board.state.js").BoardState} state
 * @param {import("../../board/board.view-state.js").BoardViewState} viewState
 * @param {import("./board.types.js").BoardActions} actions
 * @returns {import("../../core/JaDyDoCo.js").JaDyNode}
 */
export function createStageConfig(state, viewState, actions) {
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
 * @param {import("../../board/board.state.js").BoardColumn} column
 * @param {number} index
 * @param {number} total
 * @param {import("./board.types.js").BoardActions} actions
 * @returns {import("../../core/JaDyDoCo.js").JaDyNode}
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
 * @param {import("../../board/board.state.js").BoardState} state
 * @param {import("../../board/board.view-state.js").BoardViewState} viewState
 * @param {import("./board.types.js").BoardActions} actions
 * @returns {import("../../core/JaDyDoCo.js").JaDyNode}
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
 * @param {import("../../board/board.state.js").BoardColumn} target
 * @param {string[] | null} allowedTargetIds
 * @returns {import("../../core/JaDyDoCo.js").JaDyNode}
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
 * @param {import("./board.types.js").BoardActions} actions
 * @param {boolean} destructive
 * @param {boolean} disabled
 * @returns {import("../../core/JaDyDoCo.js").JaDyNode}
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




