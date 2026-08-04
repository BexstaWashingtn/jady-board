/**
 * @param {{apiSource: string, retry: () => void, useLocal: () => void}} options
 * @returns {import("../core/JaDyDoCo.js").JaDyNode}
 */
export function createApiUnavailablePage({ apiSource, retry, useLocal }) {
  return {
    tagName: "main", class: "startup-error",
    children: [{
      tagName: "section", class: "startup-error__card", attrs: { role: "alert", "aria-labelledby": "startup-error-title" },
      children: [
        { tagName: "p", class: "startup-error__eyebrow", text: "API-Modus" },
        { tagName: "h1", id: "startup-error-title", text: "Server nicht erreichbar" },
        { tagName: "p", text: `JaDy Board konnte keine Daten von ${apiSource} laden. Es wurde nicht auf lokale Daten umgeschaltet, damit Änderungen nicht versehentlich im falschen Workspace landen.` },
        { tagName: "div", class: "startup-error__actions", children: [
          { tagName: "button", type: "button", class: "button button--primary", text: "Erneut versuchen", events: { click: retry } },
          { tagName: "button", type: "button", class: "button", text: "Bewusst lokal fortfahren", events: { click: useLocal } },
        ] },
      ],
    }],
  };
}
