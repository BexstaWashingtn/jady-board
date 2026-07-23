# JaDy Board

JaDy Board ist eine browserbasierte Kanban-Anwendung zur Organisation von Aufgaben, Arbeitsabläufen und kleinen Teams. Die Oberfläche wurde vollständig mit dem eigenen **JaDyDoCo-Framework** (JavaScript Dynamic DOM Constructor) umgesetzt und kommt ohne Frontend-Framework und ohne produktive Laufzeitabhängigkeiten aus.

Das Projekt läuft vollständig im Browser. Boards, Aufgaben, Benutzerprofile und Einstellungen werden lokal im `localStorage` gespeichert.

## Funktionsumfang

### Boards und Aufgaben

- Mehrere Boards anlegen, wechseln, bearbeiten und löschen
- Neue Boards mit auswählbaren Standard-Stages und eigenen Stages erstellen
- Aufgaben erstellen, bearbeiten, verschieben und löschen
- Aufgaben per Drag-and-drop innerhalb einer Stage oder zwischen Stages sortieren
- Titel, Kategorie, Priorität, Verantwortliche und Fälligkeitsdatum verwalten
- Einen Bearbeiter aus den Board-Mitgliedern zuordnen
- Todos anlegen, bearbeiten, abhaken und löschen
- Verschieben und Löschen einer Aufgabe unmittelbar rückgängig machen

### Workflow-Konfiguration

- Stages hinzufügen, bearbeiten, sortieren und löschen
- Name, Farbe und Typ einer Stage festlegen
- WIP-Limits (Work in Progress) konfigurieren
- Zwischen einem warnenden und einem strikt blockierenden WIP-Limit wählen
- Erlaubte Übergänge zwischen Stages definieren
- Für Ziel-Stages vollständig erledigte Todos verlangen
- Aufgaben beim Löschen einer Stage in eine andere Stage übernehmen

### Suche und Übersicht

- Volltextsuche nach ID, Titel, Kategorie und Kürzel
- Filter nach Priorität, Kategorie und verantwortlicher Person
- Dynamische Trefferzahlen in den Filteroptionen
- Visuelle Kennzeichnung von überfälligen, heute fälligen und bald fälligen Aufgaben
- Fortschrittsanzeige für Todos direkt auf der Aufgabenkarte

### Benutzer und Darstellung

- Lokale Benutzerprofile erstellen, wechseln, bearbeiten und löschen
- Board-Owner und Board-Mitglieder verwalten
- Helles, dunkles oder vom Betriebssystem übernommenes Farbschema verwenden
- Responsive Oberfläche für Desktop und kleinere Bildschirme

### Datensicherung

- Den vollständigen Workspace als versionierte JSON-Datei exportieren
- Backups vor dem Import validieren und als Zusammenfassung anzeigen
- Boards, Aufgaben, Benutzerprofile und Einstellungen gemeinsam wiederherstellen
- Den aktuellen Workspace vor jedem bestätigten Import automatisch sichern

## Bedienung

### Ein Board erstellen

1. In der Seitenleiste **Neues Board** wählen.
2. Namen und optionale Beschreibung eingeben.
3. Gewünschte Standard-Stages auswählen.
4. Bei Bedarf zusätzliche Stages zeilenweise ergänzen.
5. Das Formular speichern.

Der aktive Benutzer wird automatisch Owner des neuen Boards.

### Eine Aufgabe erstellen und bearbeiten

Über **Aufgabe hinzufügen** in einer Stage wird eine neue Aufgabe angelegt. Ein Klick auf eine Aufgabenkarte öffnet die Arbeitsansicht für Status, Zuweisung und Todos. Berechtigte Benutzer erreichen über **Bearbeiten** eine getrennte Ansicht für Titel, Kategorie, Priorität und Fälligkeit.

Aufgaben können vom Board-Owner oder ihrem Bearbeiter mit der Maus verschoben und neu sortiert werden. Aktive Filter deaktivieren das Drag-and-drop-Sortieren, weil dabei nicht alle Kartenpositionen sichtbar sind.

Über die Reiter **Board** und **Liste** lässt sich pro Board zwischen dem visuellen Workflow und einer kompakten Tabellenansicht wechseln. Die Liste verwendet dieselben Filter, kann nach ID, Titel, Status, Priorität, Bearbeiter und Fälligkeit sortiert werden und öffnet beim Anklicken einer Zeile dieselbe Task-Arbeitsansicht.

### Stages konfigurieren

Die Stage-Konfiguration ist nur für den Board-Owner verfügbar. Sie ermöglicht:

- Aufbau und Reihenfolge des Workflows
- WIP-Limits und deren Verhalten
- erlaubte Ziel-Stages
- Abschlussregeln für offene Todos

Ein striktes WIP-Limit verhindert weitere Aufgaben in einer vollen Stage. Ein warnendes Limit lässt die Aktion zu und zeigt lediglich den Status an.

### Rollen und Berechtigungen

JaDy Board unterscheidet zwischen Board-Ownern, Mitgliedern und dem Bearbeiter einer Aufgabe:

- **Board-Owner:** konfiguriert Board, Mitglieder und Workflow, weist Aufgaben zu und darf Aufgaben löschen.
- **Bearbeiter:** pflegt Todos, verschiebt und bearbeitet die zugewiesene Aufgabe und kann die Zuweisung zurückgeben.
- **Mitglied:** darf Aufgaben lesen, neue Aufgaben erstellen und nicht zugewiesene Aufgaben selbst übernehmen.

Die Benutzerprofile sind lokale App-Profile und keine echten, serverseitig authentifizierten Konten. Sie dienen dazu, Rollen und Teamabläufe innerhalb der Demo-Anwendung abzubilden.

## Installation und lokaler Start

Voraussetzung ist eine aktuelle Node.js-Version. Empfohlen wird Node.js 20 oder neuer.

```bash
git clone https://github.com/BexstaWashingtn/jady-board.git
cd jady-board
npm install
npx serve .
```

Anschließend die vom Server ausgegebene lokale Adresse im Browser öffnen. Alternativ kann jeder statische Entwicklungsserver verwendet werden, beispielsweise die VS-Code-Erweiterung Live Server.

Ein HTTP-Server ist erforderlich, weil die Anwendung native JavaScript-Module verwendet. Das direkte Öffnen der `index.html` über `file://` kann deshalb je nach Browser scheitern.

## Qualitätssicherung

```bash
# Alle automatisierten Tests
npm test

# Statische Typprüfung der JavaScript- und JSDoc-Typen
npm run typecheck

# Tests mit Node.js-Coverage-Bericht
npm run test:coverage

# Browser-Smoke-Tests mit Playwright
npx playwright install chromium firefox webkit
npm run test:e2e

# Browser-Smoke-Tests sichtbar ausführen
npm run test:e2e:headed
```

Die Tests decken unter anderem Rendering, State-Operationen, Filter, Persistenz, Berechtigungen, Stages, WIP-Limits, Übergangsregeln, Todos, Fälligkeiten und Undo-Kommandos ab. Die Playwright-Suite prüft zusätzlich in Chromium, Firefox und WebKit den echten Browserstart, das Erstellen und Persistieren einer Aufgabe, Drag-and-drop sowie die Tastaturbedienung eines Dialogs.

## Technische Architektur

```text
index.html
└── src/main.js
    ├── core/JaDyDoCo.js          Deklaratives DOM-Rendering
    ├── board/
    │   ├── board.controller.js   UI-Aktionen und Orchestrierung
    │   ├── actions/              Fachliche Board-, Task-, Stage- und Benutzeraktionen
    │   ├── board.dialog-manager.js Dialogfokus, Escape und Fokusfalle
    │   ├── board.state.js        Domain-State und Geschäftsregeln
    │   ├── board.view-state.js   Flüchtiger Zustand der Oberfläche
    │   ├── board.persistence.js  localStorage und Migrationen
    │   ├── board.transfer.js     Backup-Format, Export und Importvalidierung
    │   ├── board.permissions.js  Zentrale Berechtigungsregeln
    │   ├── board.demo-data.js    Mitgelieferte Showcase-Boards
    │   └── board.dom.js          Gezielte DOM-Aktualisierungen
    ├── templates/
    │   ├── board.map.js          Stabile öffentliche Template-Exports
    │   └── board/                Seite, Kanban, Dialoge und Konfiguration
    ├── features/                 Filter, Feedback und Einstellungen
    └── styles/
        ├── style.css             Geordneter Stylesheet-Einstiegspunkt
        ├── tokens.css            Farben, Abstände, Radien und Layout-Tokens
        ├── base.css              Dokument- und Elementgrundlagen
        ├── components.css        Layout- und Komponentenregeln
        ├── themes.css            Dark-Theme-Verfeinerungen
        └── responsive.css        Animationen und Breakpoints
```

Die Anwendung trennt den dauerhaft gespeicherten Domain-State vom flüchtigen View-State. Geschäftsregeln wie WIP-Limits, Übergänge oder Todo-Abschlussbedingungen liegen in `board.state.js` und sind dadurch unabhängig von der Darstellung testbar.

Die Styles folgen einer festen Importreihenfolge: Design-Tokens, Basisregeln, Komponenten, Theme und responsive Anpassungen. Komponenten verwenden semantische Custom Properties wie `--color-surface`, `--color-text-muted` und `--space-4`; das Theme überschreibt diese Werte zentral in `tokens.css`.

JaDyDoCo übersetzt JavaScript-Objekte rekursiv in DOM-Strukturen. Der Controller verbindet diese deklarativen Templates mit dem Board-State und rendert nach relevanten Aktionen neu.

## Datenhaltung

Der komplette Workspace wird als JSON im `localStorage` des Browsers unter dem Schlüssel `jadydoco.board` gespeichert. Das gespeicherte Schema enthält:

- aktives Board
- alle Boards, Stages und Aufgaben
- aktives Benutzerprofil und alle lokalen Benutzer
- benutzerspezifische Theme-Einstellung
- Schema-Version für Datenmigrationen

Ältere Daten vom Schlüssel `jadydoco.board.v1` werden beim Laden migriert. Ist der Speicher nicht verfügbar oder sind Daten beschädigt, bleibt die App nutzbar und startet mit dem Standardzustand.

Beim Laden werden Workspace, Benutzer, Boards, Stages, Aufgaben und Todos gegen die aktuelle Schema-Version validiert. Reparierbare Inkonsistenzen wie doppelte oder verwaiste Task-Zuordnungen und ungültige Benutzerreferenzen werden automatisch bereinigt. Vor einer Migration oder Reparatur bleibt der ursprüngliche Eintrag unter `jadydoco.board.backup` erhalten. Daten aus einer neueren, unbekannten Schema-Version werden nicht überschrieben.

Wichtig: Es gibt derzeit kein Backend, keine Cloud-Synchronisierung und keinen automatischen Export. Manuelle Backups können unter **JaDyBoard Einstellungen → Daten & Backup** erstellt und wieder eingelesen werden. Ohne ein solches Backup löscht das Leeren der Browserdaten auch die lokal gespeicherten Boards.

## Datenmodell in Kurzform

- **Workspace:** Benutzerprofile, aktive Benutzer-ID, Boards und aktive Board-ID
- **Board:** Projektinformationen, Stages und Aufgaben
- **Stage:** Typ, Farbe, WIP-Limit, Übergangsregeln, Abschlussregel und sortierte Aufgaben-IDs
- **Aufgabe:** Titel, Kategorie, Priorität, Fälligkeit, optionaler Bearbeiter und Todos
- **Todo:** Text und Erledigt-Status

## Showcase-Daten

Beim ersten Start ergänzt die Anwendung Beispielprofile und zwei Showcase-Boards:

- **Product Launch:** demonstriert Review-Gates, Deadlines, Teamzuordnung und Todo-Regeln.
- **Support Operations:** demonstriert Triage, harte WIP-Limits und geregelte Eskalationen.

Diese Daten erleichtern das Ausprobieren der erweiterten Workflow-Funktionen.

## Browser-Unterstützung

Die Anwendung setzt moderne Browser-APIs voraus, insbesondere ES-Module, `structuredClone`, `localStorage`, `matchMedia`, Drag-and-drop und `Intl.DateTimeFormat`. Aktuelle Versionen von Chrome, Edge, Firefox und Safari sind die primären Zielbrowser.

## Server und PostgreSQL

Die Servermigration wird parallel zum weiterhin funktionsfähigen Local-first-Client aufgebaut. Die erste Ausbaustufe enthält einen Node.js-HTTP-Server, PostgreSQL-Migrationen und getrennte Liveness- und Readiness-Endpunkte. Board-Daten werden noch nicht aus der API geladen.

### Lokale Datenbank starten

Voraussetzungen sind Docker mit Compose-Unterstützung und eine unterstützte Node.js-LTS-Version.

```bash
docker compose up -d postgres
```

Die Standardkonfiguration liegt in `.env.example`. Node.js lädt `.env` nicht automatisch; die Werte müssen vor dem Start als Umgebungsvariablen gesetzt oder mit einem geeigneten Prozessmanager geladen werden.

```bash
# Datenbankschema anlegen oder aktualisieren
npm run db:migrate

# API mit automatischem Neustart entwickeln
npm run dev:server

# API ohne Watch-Modus starten
npm run start:server
```

Die API verwendet standardmäßig Port `3000`:

- `GET /api/health` prüft, ob der Node.js-Prozess antwortet.
- `GET /api/ready` prüft zusätzlich die PostgreSQL-Verbindung.

Das initiale relationale Schema trennt Benutzer, Präferenzen, Boards, Mitglieder, Stages, Stage-Übergänge, Tasks und Todos. Positions- und Versionsfelder bereiten sortierbare Inhalte und optimistische Nebenläufigkeitskontrolle vor.

## Aktuelle Grenzen

- Daten werden ausschließlich lokal im aktuellen Browser gespeichert.
- Es gibt keine Anmeldung, Zugriffskontrolle oder Mehrgeräte-Synchronisierung.
- Gleichzeitige Bearbeitung durch mehrere Personen wird nicht unterstützt.
- Automatische oder zeitgesteuerte Backups sind nicht vorhanden; Exporte müssen manuell ausgelöst werden.
- Benutzerprofile simulieren Teamrollen nur innerhalb des lokalen Workspace.

## Technologien

- HTML5 und CSS3
- JavaScript mit nativen ES-Modulen
- JaDyDoCo als eigenes deklaratives DOM-Framework
- Node.js Test Runner
- JSDoc und TypeScript `checkJs` für statische Typprüfung
- `localStorage` für clientseitige Persistenz
