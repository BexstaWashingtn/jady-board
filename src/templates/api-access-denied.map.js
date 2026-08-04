/**
 * @param {{apiSource: string, message: string, changeAccount: () => void, useLocal: () => void}} options
 * @returns {import("../core/JaDyDoCo.js").JaDyNode}
 */
export function createApiAccessDeniedPage({ apiSource, message, changeAccount, useLocal }) {
  return { tagName: "main", class: "startup-error", children: [{
    tagName: "section", class: "startup-error__card", attrs: { "aria-labelledby": "access-denied-title" }, children: [
      { tagName: "p", class: "startup-error__eyebrow", text: "JaDy Board · Clerk" },
      { tagName: "h1", id: "access-denied-title", text: "Noch kein Zugriff" },
      { tagName: "p", text: "Deine Clerk-Anmeldung war erfolgreich, ist aber noch keinem aktiven JaDy-Board-Benutzer zugeordnet." },
      { tagName: "p", class: "backup-error", role: "alert", text: message },
      { tagName: "p", text: `Die Zuordnung für ${apiSource} wird ausschließlich in PostgreSQL verwaltet.` },
      { tagName: "div", class: "startup-error__actions", children: [
        { tagName: "button", type: "button", class: "button button--primary", text: "Anderes Konto verwenden", events: { click: changeAccount } },
        { tagName: "button", type: "button", class: "button", text: "Stattdessen lokal fortfahren", events: { click: useLocal } },
      ] },
    ],
  }] };
}
