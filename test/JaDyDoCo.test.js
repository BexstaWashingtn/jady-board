import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import { JSDOM } from "jsdom";

import { JaDyDoCo, createApp } from "../src/core/JaDyDoCo.js";

let dom;

beforeEach(() => {
  dom = new JSDOM("<!doctype html><div id=\"root\"></div><div id=\"other\"></div>");
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Event = dom.window.Event;
});

afterEach(() => {
  mock.restoreAll();
  delete globalThis.fetch;
  delete globalThis.Event;
  delete globalThis.HTMLElement;
  delete globalThis.document;
  dom.window.close();
});

describe("constructor und createApp", () => {
  test("constructor löst einen Selektor als Root auf", () => {
    const app = new JaDyDoCo("#root");
    assert.equal(app.root, document.querySelector("#root"));
  });

  test("constructor übernimmt ein Element und erlaubt null", () => {
    const root = document.querySelector("#root");
    assert.equal(new JaDyDoCo(root).root, root);
    assert.equal(new JaDyDoCo().root, null);
  });

  test("createApp erzeugt eine JaDyDoCo-Instanz", () => {
    const app = createApp("#root");
    assert.ok(app instanceof JaDyDoCo);
    assert.equal(app.root.id, "root");
  });
});

describe("mount", () => {
  test("setzt das Root und rendert in Selektor oder Element", () => {
    const app = new JaDyDoCo();
    const element = app.mount("#other", { tagName: "p", text: "Montiert" });
    assert.equal(app.root.id, "other");
    assert.equal(element.parentElement, app.root);
    assert.equal(app.root.textContent, "Montiert");

    const root = document.querySelector("#root");
    app.mount(root, { tagName: "span", text: "Element" });
    assert.equal(app.root, root);
  });

  test("wirft bei einem nicht gefundenen Root", () => {
    const app = new JaDyDoCo();
    assert.throws(
      () => app.mount("#missing", { tagName: "p" }),
      /root element not found/,
    );
  });
});

describe("render", () => {
  test("rendert einen Node rekursiv", () => {
    const app = createApp("#root");
    const result = app.render({
      tagName: "section",
      children: [{ tagName: "h1", text: "Titel" }],
    });
    assert.equal(result.tagName, "SECTION");
    assert.equal(result.firstElementChild.tagName, "H1");
    assert.equal(result.textContent, "Titel");
  });

  test("rendert Arrays in Reihenfolge und gibt die Elemente zurück", () => {
    const app = createApp("#root");
    const result = app.render([
      { tagName: "span", text: "A" },
      { tagName: "span", text: "B" },
    ]);
    assert.equal(result.length, 2);
    assert.equal(app.root.innerHTML, "<span>A</span><span>B</span>");
  });

  test("fügt Arrays gebündelt über ein DocumentFragment ein", () => {
    const app = createApp("#root");
    const appendChild = mock.method(app.root, "appendChild");

    app.render([
      { tagName: "span", text: "A" },
      { tagName: "span", text: "B" },
      { tagName: "span", text: "C" },
    ]);

    assert.equal(appendChild.mock.callCount(), 1);
    assert.equal(
      appendChild.mock.calls[0].arguments[0].nodeType,
      document.DOCUMENT_FRAGMENT_NODE,
    );
  });

  test("verändert den Wrapper nicht, wenn ein Kind nicht erzeugt werden kann", () => {
    const app = createApp("#root");
    app.root.innerHTML = "<p>Bestehend</p>";

    assert.throws(
      () =>
        app.render({
          tagName: "section",
          children: [{ tagName: "span", text: "Gültig" }, {}],
        }),
      /needs a tagName/,
    );
    assert.equal(app.root.innerHTML, "<p>Bestehend</p>");
  });

  test("gibt für einen falsy Node null zurück", () => {
    assert.equal(createApp("#root").render(null), null);
  });

  test("wirft ohne Wrapper oder Root", () => {
    assert.throws(
      () => new JaDyDoCo().render({ tagName: "p" }),
      /no wrapper\/root element provided/,
    );
  });
});

describe("createTree", () => {
  test("baut einen vollständigen, noch nicht verbundenen Teilbaum", () => {
    const app = createApp("#root");
    const tree = app.createTree({
      tagName: "article",
      children: [
        { tagName: "h2", text: "Titel" },
        { tagName: "p", text: "Text" },
      ],
    });

    assert.equal(tree.isConnected, false);
    assert.equal(tree.innerHTML, "<h2>Titel</h2><p>Text</p>");
    assert.equal(app.root.childNodes.length, 0);
  });

  test("bündelt auch verschachtelte Kinder-Arrays in einem Fragment", () => {
    const tree = createApp("#root").createTree({
      tagName: "div",
      children: [
        [
          { tagName: "span", text: "A" },
          { tagName: "span", text: "B" },
        ],
        { tagName: "span", text: "C" },
      ],
    });
    assert.equal(tree.innerHTML, "<span>A</span><span>B</span><span>C</span>");
  });
});

describe("createElement und collectAttributes", () => {
  test("createElement erzeugt ein vollständig konfiguriertes Element", () => {
    const app = new JaDyDoCo();
    const click = mock.fn();
    const element = app.createElement({
      tagName: "button",
      id: "save",
      class: ["button", "active"],
      dataset: { itemId: 12 },
      style: { color: "red" },
      text: "Speichern",
      events: { click },
    });
    element.dispatchEvent(new Event("click"));
    assert.equal(element.outerHTML, '<button id="save" class="button active" data-item-id="12" style="color: red;">Speichern</button>');
    assert.equal(click.mock.callCount(), 1);
  });

  test("createElement verlangt tagName", () => {
    assert.throws(() => new JaDyDoCo().createElement({}), /needs a tagName/);
    assert.throws(() => new JaDyDoCo().createElement(null), /needs a tagName/);
  });

  test("collectAttributes kombiniert attrs und direkte Werte mit Vorrang", () => {
    const attrs = new JaDyDoCo().collectAttributes({
      tagName: "input",
      attrs: { id: "aus-attrs", title: "Hinweis" },
      id: "direkt",
      text: "reserviert",
      children: [],
    });
    assert.deepEqual(attrs, { id: "direkt", title: "Hinweis" });
  });
});

describe("Attribut-, Klassen-, Dataset- und Style-Methoden", () => {
  test("applyAttributes behandelt Standard-, boolesche und leere Attribute", () => {
    const app = new JaDyDoCo();
    const input = document.createElement("input");
    app.applyAttributes(input, {
      id: 42,
      disabled: true,
      hidden: false,
      title: null,
      placeholder: undefined,
    });
    assert.equal(input.getAttribute("id"), "42");
    assert.equal(input.getAttribute("disabled"), "");
    assert.equal(input.hasAttribute("hidden"), false);
    assert.equal(input.hasAttribute("title"), false);
  });

  test("applyAttributes delegiert class und bildet for auf htmlFor ab", () => {
    const label = document.createElement("label");
    new JaDyDoCo().applyAttributes(label, { class: "field-label", for: "email" });
    assert.equal(label.className, "field-label");
    assert.equal(label.htmlFor, "email");
  });

  test("applyClasses unterstützt String, Array und falsy Werte", () => {
    const app = new JaDyDoCo();
    const element = document.createElement("div");
    app.applyClasses(element, ["card", false, null, "active"]);
    assert.equal(element.className, "card active");
    app.applyClasses(element, "replacement");
    assert.equal(element.className, "replacement");
    app.applyClasses(element, "");
    assert.equal(element.className, "replacement");
  });

  test("applyDataset stringifiziert Werte und ignoriert nullish Werte", () => {
    const element = document.createElement("div");
    new JaDyDoCo().applyDataset(element, {
      id: 7,
      active: false,
      empty: null,
      absent: undefined,
    });
    assert.deepEqual({ ...element.dataset }, { id: "7", active: "false" });
  });

  test("applyStyles setzt Werte und ignoriert nullish Werte", () => {
    const element = document.createElement("div");
    new JaDyDoCo().applyStyles(element, {
      color: "red",
      opacity: 0,
      width: null,
      height: undefined,
    });
    assert.equal(element.style.color, "red");
    assert.equal(element.style.opacity, "0");
    assert.equal(element.style.width, "");
  });
});

describe("Inhalt, Events und Select-Optionen", () => {
  test("applyContent setzt Text einschließlich falsy Werten", () => {
    const app = new JaDyDoCo();
    const element = document.createElement("p");
    app.applyContent(element, { text: 0 });
    assert.equal(element.textContent, "0");
    app.applyContent(element, { text: false });
    assert.equal(element.textContent, "false");
  });

  test("applyContent interpretiert html und html überschreibt text", () => {
    const element = document.createElement("div");
    new JaDyDoCo().applyContent(element, {
      text: "Text",
      html: "<strong>HTML</strong>",
    });
    assert.equal(element.innerHTML, "<strong>HTML</strong>");
  });

  test("applyEvents registriert nur Funktionen", () => {
    const element = document.createElement("button");
    const click = mock.fn();
    new JaDyDoCo().applyEvents(element, { click, focus: "invalid" });
    element.dispatchEvent(new Event("click"));
    element.dispatchEvent(new Event("focus"));
    assert.equal(click.mock.callCount(), 1);
  });

  test("applyOptions erzeugt Select-Optionen mit Fallbacks", () => {
    const select = document.createElement("select");
    new JaDyDoCo().applyOptions(select, [
      { value: "de", text: "Deutsch", selected: true },
      { text: "Englisch", disabled: true },
      { value: "fr" },
      {},
    ]);
    assert.equal(select.options.length, 4);
    assert.deepEqual(
      [...select.options].map(({ value, textContent, selected, disabled }) => ({
        value,
        text: textContent,
        selected,
        disabled,
      })),
      [
        { value: "de", text: "Deutsch", selected: true, disabled: false },
        { value: "Englisch", text: "Englisch", selected: false, disabled: true },
        { value: "fr", text: "fr", selected: false, disabled: false },
        { value: "", text: "", selected: false, disabled: false },
      ],
    );
  });

  test("applyOptions ignoriert Nicht-Selects und Nicht-Arrays", () => {
    const div = document.createElement("div");
    const select = document.createElement("select");
    const app = new JaDyDoCo();
    app.applyOptions(div, [{ value: "x" }]);
    app.applyOptions(select, null);
    assert.equal(div.children.length, 0);
    assert.equal(select.options.length, 0);
  });
});

describe("clear und replace", () => {
  test("clear leert Root oder angegebenen Wrapper und toleriert fehlenden Root", () => {
    const app = createApp("#root");
    app.root.innerHTML = "<p>Alt</p>";
    app.clear();
    assert.equal(app.root.childNodes.length, 0);

    const other = document.querySelector("#other");
    other.innerHTML = "<span>Alt</span>";
    app.clear(other);
    assert.equal(other.childNodes.length, 0);
    assert.doesNotThrow(() => new JaDyDoCo().clear());
  });

  test("replace ersetzt vorhandenen Inhalt und gibt das Ergebnis zurück", () => {
    const app = createApp("#root");
    app.root.innerHTML = "<p>Alt</p>";
    const result = app.replace({ tagName: "h1", text: "Neu" });
    assert.equal(result, app.root.firstElementChild);
    assert.equal(app.root.innerHTML, "<h1>Neu</h1>");
  });

  test("replace erhält vorhandenen Inhalt bei einem Build-Fehler", () => {
    const app = createApp("#root");
    app.root.innerHTML = "<p>Bestehend</p>";

    assert.throws(
      () =>
        app.replace({
          tagName: "main",
          children: [{ tagName: "p", text: "Neu" }, {}],
        }),
      /needs a tagName/,
    );
    assert.equal(app.root.innerHTML, "<p>Bestehend</p>");
  });

  test("replace verarbeitet Arrays atomisch und null leert den Wrapper", () => {
    const app = createApp("#root");
    const result = app.replace([
      { tagName: "span", text: "A" },
      { tagName: "span", text: "B" },
    ]);
    assert.equal(result.length, 2);
    assert.equal(app.root.innerHTML, "<span>A</span><span>B</span>");

    assert.equal(app.replace(null), null);
    assert.equal(app.root.childNodes.length, 0);
  });

  test("replace wirft ohne Wrapper oder Root", () => {
    assert.throws(
      () => new JaDyDoCo().replace({ tagName: "p" }),
      /no wrapper\/root element provided/,
    );
  });
});

describe("renderRemote", () => {
  test("lädt JSON, ruft das Template auf und ersetzt den Wrapper", async () => {
    const app = createApp("#root");
    app.root.innerHTML = "<p>Alt</p>";
    const json = mock.fn(async () => ({ title: "Remote" }));
    const fetchMock = mock.fn(async () => ({ ok: true, json }));
    globalThis.fetch = fetchMock;
    const template = mock.fn((data) => ({ tagName: "h1", text: data.title }));
    const options = { headers: { Accept: "application/json" } };

    const result = await app.renderRemote({ url: "/api", template, options });

    assert.equal(fetchMock.mock.callCount(), 1);
    assert.deepEqual(fetchMock.mock.calls[0].arguments, ["/api", options]);
    assert.equal(json.mock.callCount(), 1);
    assert.deepEqual(template.mock.calls[0].arguments, [{ title: "Remote" }]);
    assert.equal(result.outerHTML, "<h1>Remote</h1>");
    assert.equal(app.root.innerHTML, "<h1>Remote</h1>");
  });

  test("verwendet einen expliziten Wrapper", async () => {
    const app = createApp("#root");
    globalThis.fetch = mock.fn(async () => ({
      ok: true,
      json: async () => ["A", "B"],
    }));
    const other = document.querySelector("#other");
    await app.renderRemote({
      url: "/items",
      wrapper: other,
      template: (items) => items.map((text) => ({ tagName: "span", text })),
    });
    assert.equal(other.innerHTML, "<span>A</span><span>B</span>");
    assert.equal(app.root.innerHTML, "");
  });

  test("validiert URL und Template vor dem Request", async () => {
    const app = createApp("#root");
    globalThis.fetch = mock.fn();
    await assert.rejects(
      app.renderRemote({ url: "", template: () => ({ tagName: "p" }) }),
      /url is required/,
    );
    await assert.rejects(
      app.renderRemote({ url: "/api", template: null }),
      /template must be a function/,
    );
    assert.equal(globalThis.fetch.mock.callCount(), 0);
  });

  test("wirft bei einer nicht erfolgreichen HTTP-Antwort", async () => {
    const app = createApp("#root");
    globalThis.fetch = mock.fn(async () => ({ ok: false, status: 503 }));
    await assert.rejects(
      app.renderRemote({ url: "/api", template: () => ({ tagName: "p" }) }),
      /request failed with 503/,
    );
  });
});
