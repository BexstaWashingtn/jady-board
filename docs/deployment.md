# Deployment auf Vercel mit Neon und Clerk

JaDy Board wird als statische Web-Anwendung und als Node.js Function im selben
Vercel-Projekt betrieben. Dadurch kann der Browser die API über denselben Origin
aufrufen. Clerk bleibt der einzige Identity Provider; Neon stellt ausschließlich
PostgreSQL bereit.

## Umgebungen

Jede dauerhaft verwendete Umgebung erhält einen eigenen Neon-Branch. Die
Produktionsumgebung verwendet den Neon-Hauptbranch. Preview-Deployments dürfen
niemals auf die Produktionsdatenbank schreiben.

| Vercel-Umgebung | Neon-Ziel | Zweck |
| --- | --- | --- |
| Development | lokales PostgreSQL oder Development-Branch | lokale Entwicklung |
| Preview | eigener Preview-/Staging-Branch | Integrations- und Abnahmetests |
| Production | Hauptbranch | öffentlich verwendete Anwendung |

## Vercel-Variablen

Folgende Werte werden im Vercel-Dashboard gesetzt und nicht ins Repository
geschrieben:

```text
DATABASE_URL                 gepoolte Neon-URL mit sslmode=verify-full
DATABASE_SSL                 true
AUTH_MODE                    clerk
CLERK_PUBLISHABLE_KEY        öffentlicher Clerk-Schlüssel
CLERK_SECRET_KEY             geheimer Clerk-Schlüssel
CLERK_AUTHORIZED_PARTIES     exakter HTTPS-Origin der Umgebung
CORS_ORIGIN                  derselbe exakte HTTPS-Origin
RATE_LIMIT_REQUESTS          zum Beispiel 120
RATE_LIMIT_WINDOW_MS         zum Beispiel 60000
```

`DATABASE_MIGRATION_URL` wird bewusst nicht von der laufenden Vercel Function
benötigt. Die direkte Neon-URL gehört in den Secret Store des kontrollierten
Migrationsschritts. Preview- und Production-Werte werden in Vercel getrennt
gepflegt. Für einen festen Staging-Branch sollte dessen stabile Branch-Domain in
Clerk, `CLERK_AUTHORIZED_PARTIES` und `CORS_ORIGIN` eingetragen werden.

## Clerk

Im Clerk-Dashboard werden die Produktionsdomain und gegebenenfalls die stabile
Staging-Domain als erlaubte Origins beziehungsweise Redirect-Ziele hinterlegt.
Der Secret Key bleibt ausschließlich serverseitig. Neon Auth wird nicht
aktiviert.

## Kontrollierter Release

Ein Datenbankschema wird vor der Freigabe des dazugehörigen Deployments
aktualisiert. Migrationen sind idempotent und laufen ausschließlich über die
direkte Neon-Verbindung:

```powershell
$env:DATABASE_URL = $env:DATABASE_MIGRATION_URL
$env:DATABASE_SSL = "true"
npm.cmd run db:migrate
```

Empfohlene Reihenfolge:

1. Neon-Branch für Staging oder Preview aus dem aktuellen Zielstand erstellen.
2. Migrationen mit der direkten URL auf diesem Branch ausführen.
3. Preview mit der gepoolten URL dieses Branches deployen.
4. Anmeldung, Readiness und einen schreibenden Board-Ablauf prüfen.
5. Migrationen mit der direkten URL auf Production ausführen.
6. Das geprüfte Deployment nach Production promoten.
7. `/api/health`, `/api/ready`, Clerk-Anmeldung und Board-Schreibzugriff prüfen.

Schemaänderungen müssen während eines rollierenden Deployments sowohl mit der
alten als auch mit der neuen Anwendungsversion kompatibel sein. Destruktive
Änderungen erfolgen daher in mindestens zwei Releases: zunächst erweitern und
umstellen, erst später entfernen.

## Rollback

Ein Anwendungsrollback erfolgt durch Promotion des vorherigen Vercel-
Deployments. Datenbankmigrationen werden nicht blind rückwärts ausgeführt. Bei
einem Datenproblem wird vor einer Korrektur ein Neon-Branch vom gewünschten
Zeitpunkt erstellt und geprüft. Zugangsdaten werden bei Verdacht auf Offenlegung
sofort in Neon beziehungsweise Clerk rotiert.

## Abnahmecheck

- `/api/health` liefert HTTP 200 und `status: ok`.
- `/api/ready` liefert HTTP 200 und `status: ready`.
- `/api/auth/config` veröffentlicht nur Clerk-Modus und Publishable Key.
- Ein verknüpfter Clerk-Benutzer sieht seine PostgreSQL-Boards.
- Ein nicht verknüpfter Benutzer erhält `IDENTITY_NOT_LINKED`.
- Task-Änderung und Abmeldung funktionieren.
- Runtime-Logs enthalten weder Datenbank-URLs noch Clerk-Secrets.
