/** @typedef {{id: string, preferences: {theme: string}}} UserView */
/** @typedef {{ closeAppSettings: () => void, setTheme: (theme: string) => void }} AppSettingsActions */

/** @param {{activeUserId: string, users: UserView[]}} workspace @param {AppSettingsActions} actions @returns {import("../../core/JaDyDoCo.js").JaDyNode} */
export function createAppSettings(workspace, actions) {
  const active = workspace.users.find(({ id }) => id === workspace.activeUserId) ?? workspace.users[0];
  return { tagName: "div", class: "modal-backdrop", children: [{ tagName: "section", class: "modal user-settings-modal", attrs: { role: "dialog", "aria-modal": "true", "aria-labelledby": "app-settings-title" }, children: [
    { tagName: "header", class: "modal__header", children: [
      { tagName: "div", children: [{ tagName: "span", class: "modal__eyebrow", text: "JaDyBoard Einstellungen" }, { tagName: "h2", id: "app-settings-title", text: "Darstellung" }] },
      { tagName: "button", type: "button", class: "modal__close", text: "×", attrs: { "aria-label": "Einstellungen schließen" }, events: { click: actions.closeAppSettings } },
    ] },
    { tagName: "div", class: "user-settings-body", children: [
      { tagName: "label", class: "form-label", for: "app-theme", text: "Farbschema" },
      { tagName: "select", id: "app-theme", name: "theme", options: [
        { value: "system", text: "Systemeinstellung", selected: active?.preferences.theme === "system" },
        { value: "light", text: "Hell", selected: active?.preferences.theme === "light" },
        { value: "dark", text: "Dunkel", selected: active?.preferences.theme === "dark" },
      ], events: { change: (event) => {
        if (event.currentTarget instanceof HTMLSelectElement) actions.setTheme(event.currentTarget.value);
      } } },
    ] },
  ] }] };
}
