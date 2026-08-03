/**
 * @param {{apiSource: string, error: string|null, submit: (event: Event) => void, useLocal: () => void}} options
 * @returns {import("../core/JaDyDoCo.js").JaDyNode}
 */
export function createApiLoginPage({ apiSource, error, submit, useLocal }) {
  return { tagName: "main", class: "startup-error", children: [{
    tagName: "section", class: "startup-error__card", attrs: { "aria-labelledby": "api-login-title" }, children: [
      { tagName: "p", class: "startup-error__eyebrow", text: "Geschützter API-Modus" },
      { tagName: "h1", id: "api-login-title", text: "Mit Server verbinden" },
      { tagName: "p", text: `Gib dein Zugriffstoken für ${apiSource} ein. Es wird ausschließlich für diese Browser-Sitzung gespeichert.` },
      { tagName: "form", class: "startup-login", events: { submit }, children: [
        { tagName: "label", class: "form-label", for: "api-access-token", text: "Zugriffstoken" },
        { tagName: "input", id: "api-access-token", name: "token", type: "password", required: true, autocomplete: "current-password", attrs: { autofocus: true } },
        .../** @type {import("../core/JaDyDoCo.js").JaDyNode[]} */ (error ? [{ tagName: "p", class: "backup-error", role: "alert", text: error }] : []),
        { tagName: "div", class: "startup-error__actions", children: [
          { tagName: "button", type: "submit", class: "button button--primary", text: "Verbinden" },
          { tagName: "button", type: "button", class: "button", text: "Lokal fortfahren", events: { click: useLocal } },
        ] },
      ] },
    ],
  }] };
}
