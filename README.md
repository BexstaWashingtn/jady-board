# JaDy Board

**Live-Version:** [https://jady-board.vercel.app](https://jady-board.vercel.app)

JaDy Board ist eine browserbasierte Kanban-Anwendung zur Organisation von Aufgaben, Arbeitsabläufen und kleinen Teams. Die Oberfläche wurde vollständig mit dem eigenen **JaDyDoCo-Framework** (JavaScript Dynamic DOM Constructor) umgesetzt und kommt ohne Frontend-Framework und ohne produktive Frontend-Laufzeitabhängigkeiten aus.

Das Repository unterstützt zwei klar getrennte Betriebsmodi:

- **Local-first (Standard und produktive Live-Version):** Die Anwendung läuft vollständig im Browser. Boards, Aufgaben, Benutzerprofile und Einstellungen werden im `localStorage` gespeichert.
- **PostgreSQL-API (Entwicklungsmodus):** Ein optionaler Node.js-Server erprobt relationale Persistenz und serverseitige Schreiboperationen. Dieser Modus besitzt noch keine produktionsfähige Authentifizierung.

Ohne ausdrücklichen API-Opt-in bleibt der Local-first-Client vollständig unabhängig vom Server.

Kann ein ausdrücklich ausgewählter API-Workspace nicht geladen werden, zeigt
der Client einen Fehlerzustand und wechselt nicht automatisch in den lokalen
Workspace. So landen Änderungen nicht unbemerkt in der falschen Datenquelle.

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

Voraussetzung ist eine aktuelle Node.js-Version. Empfohlen wird Node.js 22 oder neuer (aufgrund von `--watch` und nativen Test-Runner-Features).

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

Die PostgreSQL-Integrationstests und der vollständige lokale Coverage-Gate benötigen `DATABASE_URL_TEST`. Starte dafür zuerst PostgreSQL mit `docker compose up -d postgres`, führe `npm run db:migrate` aus und setze `DATABASE_URL_TEST` auf die Testdatenbank. Ohne diese Variable werden die Datenbankintegrationen übersprungen; dadurch kann der globale Branch-Coverage-Grenzwert lokal unterschritten werden.

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

Die Servermigration wird parallel zum weiterhin funktionsfähigen Local-first-Client aufgebaut. Der Node.js-HTTP-Server stellt Liveness, Readiness und eine erste lesende Board-API bereit. Der Browser-Client arbeitet bis zur folgenden Integrationsstufe weiterhin mit seinem lokalen Workspace.

> **Sicherheitsgrenze:** Der Server unterstützt verifizierte, opake Bearer-Credentials über `API_BEARER_IDENTITIES`. `DEV_USER_ID` bleibt ein ausdrücklich davon getrennter Entwicklungsadapter und darf nicht gleichzeitig konfiguriert werden. CORS ist standardmäßig geschlossen, geschützte Routen sind rate-limitiert und jede Antwort trägt eine Request-ID sowie grundlegende Security-Header. Für große, horizontal skalierte Installationen muss der mitgelieferte In-Memory-Limiter durch einen gemeinsamen Store ersetzt und die Credential-Verwaltung an einen dedizierten Identity Provider angebunden werden.

Die Identity-Schicht trennt bereits die Verifikation eines externen Principals
(`issuer` und `subject`) von dessen Zuordnung zu einer lokalen PostgreSQL-
Benutzer-ID. Rollen, Board-Mitgliedschaften und Berechtigungen bleiben dadurch
providerunabhängig. Der vollständige Integrationsvertrag und die bewusst
vertagten Produktentscheidungen stehen in
[`docs/identity-architecture.md`](docs/identity-architecture.md).
Das verbindliche Zielmodell für Teams, getrennte Team- und Boardrollen,
Einladungen und Account-Verknüpfungen beschreibt
[`ADR 0001`](docs/adr/0001-team-tenancy-and-account-linking.md).

### Lokale Datenbank starten

Voraussetzungen sind Docker mit Compose-Unterstützung und eine unterstützte Node.js-LTS-Version.

```bash
docker compose up -d postgres
```

Die Standardkonfiguration liegt in `.env.example`. Kopiere sie vor dem ersten
Start nach `.env`; die npm-Skripte laden diese lokale Datei automatisch. Bereits
gesetzte Umgebungsvariablen haben weiterhin Vorrang.

```powershell
Copy-Item .env.example .env
```

Unter Bash entspricht das `cp .env.example .env`. Die Datei `.env` wird nicht
in Git eingecheckt.

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
- `GET /api/boards` listet die Boards des mit `DEV_USER_ID` konfigurierten Entwicklungsbenutzers.
- `GET /api/boards/:id` liefert ein zugängliches Board einschließlich Mitglieder, Spalten, Tasks, Todos und Übergänge.
- `PATCH /api/boards/:boardId/tasks/:taskId` aktualisiert Titel, Kategorie, Priorität und Fälligkeit eines Tasks. Das Feld `version` schützt vor dem Überschreiben paralleler Änderungen.
- `PATCH /api/boards/:boardId/tasks/:taskId/position` verschiebt einen Task transaktional in eine andere Stage und prüft Rollen, Übergänge, offene Todos, harte WIP-Limits und die Task-Version.
- `POST /api/boards/:boardId/tasks` erstellt einen Task mit atomar vergebener Tasknummer und prüft Mitgliedschaft, Zuweisung und harte WIP-Limits.
- `PATCH /api/boards/:boardId/tasks/:taskId/assignment` weist einen Task versioniert zu oder gibt ihn frei und setzt die Owner-/Bearbeiterregeln serverseitig durch.
- `PATCH /api/boards/:boardId/tasks/:taskId/todos` synchronisiert die Todo-Liste transaktional, normalisiert neue IDs und schützt Änderungen über die Task-Version.
- `DELETE /api/boards/:boardId/tasks/:taskId?version=...` löscht einen Task als Board-Owner transaktional und schließt die Positionslücke in seiner Stage.
- `PATCH /api/boards/:boardId/stages/:stageId` aktualisiert Stage-Einstellungen, Übergänge und WIP-Regeln versioniert als Board-Owner; der Stage-Editor verwendet diesen Endpunkt im API-Modus.
- `POST /api/boards/:boardId/stages` legt eine neue Stage samt Übergängen als Board-Owner an; der Stage-Editor übernimmt die serverseitige UUID und Version.
- `PATCH /api/boards/:boardId/stages/:stageId/position` sortiert eine Stage versioniert und transaktional neu ein.
- `DELETE /api/boards/:boardId/stages/:stageId` löscht eine Stage versioniert und übernimmt vorhandene Tasks transaktional in eine zulässige Ziel-Stage.
- `PATCH /api/boards/:boardId` aktualisiert Name, Pfad und Beschreibung eines Boards versioniert als Owner.

### Neon-Verbindungen

Für Neon werden Laufzeit- und Migrationsverbindung getrennt konfiguriert. Der
Server verwendet den PgBouncer-Pooler; Schema-Migrationen verwenden wegen ihrer
Transaktionen und Advisory Locks den direkten Endpoint. Beide Verbindungen
erzwingen eine vollständige TLS-Prüfung:

```dotenv
DATABASE_URL=postgresql://...@ep-...-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=verify-full
DATABASE_MIGRATION_URL=postgresql://...@ep-....eu-central-1.aws.neon.tech/neondb?sslmode=verify-full
DATABASE_SSL=true
```

`DATABASE_MIGRATION_URL` darf lokal leer bleiben; dann verwendet der Migrator
weiterhin `DATABASE_URL`. Zugangsdaten gehören ausschließlich in `.env` oder den
Secret Store der jeweiligen Laufzeit und niemals ins Repository.

Für den regulären API-Modus authentifiziert Clerk den Benutzer vollständig. Das
JaDy Board speichert keine Passwörter und übernimmt keine Clerk-Rollen. Nach
`npm run db:migrate` wird eine Clerk-Identität explizit über `(issuer, subject)`
in `external_identities` mit einem vorhandenen lokalen `users.id` verknüpft;
Boards, Rollen, Mitgliedschaften und alle Berechtigungsentscheidungen bleiben
in PostgreSQL.

```dotenv
AUTH_MODE=clerk
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_AUTHORIZED_PARTIES=http://127.0.0.1:4173
CORS_ORIGIN=http://127.0.0.1:4173
```

Der Browser bezieht die öffentliche Auth-Konfiguration über
`GET /api/auth/config`, rendert die Clerk-Anmeldung und sendet pro API-Request
ein aktuelles Clerk-Session-Token. Ein gültiger, aber noch nicht lokal
verknüpfter Clerk-Benutzer erhält `403 IDENTITY_NOT_LINKED`. Details und ein
SQL-Beispiel zur kontrollierten Verknüpfung stehen in
[`docs/identity-architecture.md`](docs/identity-architecture.md).

Eine vorhandene lokale Benutzer-ID kann zunächst ohne Änderung geprüft und
anschließend explizit verknüpft werden:

```powershell
npm run db:link-clerk-user -- --local-user <uuid> --issuer <https-clerk-issuer> --subject <user_...> --dry-run
npm run db:link-clerk-user -- --local-user <uuid> --issuer <https-clerk-issuer> --subject <user_...>
```

`DEV_USER_ID` ist eine vorübergehende Entwicklungsidentität und muss der UUID eines importierten Benutzers entsprechen. Für kontrollierte Tests kann stattdessen eine JSON-Liste opaker Credentials konfiguriert werden; Tokens benötigen mindestens 32 Zeichen:

```dotenv
AUTH_MODE=controlled-bearer
API_BEARER_IDENTITIES=[{"userId":"8acf3017-cf6e-589b-bd47-a1d8ccec16a8","token":"replace-with-at-least-32-random-characters"}]
CORS_ORIGIN=https://board.example.com
RATE_LIMIT_REQUESTS=120
RATE_LIMIT_WINDOW_MS=60000
```

Ein Request authentifiziert sich anschließend mit `Authorization: Bearer <token>`. Health- und Readiness-Endpunkte bleiben vom Rate Limit ausgenommen. Der Limiter arbeitet pro Serverprozess und Client-IP; mehrere Serverinstanzen benötigen einen gemeinsamen Limiter-Adapter.

Im Browser zeigt der API-Modus bei einer geschützten API automatisch eine
Login-Ansicht. Das dort eingegebene Token wird API-spezifisch ausschließlich im
`sessionStorage` gehalten, bei allen Requests als Bearer-Credential übertragen
und beim Schließen der Browser-Sitzung oder beim Abmelden entfernt. Ein `401`
führt zurück zum Login; `403`, `409` und `429` werden als unterscheidbare,
verständliche Aktionsfehler angezeigt. Tokens gehören weder in die URL noch in
den dauerhaften `localStorage`.

Der Browser bleibt standardmäßig Local-first. Die lesende API-Anbindung kann für die Migration explizit aktiviert werden:

```text
http://127.0.0.1:4173/?data-source=api&api-url=http://127.0.0.1:3000
```

Der Client lädt dann die zugänglichen Boards aus PostgreSQL. Der vollständige Task-Lebenszyklus einschließlich Erstellen, Bearbeiten, Statusformular, Drag-and-drop, Zuweisen, Todos und Löschen wird bereits an den Server geschrieben. Auch Board-Metadaten und der vollständige Stage-Lebenszyklus werden dauerhaft gespeichert. Änderungen an Mitgliedern sowie das Erstellen und Löschen ganzer Boards sind in diesem Zwischenstand nur im Arbeitsspeicher sichtbar; ein Neuladen stellt dafür den Datenbankstand wieder her. Ist die API beim Start nicht erreichbar, verwendet der Client weiterhin den lokalen Workspace.

### Bestehenden Workspace prüfen und importieren

Ein vom Local-first-Client exportiertes JaDy-Board-Backup kann zunächst ohne
Datenbankzugriff validiert werden:

```bash
npm run db:import -- --dry-run ./jady-board-backup.json
```

Der echte Import benötigt `DATABASE_URL` und ein vollständig migriertes Schema:

```bash
npm run db:migrate
npm run db:import -- ./jady-board-backup.json
```

Der Import bildet Legacy-IDs deterministisch auf UUIDs ab und übernimmt
Benutzer, Einstellungen, Boards, Mitglieder, Stages, Übergänge, Tasks und Todos
in einer gemeinsamen Transaktion. Ein inhaltlich identisches Backup wird nur
einmal akzeptiert.

Das initiale relationale Schema trennt Benutzer, Präferenzen, Boards, Mitglieder, Stages, Stage-Übergänge, Tasks und Todos. Positions- und Versionsfelder bereiten sortierbare Inhalte und optimistische Nebenläufigkeitskontrolle vor.

## Aktuelle Grenzen

- Der Browser-Client arbeitet standardmäßig weiterhin mit seinem lokalen Workspace. Im optionalen API-Modus werden neue Tasks, Task-Metadaten und Statusänderungen aus dem Task-Dialog bereits gespeichert; alle anderen Änderungen gehen beim Neuladen weiterhin verloren.
- Clerk stellt die interaktive Browser-Anmeldung bereit. Registrierung, Einladungen, Teams und weitere Account-Verknüpfungsabläufe sind noch nicht als Produktprozesse umgesetzt.
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
