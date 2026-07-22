# JaDyDoCo Framework v2.0

JaDyDoCo steht für **JavaScript Dynamic DOM Constructor**. Es ist eine kleine,
abhängigkeitsfreie JavaScript-Bibliothek, mit der sich DOM-Strukturen deklarativ
aus JavaScript-Objekten erzeugen lassen.

Anstatt HTML-Elemente einzeln mit `document.createElement()` anzulegen, beschreibt
eine JavaScript-Map den gewünschten Aufbau. JaDyDoCo übersetzt diese Beschreibung
rekursiv in echte DOM-Elemente und fügt sie unmittelbar in das Dokument ein.

> **Versionsstatus:** 2.0.0-alpha  
> **Autor:** Thomas Badrow  
> **Ursprüngliche Entwicklung:** 2016/2017  
> **Modernisierte ES6-Neufassung:** 2026  
> **Lizenz:** MIT

## Inhaltsverzeichnis

- [Ziel und Grundprinzip](#ziel-und-grundprinzip)
- [Eigenschaften](#eigenschaften)
- [Projektstruktur](#projektstruktur)
- [Voraussetzungen und Start](#voraussetzungen-und-start)
- [Schnelleinstieg](#schnelleinstieg)
- [Node-Schema](#node-schema)
- [Attribute](#attribute)
- [Inhalte](#inhalte)
- [Kinder und Listen](#kinder-und-listen)
- [Events](#events)
- [Select-Optionen](#select-optionen)
- [Anwendungsinstanz und öffentliche API](#anwendungsinstanz-und-öffentliche-api)
- [Remote-Daten rendern](#remote-daten-rendern)
- [Vollständige Beispiele](#vollständige-beispiele)
- [Fehlerverhalten](#fehlerverhalten)
- [Sicherheit](#sicherheit)
- [Architektur und Rendering-Verhalten](#architektur-und-rendering-verhalten)
- [Aktuelle Grenzen](#aktuelle-grenzen)
- [Browser-Kompatibilität](#browser-kompatibilität)
- [Weiterentwicklung](#weiterentwicklung)

## Ziel und Grundprinzip

Eine Oberfläche wird als einfaches Objekt beschrieben:

```js
const view = {
  tagName: "section",
  class: "hero",
  children: [
    { tagName: "h1", text: "Hallo JaDyDoCo" },
    { tagName: "p", text: "Deklaratives Rendering ohne Abhängigkeiten." },
  ],
};
```

Der Renderer verarbeitet dieses Objekt in vier Schritten:

1. `tagName` bestimmt das zu erzeugende HTML-Element.
2. Attribute, Klassen, Dataset und Styles werden angewendet.
3. Text, HTML, Events und gegebenenfalls Select-Optionen werden ergänzt.
4. Einträge aus `children` werden rekursiv in das neue Element gerendert.

Das Ergebnis ist kein virtueller DOM, sondern eine unmittelbar erzeugte
Browser-DOM-Struktur:

```html
<section class="hero">
  <h1>Hallo JaDyDoCo</h1>
  <p>Deklaratives Rendering ohne Abhängigkeiten.</p>
</section>
```

## Eigenschaften

- deklarative DOM-Beschreibungen als JavaScript-Objekte
- rekursiv verschachtelte Elemente
- einzelne Nodes oder Arrays von Nodes
- normale und boolesche HTML-Attribute
- Klassen als String oder Array
- `data-*`-Attribute über `dataset`
- Inline-Styles über `style`
- sicherer Text über `textContent`
- direktes HTML über `innerHTML`
- native Browser-Events
- automatische `<option>`-Elemente für `<select>`
- Leeren und Ersetzen bestehender Ansichten
- Abruf von JSON-Daten über `fetch()`
- ES-Module, keine Laufzeitabhängigkeiten
- kein Build-Schritt erforderlich
- kein Virtual DOM

## Projektstruktur

```text
.
├── index.html
├── README.md
├── public/
│   └── img/
└── src/
    ├── main.js
    ├── core/
    │   └── JaDyDoCo.js
    └── styles/
        └── style.css
```

| Pfad | Aufgabe |
| --- | --- |
| `index.html` | HTML-Einstieg und Root-Element der Demo |
| `src/main.js` | Initialisierung und einfache Beispielansicht |
| `src/core/JaDyDoCo.js` | Framework-Kern und öffentliche Exporte |
| `src/styles/style.css` | Stylesheet der Demo; derzeit leer |
| `public/img/` | Vorgesehener Ordner für Bildressourcen |

## Voraussetzungen und Start

JaDyDoCo benötigt einen modernen Browser mit Unterstützung für:

- ES-Module
- Klassen und weitere ES6-Syntax
- DOM-APIs wie `replaceChildren()`
- `fetch()` und `async`/`await` für `renderRemote()`

Das Projekt besitzt aktuell weder Paketabhängigkeiten noch einen Build-Prozess.
Da Browser ES-Module aus Sicherheitsgründen nicht in jeder Konfiguration über
`file://` laden, sollte das Projekt über einen lokalen HTTP-Server geöffnet werden.

Beispielsweise mit Python:

```bash
python -m http.server 8080
```

Danach kann die Demo unter `http://localhost:8080` geöffnet werden.

Alternativ kann jeder andere statische Webserver verwendet werden. Eine
Installation von JaDyDoCo über npm ist in der aktuellen Projektfassung nicht
vorgesehen.

## Schnelleinstieg

### 1. Root-Element bereitstellen

```html
<div id="app"></div>
<script type="module" src="./src/main.js"></script>
```

### 2. Factory importieren und App erzeugen

```js
import { createApp } from "./core/JaDyDoCo.js";

const app = createApp("#app");
```

### 3. Ansicht rendern

```js
app.render({
  tagName: "main",
  class: ["page", "page--home"],
  children: [
    { tagName: "h1", text: "Meine Anwendung" },
    {
      tagName: "button",
      type: "button",
      text: "Klicken",
      events: {
        click: () => console.log("Button wurde geklickt"),
      },
    },
  ],
});
```

Neben `createApp()` kann die Klasse direkt importiert werden:

```js
import { JaDyDoCo } from "./core/JaDyDoCo.js";

const app = new JaDyDoCo(document.querySelector("#app"));
```

## Node-Schema

Ein Node ist ein gewöhnliches JavaScript-Objekt. Die vollständige vorgesehene
Struktur sieht folgendermaßen aus:

```js
{
  tagName: "div",
  attrs: {},
  class: "",
  text: "",
  html: "",
  dataset: {},
  style: {},
  events: {},
  children: [],
  options: []
}
```

### Reservierte Schlüssel

Folgende Eigenschaften werden nicht automatisch als HTML-Attribute behandelt:

| Schlüssel | Bedeutung | Implementierungsstatus |
| --- | --- | --- |
| `tagName` | Name des HTML-Elements | implementiert |
| `children` | untergeordnete Node-Objekte | implementiert |
| `text` | Text über `textContent` | implementiert |
| `html` | HTML über `innerHTML` | implementiert |
| `events` | native Event-Listener | implementiert |
| `attrs` | explizite HTML-Attribute | implementiert |
| `dataset` | `data-*`-Werte | implementiert |
| `style` | Inline-Styles | implementiert |
| `options` | Optionen eines `<select>` | implementiert |
| `pieces` | für eine spätere Erweiterung reserviert | noch nicht verarbeitet |
| `data` | für eine spätere Erweiterung reserviert | noch nicht verarbeitet |
| `template` | für eine spätere Erweiterung reserviert | noch nicht als Node-Feld verarbeitet |

`tagName` ist für jeden zu rendernden Node erforderlich. Ein fehlender oder leerer
Wert löst einen Fehler aus.

## Attribute

### Direkte Attribute

Alle nicht reservierten Eigenschaften eines Nodes werden als HTML-Attribute
gesetzt:

```js
{
  tagName: "input",
  id: "email",
  type: "email",
  name: "email",
  placeholder: "name@example.org",
  required: true
}
```

Ergebnis:

```html
<input
  id="email"
  type="email"
  name="email"
  placeholder="name@example.org"
  required
>
```

### `attrs`

Attribute können alternativ in `attrs` zusammengefasst werden:

```js
{
  tagName: "a",
  text: "Dokumentation",
  attrs: {
    href: "/docs",
    target: "_blank",
    rel: "noopener noreferrer"
  }
}
```

Direkte Attribute und `attrs` können kombiniert werden. Bei identischen Schlüsseln
hat der direkte Wert Vorrang.

### Boolesche und leere Werte

- `true` erzeugt ein vorhandenes, leeres Attribut, beispielsweise `disabled`.
- `false`, `null` und `undefined` werden ignoriert.
- Alle anderen Werte werden mit `String(value)` in Text umgewandelt.

```js
{
  tagName: "button",
  disabled: true,
  title: null,
  text: "Nicht verfügbar"
}
```

### `class`

Eine Klasse kann als String angegeben werden:

```js
{ tagName: "div", class: "card card--highlighted" }
```

Oder als Array. Falsy-Werte im Array werden entfernt:

```js
{
  tagName: "div",
  class: ["card", isActive && "card--active"]
}
```

### `for`

Das Attribut `for` wird auf die DOM-Eigenschaft `htmlFor` abgebildet:

```js
{
  tagName: "label",
  for: "email",
  text: "E-Mail-Adresse"
}
```

### `dataset`

Einträge unter `dataset` werden über die Dataset-API gesetzt:

```js
{
  tagName: "article",
  dataset: {
    id: 42,
    category: "news"
  }
}
```

Ergebnis:

```html
<article data-id="42" data-category="news"></article>
```

`null` und `undefined` werden ignoriert. Andere Werte werden in Strings
umgewandelt. Für zusammengesetzte Dataset-Namen kann die übliche camelCase-Form
verwendet werden, beispielsweise `userId` für `data-user-id`.

### `style`

Inline-Styles werden als DOM-Style-Eigenschaften angegeben. CSS-Namen mit
Bindestrich müssen deshalb in der Regel in camelCase geschrieben werden:

```js
{
  tagName: "div",
  style: {
    color: "white",
    backgroundColor: "#222",
    padding: "1rem"
  }
}
```

Werte mit `null` oder `undefined` werden nicht gesetzt.

## Inhalte

### Text mit `text`

`text` setzt `textContent`. HTML-Zeichen werden dadurch nicht als Markup
interpretiert:

```js
{
  tagName: "p",
  text: "<strong>Das bleibt Text.</strong>"
}
```

Diese Variante sollte für Benutzereingaben und nicht vertrauenswürdige Daten
bevorzugt werden.

### HTML mit `html`

`html` setzt `innerHTML` und interpretiert den String als Markup:

```js
{
  tagName: "p",
  html: "Ein <strong>wichtiger</strong> Hinweis."
}
```

`html` darf nur mit vertrauenswürdigen oder zuvor sicher bereinigten Inhalten
verwendet werden.

### Gleichzeitige Verwendung

Wenn `text` und `html` gemeinsam angegeben werden, setzt die aktuelle
Implementierung zuerst `textContent` und anschließend `innerHTML`. Der `html`-Wert
überschreibt somit den zuvor gesetzten Text. Um eindeutiges Verhalten zu erhalten,
sollte pro Node nur eine der beiden Eigenschaften verwendet werden.

## Kinder und Listen

### Verschachtelte Nodes

`children` nimmt ein Array weiterer Node-Objekte entgegen:

```js
{
  tagName: "ul",
  children: [
    { tagName: "li", text: "Erster Eintrag" },
    { tagName: "li", text: "Zweiter Eintrag" }
  ]
}
```

### Dynamisch erzeugte Listen

Da Nodes normale JavaScript-Objekte sind, können sie mit Standardmethoden wie
`map()` erzeugt werden:

```js
const products = ["Tastatur", "Maus", "Monitor"];

app.render({
  tagName: "ul",
  children: products.map((product) => ({
    tagName: "li",
    text: product,
  })),
});
```

### Array als oberste Ebene

`render()` akzeptiert auch direkt ein Array:

```js
app.render([
  { tagName: "h1", text: "Überschrift" },
  { tagName: "p", text: "Absatz" },
]);
```

Alle Elemente werden nacheinander in denselben Wrapper eingefügt. Der Rückgabewert
ist in diesem Fall ein Array der erzeugten Elemente.

## Events

Native Browser-Events werden unter `events` definiert:

```js
{
  tagName: "button",
  type: "button",
  text: "Zähler erhöhen",
  events: {
    click: (event) => {
      console.log("Auslösendes Element:", event.currentTarget);
    },
    focus: () => {
      console.log("Button fokussiert");
    }
  }
}
```

Jeder Funktionswert wird mit `addEventListener()` registriert. Nicht-funktionale
Werte werden ignoriert. Der Event-Name entspricht dem nativen Namen ohne `on`,
also beispielsweise `click`, `input`, `change` oder `submit`.

Event-Listener-Optionen wie `once`, `capture` oder `passive` können in der aktuellen
Version nicht über das Node-Schema angegeben werden. Falls nötig, lassen sie sich
nach dem Rendern direkt am zurückgegebenen Element registrieren.

## Select-Optionen

Für ein `<select>` kann die Eigenschaft `options` verwendet werden:

```js
{
  tagName: "select",
  name: "language",
  options: [
    { value: "de", text: "Deutsch", selected: true },
    { value: "en", text: "Englisch" },
    { value: "fr", text: "Französisch", disabled: true }
  ]
}
```

Jeder Eintrag erzeugt ein `<option>`-Element. Unterstützt werden:

| Eigenschaft | Bedeutung |
| --- | --- |
| `value` | Wert der Option |
| `text` | sichtbare Beschriftung |
| `selected` | wählt die Option voraus |
| `disabled` | deaktiviert die Option |

Fehlt `value`, wird `text` als Wert verwendet. Fehlt `text`, wird `value` als
Beschriftung verwendet. `options` wird bei Elementen, die kein `<select>` sind,
ignoriert.

`children` können zusätzlich verwendet werden. Automatisch erzeugte Optionen
werden vor den rekursiv gerenderten Kindern eingefügt.

## Anwendungsinstanz und öffentliche API

Das Modul exportiert die Klasse `JaDyDoCo` und die Factory `createApp`.

### `createApp(root)`

Erzeugt eine neue `JaDyDoCo`-Instanz.

```js
const app = createApp("#app");
```

**Parameter**

- `root`: CSS-Selektor, `HTMLElement` oder `null`

**Rückgabewert**

- neue `JaDyDoCo`-Instanz

Ein String wird unmittelbar mit `document.querySelector()` aufgelöst. Wird kein
Element gefunden, bleibt `root` `null`; der Fehler tritt beim Rendern auf.

### `new JaDyDoCo(root = null)`

Direkte Alternative zur Factory:

```js
const app = new JaDyDoCo("#app");
```

### `app.mount(root, node)`

Setzt ein neues Root-Element und rendert einen Node hinein:

```js
app.mount("#sidebar", {
  tagName: "aside",
  text: "Seitenleiste",
});
```

**Parameter**

- `root`: CSS-Selektor oder DOM-Element
- `node`: einzelner Node oder Array von Nodes

**Rückgabewert**

- erzeugtes `HTMLElement` oder Array erzeugter Elemente

`mount()` leert das Zielelement nicht. Bereits vorhandener Inhalt bleibt bestehen.
Soll er ersetzt werden, ist `replace()` zu verwenden.

### `app.render(node, wrapper = app.root)`

Rendert einen Node oder ein Array und hängt das Ergebnis an den Wrapper an:

```js
const element = app.render({
  tagName: "p",
  text: "Neuer Absatz",
});
```

**Parameter**

- `node`: Node-Objekt oder Array
- `wrapper`: optionales DOM-Element; standardmäßig das gespeicherte Root-Element

**Rückgabewert**

- `HTMLElement` bei einem einzelnen Node
- Array bei einem Node-Array
- `null` bei einem falsy Node-Wert

`render()` fügt Inhalte hinzu und ersetzt keine bestehenden Elemente.

### `app.createElement(node)`

Erzeugt ein einzelnes DOM-Element, fügt es aber noch nicht in das Dokument ein:

```js
const badge = app.createElement({
  tagName: "span",
  class: "badge",
  text: "Neu",
});

document.body.appendChild(badge);
```

Direkte `children` werden von `createElement()` nicht rekursiv erzeugt. Diese
Aufgabe übernimmt `render()`.

### `app.clear(wrapper = app.root)`

Entfernt alle Kindknoten des Wrappers über `replaceChildren()`:

```js
app.clear();
app.clear(document.querySelector("#sidebar"));
```

Ist kein Wrapper vorhanden, beendet sich die Methode ohne Fehler. Sie besitzt
keinen Rückgabewert.

### `app.replace(node, wrapper = app.root)`

Leert den Wrapper und rendert anschließend den neuen Node:

```js
app.replace({
  tagName: "p",
  text: "Die bisherige Ansicht wurde ersetzt.",
});
```

**Rückgabewert**

- dasselbe Ergebnis wie `render()`

Das Ersetzen ist vollständig. JaDyDoCo vergleicht die alte und neue Struktur nicht.

### Hilfsmethoden

Die folgenden Methoden sind technisch öffentlich, werden normalerweise aber von
`createElement()` verwendet:

- `collectAttributes(node)`
- `applyAttributes(element, attrs)`
- `applyClasses(element, classValue)`
- `applyDataset(element, dataset)`
- `applyStyles(element, styles)`
- `applyContent(element, node)`
- `applyEvents(element, events)`
- `applyOptions(element, options)`

Sie können für Erweiterungen oder abgeleitete Klassen überschrieben werden. Eine
stabile Plugin-Schnittstelle ist für die Alpha-Version jedoch noch nicht definiert.

## Remote-Daten rendern

`renderRemote()` lädt JSON-Daten und übergibt sie an eine Template-Funktion. Das
zurückgegebene Node-Objekt ersetzt anschließend den Inhalt des Wrappers.

```js
await app.renderRemote({
  url: "/api/projects",
  template: (projects) => ({
    tagName: "section",
    class: "projects",
    children: [
      { tagName: "h2", text: "Projekte" },
      {
        tagName: "ul",
        children: projects.map((project) => ({
          tagName: "li",
          text: project.name,
          dataset: { id: project.id },
        })),
      },
    ],
  }),
});
```

Signatur:

```js
app.renderRemote({ url, template, wrapper, options });
```

| Eigenschaft | Typ | Bedeutung |
| --- | --- | --- |
| `url` | `string` | erforderliche Request-URL |
| `template` | `Function` | wandelt die JSON-Antwort in Node-Strukturen um |
| `wrapper` | `HTMLElement` | optionales Ziel; standardmäßig `app.root` |
| `options` | `object` | optionale Optionen für `fetch()` |

Beispiel mit Request-Optionen:

```js
await app.renderRemote({
  url: "/api/profile",
  options: {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  },
  template: (profile) => ({
    tagName: "h1",
    text: profile.displayName,
  }),
});
```

Die Methode:

1. validiert URL und Template-Funktion,
2. ruft `fetch(url, options)` auf,
3. prüft `response.ok`,
4. liest die Antwort mit `response.json()`,
5. ruft `template(data)` auf,
6. ersetzt den Wrapperinhalt mit dem Template-Ergebnis.

Fehler werden nicht intern abgefangen. Die Anwendung sollte sie behandeln:

```js
try {
  await app.renderRemote({
    url: "/api/items",
    template: renderItems,
  });
} catch (error) {
  app.replace({
    tagName: "p",
    class: "error",
    text: `Daten konnten nicht geladen werden: ${error.message}`,
  });
}
```

## Vollständige Beispiele

### Interaktive Aufgabenliste

```js
import { createApp } from "./core/JaDyDoCo.js";

const app = createApp("#app");
let tasks = [
  { id: 1, title: "Dokumentation lesen", done: true },
  { id: 2, title: "Beispiel erweitern", done: false },
];

function view() {
  return {
    tagName: "main",
    class: "todo-app",
    children: [
      { tagName: "h1", text: "Aufgaben" },
      {
        tagName: "ul",
        children: tasks.map((task) => ({
          tagName: "li",
          class: ["task", task.done && "task--done"],
          dataset: { id: task.id },
          children: [
            {
              tagName: "button",
              type: "button",
              text: task.done ? `✓ ${task.title}` : task.title,
              events: {
                click: () => {
                  task.done = !task.done;
                  update();
                },
              },
            },
          ],
        })),
      },
    ],
  };
}

function update() {
  app.replace(view());
}

update();
```

JaDyDoCo besitzt keine eingebaute Reaktivität. In diesem Beispiel übernimmt die
Anwendung die Zustandsänderung und ruft danach selbst `replace()` auf.

### Formular

```js
app.render({
  tagName: "form",
  class: "contact-form",
  events: {
    submit: (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      console.log(values);
    },
  },
  children: [
    {
      tagName: "label",
      for: "name",
      text: "Name",
    },
    {
      tagName: "input",
      id: "name",
      name: "name",
      type: "text",
      required: true,
    },
    {
      tagName: "button",
      type: "submit",
      text: "Absenden",
    },
  ],
});
```

### Wiederverwendbare View-Funktion

JaDyDoCo definiert noch kein eigenes Komponentenmodell. Wiederverwendbare Ansichten
lassen sich dennoch als gewöhnliche Funktionen schreiben:

```js
function card({ title, description, featured = false }) {
  return {
    tagName: "article",
    class: ["card", featured && "card--featured"],
    children: [
      { tagName: "h2", text: title },
      { tagName: "p", text: description },
    ],
  };
}

app.render(
  card({
    title: "Direktes DOM",
    description: "Ohne Virtual DOM und ohne externe Abhängigkeiten.",
    featured: true,
  }),
);
```

## Fehlerverhalten

JaDyDoCo wirft in folgenden Fällen explizite Fehler:

| Situation | Fehlermeldung |
| --- | --- |
| `mount()` findet das Root-Element nicht | `JaDyDoCo.mount: root element not found.` |
| `render()` besitzt keinen Wrapper | `JaDyDoCo.render: no wrapper/root element provided.` |
| einem Node fehlt `tagName` | `JaDyDoCo.createElement: node needs a tagName.` |
| `renderRemote()` erhält keine URL | `JaDyDoCo.renderRemote: url is required.` |
| `template` ist keine Funktion | `JaDyDoCo.renderRemote: template must be a function.` |
| HTTP-Antwort ist nicht erfolgreich | Statusbezogener Request-Fehler |

Weitere Browserfehler, beispielsweise ein ungültiger CSS-Selektor, ein ungültiger
Elementname, Netzwerkprobleme oder nicht parsebares JSON, werden unverändert an die
aufrufende Anwendung weitergegeben.

Für asynchrone Aufrufe empfiehlt sich daher `try`/`catch`. Bei dynamisch erzeugten
Node-Strukturen sollte die Anwendung außerdem sicherstellen, dass jedes Objekt einen
gültigen `tagName` besitzt.

## Sicherheit

### `text` bevorzugen

`text` verwendet `textContent` und interpretiert Inhalte nicht als HTML. Es ist die
richtige Wahl für API-Daten, Benutzereingaben und andere externe Werte.

### Vorsicht bei `html`

`html` verwendet `innerHTML`. Ungeprüfte Inhalte können dadurch Cross-Site-Scripting
(XSS) ermöglichen. Werte aus Benutzereingaben oder externen APIs dürfen nicht direkt
als `html` gerendert werden. Sie müssen vorher mit einer geeigneten, gepflegten
Sanitizing-Lösung bereinigt werden.

### Attribute und URLs

JaDyDoCo validiert weder URLs noch die semantische Sicherheit von Attributen.
Anwendungen sind selbst dafür verantwortlich, Werte für `href`, `src`, `style` und
ähnliche Attribute aus nicht vertrauenswürdigen Quellen zu prüfen.

### Remote-Daten

`renderRemote()` übernimmt die üblichen Sicherheitsregeln von `fetch()`, darunter
Same-Origin- und CORS-Beschränkungen. Authentifizierungsdaten und sensible Header
sollten nur an vertrauenswürdige Endpunkte gesendet werden.

## Architektur und Rendering-Verhalten

### Direkter DOM-Zugriff

JaDyDoCo erstellt Elemente mit `document.createElement()` und fügt sie mit
`appendChild()` direkt ein. Es gibt keine Zwischenrepräsentation und keinen
Diff-Algorithmus.

Das hält den Kern klein und nachvollziehbar. Bei häufigen Aktualisierungen großer
Ansichten kann das vollständige Ersetzen jedoch aufwendiger sein als eine gezielte
DOM-Aktualisierung.

### Hinzufügen und Ersetzen

- `render()` hängt neue Inhalte an.
- `mount()` setzt das Root-Element und hängt neue Inhalte an.
- `clear()` entfernt alle Inhalte.
- `replace()` kombiniert `clear()` und `render()`.
- `renderRemote()` lädt Daten und verwendet anschließend `replace()`.

### Reihenfolge bei der Elementerzeugung

Für einen Node führt `createElement()` die Verarbeitung in dieser Reihenfolge aus:

1. Element erzeugen
2. Attribute sammeln und anwenden
3. Dataset anwenden
4. Inline-Styles anwenden
5. Text oder HTML anwenden
6. Events registrieren
7. Select-Optionen erzeugen

Danach hängt `render()` das Element in den Wrapper und verarbeitet `children`.

### Rückgabewerte

Die erzeugten DOM-Elemente werden zurückgegeben und können deshalb direkt weiter
verwendet werden:

```js
const button = app.render({
  tagName: "button",
  text: "Fokus setzen",
});

button.focus();
```

## Aktuelle Grenzen

Version 2.0.0-alpha ist ein kompakter Framework-Kern und noch kein vollständiges
Anwendungsframework. Derzeit nicht enthalten sind:

- Komponenten- oder Lifecycle-API
- automatische Reaktivität und Zustandsverwaltung
- Virtual DOM oder differenzielle Updates
- Routing
- serverseitiges Rendering
- Hydration
- Event-Delegation
- Event-Listener-Optionen im Node-Schema
- Namespaces für SVG oder MathML
- eingebaute HTML-Bereinigung
- Abbruch-, Lade- oder Retry-Logik für Remote-Requests
- TypeScript-Typdefinitionen
- Paketveröffentlichung und Build-Konfiguration
- automatisierte Tests

Zusätzlich sind `pieces`, `data` und `template` als reservierte Node-Schlüssel
definiert, besitzen derzeit aber noch keine eigene Rendering-Logik.

## Browser-Kompatibilität

Die Bibliothek richtet sich an aktuelle Browser. Besonders `replaceChildren()`,
ES-Module und `fetch()` schließen ältere Browser ohne Polyfills aus.

Für die Kernfunktionen werden mindestens folgende Plattformfähigkeiten benötigt:

```text
document.querySelector
document.createElement
Element.appendChild
Element.classList
HTMLElement.dataset
EventTarget.addEventListener
Element.replaceChildren
JavaScript ES Modules
```

Für `renderRemote()` kommen hinzu:

```text
fetch
Promise
async / await
Response.json
```

Eine verbindliche Browser-Matrix ist in der Alpha-Version noch nicht definiert.

## Weiterentwicklung

Sinnvolle nächste Schritte für eine stabilere Version sind:

1. automatisierte Unit- und Browser-Tests für alle Rendering-Funktionen,
2. Validierung und klarere Typdefinition des Node-Schemas,
3. JSDoc- oder TypeScript-Typen für bessere Editor-Unterstützung,
4. Ausbau der Demo zu einem interaktiven Funktionskatalog,
5. Festlegung, Implementierung oder Entfernung der reservierten Felder
   `pieces`, `data` und `template`,
6. Dokumentation einer stabilen Erweiterungs-API,
7. Paket- und Versionsstrategie für eine spätere Veröffentlichung,
8. optionale Unterstützung für Fragmente, SVG und Event-Optionen.

---

JaDyDoCo verfolgt bewusst einen einfachen Ansatz: JavaScript-Objekte hinein, echte
DOM-Elemente heraus. Dadurch eignet sich der aktuelle Kern besonders für kleine
Weboberflächen, Lernprojekte, Prototypen und Anwendungen, die direkte Kontrolle über
den Browser-DOM ohne umfangreiche Framework-Abstraktionen benötigen.
