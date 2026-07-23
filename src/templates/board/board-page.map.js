import { canConfigureBoard as userCanConfigureBoard, canCreateTask } from "../../board/board.permissions.js";
import { createFilterControls } from "../../features/filters/filter.map.js";
import { createNoticeSnackbar, createUndoSnackbar } from "../../features/feedback/feedback.map.js";
import { createUserSettings } from "../../features/users/user-settings.map.js";
import { createAppSettings } from "../../features/settings/app-settings.map.js";
import { createBoardConfig, createStageConfig, createStageEditorDialog } from "./config.map.js";
import { createBoardContent } from "./board-content.map.js";
import { createBoardDialog, createTaskDetails, createTaskDialog } from "./dialogs.map.js";

/**
 * @param {import("../../board/board.state.js").BoardState} state
 * @param {import("../../board/board.view-state.js").BoardViewState} viewState
 * @param {import("./board.types.js").BoardActions} actions
 * @param {{ activeBoardId: string, boards: Array<{id: string, name: string}>, createOpen: boolean, userSettingsOpen: boolean, appSettingsOpen: boolean, activeUserId: string, users: Array<{id: string, name: string, initials: string, preferences: {theme: string}}>, persistenceError: boolean, transfer: { preview: import("../../board/board.transfer.js").ImportPreview | null, error: string | null, lastExportedAt: string | null } }} workspace
 * @returns {import("../../core/JaDyDoCo.js").JaDyNode}
 */
export function createBoardPage(state, viewState, actions, workspace) {
  const canConfigureBoard = userCanConfigureBoard(state, workspace.activeUserId);
  const canCreate = canCreateTask(state, workspace.activeUserId);
  /** @type {import("../../core/JaDyDoCo.js").JaDyNode[]} */
  const configurationButtons = canConfigureBoard
    ? [
        { tagName: "button", type: "button", class: "button button--secondary", text: "Board konfigurieren", events: { click: actions.openBoardConfig } },
        { tagName: "button", type: "button", class: "button button--secondary", text: "Stages konfigurieren", events: { click: actions.openStageConfig } },
      ]
    : [];
  /** @type {import("../../core/JaDyDoCo.js").JaDyNode[]} */
  const taskCreationButtons = canCreate
    ? [{ tagName: "button", type: "button", class: "button button--primary", text: "+ Neue Aufgabe", events: { click: () => actions.openCreateTask() } }]
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
                    ...taskCreationButtons,
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
                  attrs: { role: "tablist", "aria-label": "Board-Ansicht" },
                  children: [
                    viewTab("board", "Board", viewState, actions),
                    viewTab("list", "Liste", viewState, actions),
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
              children: createFilterControls(state, viewState, actions, workspace.users),
            },
            {
              tagName: "div",
              id: "board-content-region",
              attrs: { role: "tabpanel" },
              children: [createBoardContent(state, viewState, actions, workspace.users, canConfigureBoard, workspace.activeUserId, canCreate)],
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
    ...(viewState.createTaskOpen ? [createTaskDialog(state, viewState, actions, workspace.users, workspace.activeUserId)] : []),
    ...(viewState.selectedTaskId && state.tasks[viewState.selectedTaskId]
      ? [createTaskDetails(state, actions, state.tasks[viewState.selectedTaskId], workspace.users, workspace.activeUserId, viewState.taskEditOpen)]
      : []),
    ...(canConfigureBoard && viewState.boardConfigOpen ? [createBoardConfig(state, actions, workspace.boards.length > 1, workspace.users, workspace.activeUserId)] : []),
    ...(canConfigureBoard && viewState.stageConfigOpen ? [createStageConfig(state, viewState, actions)] : []),
    ...(canConfigureBoard && viewState.stageEditor && !viewState.stageConfigOpen ? [createStageEditorDialog(state, viewState, actions)] : []),
    ...(workspace.createOpen ? [createBoardDialog(actions)] : []),
    ...(workspace.userSettingsOpen ? [createUserSettings(workspace, actions)] : []),
    ...(workspace.appSettingsOpen ? [createAppSettings(workspace, actions)] : []),
  ],
  };
}

/** @param {"board"|"list"} mode @param {string} label @param {import("../../board/board.view-state.js").BoardViewState} viewState @param {import("./board.types.js").BoardActions} actions @returns {import("../../core/JaDyDoCo.js").JaDyNode} */
function viewTab(mode, label, viewState, actions) {
  const active = viewState.viewMode === mode;
  return {
    tagName: "button",
    type: "button",
    class: ["view-tab", active && "view-tab--active"],
    text: label,
    attrs: { role: "tab", "aria-selected": String(active), tabindex: active ? "0" : "-1" },
    events: { click: () => actions.setViewMode(mode) },
  };
}

/** @param {import("./board.types.js").BoardActions} actions @returns {import("../../core/JaDyDoCo.js").JaDyNode} */
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
 * @param {string} icon
 * @param {string} label
 * @param {string} href
 * @param {boolean} [active]
 * @returns {import("../../core/JaDyDoCo.js").JaDyNode}
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

/** @param {import("../../board/board.state.js").BoardProject} project @param {import("./board.types.js").UserView[]} users @param {import("./board.types.js").BoardActions} actions @param {boolean} canConfigure @returns {import("../../core/JaDyDoCo.js").JaDyNode} */
function boardMemberStack(project, users, actions, canConfigure) {
  const owner = users.find((item) => item.id === project.ownerId);
  const memberIds = [...new Set(project.memberIds.filter((id) => id !== project.ownerId))];
  const visible = memberIds.slice(0, 3);
  const remaining = Math.max(0, memberIds.length - visible.length);
  /** @type {import("../../core/JaDyDoCo.js").JaDyNode[]} */
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
  /** @type {import("../../core/JaDyDoCo.js").JaDyNode[]} */
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
 * @param {import("./board.types.js").BoardActions} actions
 * @returns {import("../../core/JaDyDoCo.js").JaDyNode}
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
