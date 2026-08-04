/**
 * @param {{apiSource: string, error: string|null, useLocal: () => void}} options
 * @returns {import("../core/JaDyDoCo.js").JaDyNode}
 */
export function createClerkLoginPage({ apiSource, error, useLocal }) {
  return { tagName: "main", class: "startup-error", children: [{
    tagName: "section", class: "startup-error__card startup-error__card--clerk", attrs: { "aria-labelledby": "clerk-login-title" }, children: [
      { tagName: "p", class: "startup-error__eyebrow", text: "JaDy Board · Clerk" },
      { tagName: "h1", id: "clerk-login-title", text: "Anmelden" },
      { tagName: "p", text: `Melde dich über Clerk an, um auf den JaDy-Board-Server ${apiSource} zuzugreifen.` },
      .../** @type {import("../core/JaDyDoCo.js").JaDyNode[]} */ (error ? [{ tagName: "p", class: "backup-error", role: "alert", text: error }] : []),
      { tagName: "div", id: "clerk-sign-in", class: "clerk-sign-in-host" },
      { tagName: "button", type: "button", class: "button", text: "Stattdessen lokal fortfahren", events: { click: useLocal } },
    ],
  }] };
}
