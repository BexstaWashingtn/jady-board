# JaDy Board — Onboarding-Leitfaden für KI-Agenten (`agents.md`)

Willkommen! Diese Datei dient als kompakter, hochgradig informativer Einstiegspunkt für KI-Agenten, um die Architektur, Konventionen und den Stack von **JaDy Board** sofort zu verstehen.

---

## 🚀 1. Projektübersicht & Tech-Stack

**JaDy Board** (jady-board v0.9.0) ist eine hochgradig interaktive Kanban-Anwendung, die auf dem maßgeschneiderten, deklarativen UI-Framework **JaDyDoCo** basiert. Es kommt im Frontend **ohne** externe Frameworks (React, Vue, Angular etc.) oder Build-Schritte aus.

### Tech-Stack
- **Frontend:** HTML5, CSS3, JavaScript mit nativen **ES-Modulen** (ESM).
- **UI-Framework:** `src/core/JaDyDoCo.js` (JavaScript Dynamic DOM Constructor).
- **Backend:** Node.js (v22+), Express-ähnliche Struktur, PostgreSQL (`pg` v8.22.0) für relationale Speicherung.
- **Datenhaltung Client:** `localStorage` unter dem Schlüssel `jadydoco.board` mit robustem Migrations- und Reparatur-System (Schema-Version 5).
- **Qualitätssicherung:**
  - Nativer Node.js Test Runner (`node --test`).
  - Playwright für E2E-Tests (`playwright test`).
  - Statische Typprüfung via TypeScript (`tsc`) über **JSDoc**-Typdefinitionen (`"checkJs": true`).

---

## 📁 2. Verzeichnisstruktur & Architektur

```text
F:\Screen\Websites\JaDyDoCo\ES6\v2.0.0 - Agent\
├── .github/workflows/quality.yml   # CI/CD-Pipelines
├── server/                         # Backend (Node.js + Postgres)
│   ├── migrations/                 # SQL-Datenbank-Migrationen
│   └── src/
│       ├── config.js               # Server-Konfiguration
│       ├── server.js               # Express-ähnlicher Einstiegspunkt
│       ├── db/                     # DB-Verbindung & Migrationstrigger
│       └── http/                   # HTTP App & Routing
├── src/                            # Frontend (Client)
│   ├── main.js                     # Haupteinstiegspunkt Client
│   ├── core/
│   │   ├── JaDyDoCo.js             # Modernisiertes, deklaratives UI-Framework
│   │   └── JaDyDoCo_legacy.js      # Ältere Kernversion (für Abwärtskompatibilität)
│   ├── board/                      # Kanban-Board Logik & Orchestrierung
│   │   ├── board.controller.js     # Orchestrierer (State, View-State, Render-Trigger)
│   │   ├── board.state.js          # Reiner Domain-State & Geschäftsregeln
│   │   ├── board.view-state.js     # Flüchtiger Oberflächen-Zustand (z.B. aktiver Filter)
│   │   ├── board.persistence.js    # LocalStorage Lade-, Migrations- & Reparatursystem
│   │   ├── board.permissions.js    # Berechtigungsprüfung (Owner vs Mitglied vs Bearbeiter)
│   │   ├── board.dialog-manager.js # Fokusfalle, Escape-Handling in Modals
│   │   ├── board.dom.js            # Gezielte, performante DOM-Manipulationen
│   │   └── actions/                # Gekapselte Benutzer- und Board-Aktionen
│   ├── templates/                  # JaDyDoCo UI-Templates
│   │   ├── board.map.js            # Öffentliche Template-Schnittstelle
│   │   └── board/                  # Detail-Deklarationen (Modals, Kanban, List)
│   ├── features/                   # Filter, Feedback & Einstellungen
│   └── styles/                     # CSS-Strukturen (Design-Tokens, responsive)
├── test/                           # Unit & Integrationstests (node:test)
├── e2e/                            # End-to-End-Tests (Playwright)
└── test-d/                         # Typprüfungstests für JSDoc-Deklarationen
```

---

## 🧩 3. Das JaDyDoCo-Framework

JaDyDoCo generiert DOM-Strukturen rekursiv direkt aus JavaScript-Objekten (UI-Maps) ohne Virtual DOM.

### Struktur eines Deklarativen Knotens (JaDyNode)
```javascript
{
  tagName: "div",        // HTML-Tag (div, span, section, etc.)
  class: "btn btn-primary", // CSS-Klassen (String oder Array, falsche Einträge ignoriert)
  id: "submit-btn",      // Eindeutige ID
  text: "Speichern",     // Sicherer Text (wird über textContent gerendert)
  attrs: {               // Zusätzliche HTML-Attribute
    type: "submit",
    disabled: false
  },
  dataset: {             // data-* Attribute
    taskId: "task-123"
  },
  style: {               // Inline-CSS-Styles (DOM-kompatibel)
    backgroundColor: "red"
  },
  events: {              // Native Event-Listener
    click: (event) => handleSave()
  },
  children: [            // Verschachtelte Kinder-Elemente
    { tagName: "span", text: "💾" }
  ]
}
```

### Verwendung im Controller:
```javascript
import { createApp } from "../core/JaDyDoCo.js";
import { createBoardPage } from "../templates/board/board-page.map.js";

const app = createApp(document.getElementById("app"));
const uiMap = createBoardPage(state, viewState, actions);
app.render(uiMap); // Rendert die UI atomar und sicher neu
```

---

## 💾 4. State-Management & Persistenz

- **Domain-State (`board.state.js`):**
  - Enthält alle Aufgaben, Stages, Board-Konfigurationen und Benutzer.
  - Updates erfolgen funktional/immutable.
  - Beinhaltet eine Undo-Historie für kritische Aktionen (z.B. Aufgaben verschieben oder löschen).
  - Ist vollkommen frei von UI-Abhängigkeiten und hervorragend unit-testbar.
- **View-State (`board.view-state.js`):**
  - Speichert flüchtige Werte wie offene Dialoge, aktiven Workspace, Suchbegriffe und Filterzustände.
- **Persistenz (`board.persistence.js`):**
  - Speichert den gesamten Workspace serialisiert unter dem LocalStorage-Schlüssel `jadydoco.board`.
  - Besitzt ein Migrations-System für Schema-Upgrades (aktuell v5).
  - Beinhaltet Selbstheilungsmechanismen bei inkonsistenten Daten (z.B. verwaisten Task-Referenzen).
  - Vor Upgrades/Reparaturen wird ein automatisches Backup unter `jadydoco.board.backup` abgelegt.

---

## 🔒 5. Berechtigungskonzept (`board.permissions.js`)

Das Rollenkonzept im JaDy Board unterscheidet drei Rollen:
1. **Board-Owner:** Volle Rechte. Erstellt/löscht Boards, konfiguriert Stages, WIP-Limits, Übergänge und weist Aufgaben zu.
2. **Bearbeiter:** Pflegt Todos, verschiebt die Aufgabe und kann die Bearbeitung abgeben.
3. **Mitglied:** Kann Aufgaben ansehen, neue erstellen und freie Aufgaben an sich selbst zuweisen.

Sämtliche Aktionen im Controller/State werden über `board.permissions.js` abgesichert, bevor sie ausgeführt werden.

---

## 🛠️ 6. Entwicklungsbefehle & QS-Workflows

Agenten **MÜSSEN** vor dem Einreichen von Änderungen sicherstellen, dass alle Tests und Typprüfungen fehlerfrei durchlaufen.

### Tests ausführen
```powershell
# Führt alle Unit- & Integrationstests über den nativen Node Test Runner aus
npm test

# Führt alle Tests mit Code-Coverage-Bericht aus
npm run test:coverage

# Prüft die Einhaltung der Coverage-Schwellenwerte (85% Lines, 80% Branches/Functions)
npm run test:coverage:check
```

### Statische Typprüfung
```powershell
# Führt tsc aus, um JSDoc-Typen in JavaScript-Dateien zu prüfen (checkJs)
npm run typecheck
```

### End-to-End-Tests (Playwright)
```powershell
# Installiert die benötigten Browser-Treiber für Playwright (falls nötig)
npx playwright install

# Führt die Playwright E2E-Tests aus
npm run test:e2e

# Führt die Playwright E2E-Tests sichtbar (headed) aus
npm run test:e2e:headed
```

---

## 📝 7. Verhaltensregeln für KI-Agenten

Wenn du Änderungen an diesem Projekt vornimmst, beachte strikt folgende Regeln:

1. **Keine externen Frontend-Frameworks:** Installiere niemals React, Vue oder Svelte. Die Benutzeroberfläche muss vollständig über die `JaDyDoCo`-Objektmaps realisiert werden.
2. **ESM & Konventionen einhalten:** Nutze ausschließlich native ES-Module (`import`/`export`). Verwende keine CommonJS (`require`).
3. **Typisierung via JSDoc:** Da das Projekt reines JS mit statischer Typprüfung verwendet, musst du neue Funktionen, Parameter und Rückgabewerte konsequent mit präzisen JSDoc-Annotationen versehen. Prüfe deine Typen stets mit `npm run typecheck`.
4. **Keine Warnungen unterdrücken:** Verwende keine Ignorier-Flags (z.B. `@ts-ignore` oder ESLint-Bypasses), außer es ist absolut unvermeidbar und gut begründet. Löse stattdessen das zugrunde liegende Typproblem.
5. **Funktionale State-Updates:** Verändere den State in `board.state.js` nur über pure, funktionale Updates. Vermeide direkte Seiteneffekte im Domain-State.
6. **Umfassende Tests schreiben:** Jedes neue Feature und jeder Bugfix muss durch entsprechende Unittests in `test/` (unter Verwendung von `node:test`) abgedeckt werden.
7. **Keine unaufgeforderten Commits:** Stage oder committe deine Änderungen nur, wenn dich der Benutzer explizit dazu auffordert. Proponiere stets eine prägnante, aussagekräftige Commit-Nachricht.

---
