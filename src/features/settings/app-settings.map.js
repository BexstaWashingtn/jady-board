/** @typedef {{id: string, preferences: {theme: string}}} UserView */
/** @typedef {{ closeAppSettings: () => void, setTheme: (theme: string) => void, exportWorkspace: () => void, openWorkspaceImportPicker: () => void, previewWorkspaceImport: (event: Event) => void, cancelWorkspaceImport: () => void, confirmWorkspaceImport: () => void }} AppSettingsActions */

/** @param {{activeUserId: string, users: UserView[], transfer: { preview: import("../../board/board.transfer.js").ImportPreview | null, error: string | null, lastExportedAt: string | null }}} workspace @param {AppSettingsActions} actions @returns {import("../../core/JaDyDoCo.js").JaDyNode} */
export function createAppSettings(workspace, actions) {
  const active = workspace.users.find(({ id }) => id === workspace.activeUserId) ?? workspace.users[0];
  const { preview, error, lastExportedAt } = workspace.transfer;
  return { tagName: "div", class: "modal-backdrop", children: [{ tagName: "section", class: "modal user-settings-modal", attrs: { role: "dialog", "aria-modal": "true", "aria-labelledby": "app-settings-title" }, children: [
    { tagName: "header", class: "modal__header", children: [
      { tagName: "div", children: [{ tagName: "span", class: "modal__eyebrow", text: "JaDyBoard" }, { tagName: "h2", id: "app-settings-title", text: "Einstellungen" }] },
      { tagName: "button", type: "button", class: "modal__close", text: "×", attrs: { "aria-label": "Einstellungen schließen" }, events: { click: actions.closeAppSettings } },
    ] },
    { tagName: "div", class: "user-settings-body", children: [
      { tagName: "section", class: "app-settings-section", children: [
        { tagName: "h3", text: "Darstellung" },
        { tagName: "label", class: "form-label", for: "app-theme", text: "Farbschema" },
        { tagName: "select", id: "app-theme", name: "theme", options: [
          { value: "system", text: "Systemeinstellung", selected: active?.preferences.theme === "system" },
          { value: "light", text: "Hell", selected: active?.preferences.theme === "light" },
          { value: "dark", text: "Dunkel", selected: active?.preferences.theme === "dark" },
        ], events: { change: (event) => {
          if (event.currentTarget instanceof HTMLSelectElement) actions.setTheme(event.currentTarget.value);
        } } },
      ] },
      { tagName: "section", class: "app-settings-section app-settings-section--backup", attrs: { "aria-labelledby": "backup-settings-title" }, children: [
        { tagName: "h3", id: "backup-settings-title", text: "Daten & Backup" },
        { tagName: "p", class: "field-help", text: "Sichere alle Boards, Aufgaben, Benutzerprofile und Einstellungen in einer JSON-Datei." },
        { tagName: "div", class: "backup-actions", children: [
          { tagName: "button", type: "button", class: "button button--secondary", text: "Workspace exportieren", events: { click: actions.exportWorkspace } },
          { tagName: "button", type: "button", class: "button button--secondary", text: "Backup importieren", events: { click: actions.openWorkspaceImportPicker } },
          { tagName: "input", id: "workspace-backup-file", type: "file", hidden: true, attrs: { accept: "application/json,.json" }, events: { change: actions.previewWorkspaceImport } },
        ] },
        .../** @type {import("../../core/JaDyDoCo.js").JaDyNode[]} */ (lastExportedAt ? [{ tagName: "p", class: "backup-status", text: `Zuletzt exportiert: ${formatDate(lastExportedAt)}` }] : []),
        .../** @type {import("../../core/JaDyDoCo.js").JaDyNode[]} */ (error ? [{ tagName: "p", class: "backup-error", role: "alert", text: error }] : []),
        .../** @type {import("../../core/JaDyDoCo.js").JaDyNode[]} */ (preview ? [importPreview(preview, actions)] : []),
      ] },
    ] },
  ] }] };
}

/** @param {import("../../board/board.transfer.js").ImportPreview} preview @param {AppSettingsActions} actions @returns {import("../../core/JaDyDoCo.js").JaDyNode} */
function importPreview(preview, actions) {
  return { tagName: "section", class: "backup-preview", attrs: { "aria-labelledby": "backup-preview-title" }, children: [
    { tagName: "h4", id: "backup-preview-title", text: `Backup vom ${formatDate(preview.exportedAt)}` },
    { tagName: "p", text: `${preview.boardCount} ${preview.boardCount === 1 ? "Board" : "Boards"} · ${preview.userCount} ${preview.userCount === 1 ? "Benutzer" : "Benutzer"} · ${preview.taskCount} Aufgaben` },
    { tagName: "p", class: "backup-warning", text: "Der aktuelle Workspace wird vor dem Ersetzen automatisch gesichert." },
    { tagName: "div", class: "backup-actions", children: [
      { tagName: "button", type: "button", class: "button button--secondary", text: "Abbrechen", events: { click: actions.cancelWorkspaceImport } },
      { tagName: "button", type: "button", class: "button button--danger", text: "Workspace ersetzen", events: { click: actions.confirmWorkspaceImport } },
    ] },
  ] };
}

/** @param {string} value */
function formatDate(value) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
