/**
 * @param {{ count: number, onIncrement: EventListener, onReset: EventListener, onSubmit: EventListener }} config
 * @returns {import("../core/JaDyDoCo.js").JaDyNode}
 */
export function createTestPage({ count, onIncrement, onReset, onSubmit }) {
  return {
    tagName: "main",
    class: "test-page",
    children: [
      {
        tagName: "header",
        class: "hero",
        children: [
          { tagName: "span", class: "eyebrow", text: "JaDyDoCo · Testseite" },
          { tagName: "h1", text: "JavaScript-Maps werden zu echtem DOM." },
          {
            tagName: "p",
            class: "hero__intro",
            text: "Diese Seite testet zentrale Funktionen des Frameworks ohne HTML-Templates oder Build-Schritt.",
          },
          { tagName: "a", class: "text-link", href: "#features", text: "Funktionen ansehen ↓" },
        ],
      },
      {
        tagName: "section",
        id: "features",
        class: "section",
        children: [
          {
            tagName: "div",
            class: "section-heading",
            children: [
              { tagName: "span", class: "eyebrow", text: "Rendering" },
              { tagName: "h2", text: "Eine Map, mehrere Fähigkeiten" },
            ],
          },
          {
            tagName: "div",
            class: "feature-grid",
            children: [
              featureCard("01", "Attribute & Daten", "Klassen, IDs, data-Attribute und Styles werden deklarativ gesetzt.", "attributes"),
              featureCard("02", "Rekursive Kinder", "Verschachtelte Node-Maps erzeugen eine vollständige DOM-Struktur.", "children"),
              featureCard("03", "Native Events", "Event-Handler bleiben normale JavaScript-Funktionen.", "events"),
            ],
          },
        ],
      },
      {
        tagName: "section",
        class: "section playground",
        children: [
          {
            tagName: "div",
            class: "panel",
            children: [
              { tagName: "span", class: "eyebrow", text: "Interaktion" },
              { tagName: "h2", text: "Event- und Replace-Test" },
              { tagName: "p", text: "Jeder Klick verändert den Zustand und rendert die Map erneut." },
              {
                tagName: "span",
                class: "counter-value",
                text: count,
                dataset: { testId: "counter-value" },
                style: { color: count >= 5 ? "#ffcf70" : "#f7f7f2" },
              },
              {
                tagName: "div",
                class: "button-row",
                children: [
                  { tagName: "button", type: "button", class: "button button--primary", text: "Zähler erhöhen", events: { click: onIncrement } },
                  { tagName: "button", type: "button", class: "button button--quiet", text: "Zurücksetzen", disabled: count === 0, events: { click: onReset } },
                ],
              },
            ],
          },
          {
            tagName: "form",
            class: "panel",
            events: { submit: onSubmit },
            children: [
              { tagName: "span", class: "eyebrow", text: "Formular" },
              { tagName: "h2", text: "DOM-Werte testen" },
              { tagName: "label", class: "field-label", for: "test-name", text: "Dein Name" },
              { tagName: "input", id: "test-name", type: "text", name: "name", placeholder: "Vorname eingeben", autocomplete: "name", required: true },
              { tagName: "label", class: "field-label", for: "test-topic", text: "Testbereich" },
              {
                tagName: "select",
                id: "test-topic",
                name: "topic",
                options: [
                  { value: "rendering", text: "Rendering" },
                  { value: "events", text: "Events" },
                  { value: "types", text: "Typen" },
                ],
              },
              { tagName: "button", type: "submit", class: "button button--primary button--full", text: "Formular prüfen" },
              { tagName: "p", class: "form-result", dataset: { testId: "form-result" }, text: "Noch nicht abgesendet." },
            ],
          },
        ],
      },
      {
        tagName: "footer",
        class: "footer",
        children: [
          { tagName: "strong", text: "JaDyDoCo 2.0" },
          { tagName: "span", text: "Direktes DOM. Klare Maps. Keine Magie." },
        ],
      },
    ],
  };
}

/**
 * @param {string} number
 * @param {string} title
 * @param {string} text
 * @param {string} feature
 * @returns {import("../core/JaDyDoCo.js").JaDyNode}
 */
function featureCard(number, title, text, feature) {
  return {
    tagName: "article",
    class: "card",
    dataset: { feature },
    children: [
      { tagName: "span", class: "card__number", text: number },
      { tagName: "h3", text: title },
      { tagName: "p", text },
    ],
  };
}
