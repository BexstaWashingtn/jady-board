/** @typedef {{id: string, name: string, initials: string, preferences: {theme: string}}} UserView */
/** @typedef {{ closeUserSettings: () => void, submitUser: EventListener, createUser: EventListener, deleteUser: () => void, switchUser: (id: string) => void }} UserSettingsActions */

/** @param {{activeUserId: string, users: UserView[]}} workspace @param {UserSettingsActions} actions @returns {import("../../core/JaDyDoCo.js").JaDyNode} */
export function createUserSettings(workspace, actions) {
  const active = workspace.users.find(({ id }) => id === workspace.activeUserId) ?? workspace.users[0];
  return { tagName: "div", class: "modal-backdrop", children: [{ tagName: "section", class: "modal user-settings-modal", attrs: { role: "dialog", "aria-modal": "true", "aria-labelledby": "user-settings-title" }, children: [
    { tagName: "header", class: "modal__header", children: [
      { tagName: "div", children: [{ tagName: "span", class: "modal__eyebrow", text: "JaDyBoard Einstellungen" }, { tagName: "h2", id: "user-settings-title", text: "Benutzerprofile" }] },
      { tagName: "button", type: "button", class: "modal__close", text: "×", attrs: { "aria-label": "Einstellungen schließen" }, events: { click: actions.closeUserSettings } },
    ] },
    { tagName: "div", class: "user-settings-body", children: [
      { tagName: "nav", class: "user-list", attrs: { "aria-label": "Benutzer auswählen" }, children: workspace.users.map((user) => userListItem(user, workspace.activeUserId, actions)) },
      { tagName: "form", class: "user-form", events: { submit: actions.submitUser }, children: [
        { tagName: "h3", text: "Aktives Profil" },
        { tagName: "label", class: "form-label", for: "user-name", text: "Name" },
        { tagName: "input", id: "user-name", type: "text", name: "name", value: active?.name ?? "", required: true },
        { tagName: "label", class: "form-label", for: "user-initials", text: "Initialen" },
        { tagName: "input", id: "user-initials", type: "text", name: "initials", value: active?.initials ?? "", attrs: { maxlength: "2" } },
        { tagName: "div", class: "user-form__actions", children: [
          { tagName: "button", type: "button", class: "button button--danger", text: "Benutzer löschen", disabled: workspace.users.length === 1, events: { click: actions.deleteUser } },
          { tagName: "button", type: "submit", class: "button button--primary", text: "Profil speichern" },
        ] },
      ] },
      { tagName: "form", class: "user-form user-form--new", events: { submit: actions.createUser }, children: [
        { tagName: "h3", text: "Neuen Benutzer anlegen" },
        { tagName: "div", class: "form-grid", children: [
          { tagName: "div", children: [{ tagName: "label", class: "form-label", for: "new-user-name", text: "Name" }, { tagName: "input", id: "new-user-name", type: "text", name: "name", required: true }] },
          { tagName: "div", children: [{ tagName: "label", class: "form-label", for: "new-user-initials", text: "Initialen" }, { tagName: "input", id: "new-user-initials", type: "text", name: "initials", attrs: { maxlength: "2" } }] },
        ] },
        { tagName: "button", type: "submit", class: "button button--secondary", text: "+ Benutzer anlegen" },
      ] },
    ] },
  ] }] };
}

/** @param {UserView} user @param {string} activeUserId @param {UserSettingsActions} actions @returns {import("../../core/JaDyDoCo.js").JaDyNode} */
function userListItem(user, activeUserId, actions) {
  return { tagName: "button", type: "button", class: ["user-list__item", user.id === activeUserId && "user-list__item--active"], events: { click: () => actions.switchUser(user.id) }, children: [
    { tagName: "span", class: "avatar", text: user.initials },
    { tagName: "span", text: user.name },
  ] };
}
