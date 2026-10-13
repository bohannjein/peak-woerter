# Peake Wörter

Unser kleines, internes Archiv für bemerkenswerte Wörter. Zwei Kuratoren schlagen Wörter vor und stimmen per Wischgeste ab. Nur was beide mit **Ja** bewerten, wird zum Wörterbucheintrag. Die Seite ist komplett privat: Ohne Anmeldung ist nichts sichtbar, Konten gibt es nur per Einladung.

---

## Inhalt

1. [Funktionen](#funktionen)
2. [Installation (Ubuntu, Docker, Portainer)](#installation)
3. [Ersteinrichtung](#ersteinrichtung)
4. [Backup und Restore](#backup-und-restore)
5. [Update](#update)
6. [Konto-Wiederherstellung](#konto-wiederherstellung)
7. [Entwicklung und Tests](#entwicklung-und-tests)
8. [Architektur und Entscheidungen](#architektur-und-entscheidungen)
9. [Stand und bekannte Grenzen](#stand-und-bekannte-grenzen)

---

## Funktionen

| Bereich | Umfang |
|---|---|
| Abstimmung | Swipe-Stapel (rechts Ja, links Nein, unten Später), gleichwertige Buttons, Tastatur (← ↓ →, Z = Rückgängig), Haptik, Rückgängig, reduzierte Animationen |
| Entscheidungslogik | Ja+Ja → Sammlung · Nein+Nein → Negativliste · sonst → Später-Liste · fehlende Stimme → ausstehend. Jede Runde ist separat gespeichert. |
| Später-Liste | Diskussion mit Kommentaren, Verlauf aller Runden, neue Runde starten, Diskussionsmodus mit großen Karten |
| Neubewertung | Akzeptierte Wörter erneut abstimmen. Beim ersten Nein wird das Wort ausgeblendet, bis die Runde entschieden ist. |
| Wörterbuch | Mehrere nummerierte Bedeutungen, IPA mit mehreren Aussprachevarianten (bestätigt/unbestätigt), Wortart, Grammatik, Beispiele, Verwendung, Herkunft, Schreibweisen, Kategorien, echte Audioaufnahmen |
| Redaktion | Unvollständige Einträge sind erlaubt. Korrekturen lösen keine Abstimmung aus. Eine Änderung des Begriffs oder eine als grundlegend markierte Bedeutungsänderung startet eine Neubewertung. |
| Archiv (nur mit Anmeldung) | Startseite mit Suche, Wort des Tages (Europe/Berlin, für alle gleich), zuletzt hinzugefügten Wörtern und Kategorien; Sammlung als Wörterbuchliste mit Suche, Kategorien, A–Z/Neueste, Listen- und Kartenansicht; Wortseiten mit eigener URL, ähnliche Wörter, Zufall, Teilen |
| Einreichen | Kuratoren: Wort tippen, absenden, fertig (Duplikat-Hinweis live). |
| Duplikate | Normalisierung (Groß/klein, Leerzeichen, Anführungszeichen, unsichtbare Zeichen), Hinweis auf Archiv, laufende Abstimmung, Später-Liste oder Negativliste. |
| Peake Wrapped | Jahresrückblick als Story, nur aus gespeicherten Runden berechnet. Mitglieder ohne Stimmrecht sehen nur unkritische Zahlen (keine Stimmen, keine Namen). |
| KI (optional) | OpenAI-kompatible Schnittstelle (auch lokal, z. B. Ollama). Liefert nur Entwürfe mit Unsicherheitsangabe. KI-IPA ist nie „bestätigt“, neue KI-Kategorien gelten erst, wenn Kuratoren sie anlegen. |
| Sicherheit | Passwort (scrypt), Passkeys (WebAuthn), TOTP mit Recovery-Codes, Pflicht-Richtlinien, Einladungen statt Registrierung, Setup-Token, CSP mit Nonce, Rate Limits, Audit-Log |
| Verwaltung | Benutzer, Kuratorenplätze, Einladungen, Passwort-Links, 2FA-Reset, Sperren, Richtlinien, Kategorien, Negativliste, KI, Export (JSON/CSV), Systeminfo, Protokoll |
| PWA | Installierbar, Safe Areas, Offline-Seite, Shortcuts „Abstimmen“ und „Wort hinzufügen“ |

---

## Installation

Voraussetzungen: Ubuntu-Server mit Docker und Docker Compose (oder Portainer) und ein vorhandener Reverse Proxy mit HTTPS (z. B. Caddy, Traefik, Nginx Proxy Manager).

```bash
git clone <repo> peake-woerter && cd peake-woerter
cp .env.example .env
# .env ausfüllen:
#   PUBLIC_URL          = exakte HTTPS-Adresse, z. B. https://woerter.example.de
#   BETTER_AUTH_SECRET  = openssl rand -base64 48
#   POSTGRES_PASSWORD   = openssl rand -hex 32   (nur Buchstaben/Ziffern, steht in einer URL)
docker compose up -d --build
docker compose logs -f app
```

Die App lauscht auf `127.0.0.1:3000` (änderbar über `APP_PORT` und `APP_BIND`). Den Reverse Proxy auf diese Adresse zeigen lassen. Beispiel Caddy:

```
woerter.example.de {
    reverse_proxy 127.0.0.1:3000
}
```

Der Proxy muss `X-Forwarded-For` setzen (alle gängigen tun das). Das Rate Limit der Anmeldung verlässt sich darauf.

### Mit Portainer (direkt aus GitHub)

Portainer klont das Repo und baut das Image selbst. Kein Shell-Zugriff nötig.

1. *Stacks → Add stack*, Name `peake`, Build-Methode **Repository**.
2. Repository URL: `https://github.com/bohannjein/peak-woerter`, Reference: `refs/heads/main`, Compose path: `docker-compose.yml`.
3. Das Repo ist privat: **Authentication** einschalten. Benutzername = GitHub-Name, Passwort = ein *Fine-grained Personal Access Token* (GitHub → Settings → Developer settings), nur dieses Repo, Berechtigung *Contents: Read-only*.
4. Unter **Environment variables** eintragen:

   | Variable | Wert |
   |---|---|
   | `PUBLIC_URL` | exakte HTTPS-Adresse, z. B. `https://woerter.example.de` (ohne `/` am Ende) |
   | `BETTER_AUTH_SECRET` | langer Zufallswert, z. B. `openssl rand -base64 48` |
   | `POSTGRES_PASSWORD` | nur Buchstaben und Ziffern, z. B. `openssl rand -hex 32` |
   | `SETUP_TOKEN` | optional, sonst steht es im Container-Log von `app` |
   | `APP_PORT` | optional, Standard `3000` |
   | `APP_BIND` | optional: `127.0.0.1` (Proxy auf demselben Host, Standard) oder `0.0.0.0` (Proxy auf anderem Rechner) |

5. *Deploy the stack*. Der erste Build dauert einige Minuten.
6. Reverse Proxy auf den App-Port zeigen lassen und `PUBLIC_URL` im Browser öffnen.

Läuft der Reverse Proxy selbst als Container (z. B. Nginx Proxy Manager), alternativ das `ports:`-Mapping entfernen und den `app`-Dienst in das Netzwerk des Proxys hängen. Optional *GitOps updates* aktivieren, dann baut Portainer nach jedem Push neu.

`POSTGRES_PASSWORD` nach dem ersten Start nicht mehr ändern: Postgres übernimmt es nur beim allerersten Anlegen der Datenbank.

> `PUBLIC_URL` muss exakt der Adresse entsprechen, unter der die App im Browser aufgerufen wird. Passkeys sind an diese Domain gebunden. Wird die Domain später geändert, funktionieren vorhandene Passkeys nicht mehr. Passwort und TOTP funktionieren weiter.

---

## Ersteinrichtung

1. `https://<deine-domain>/einrichtung` öffnen. Ohne Einrichtung leitet jede Seite dorthin um.
2. Das **Setup-Token** eingeben. Es ist entweder der Wert aus `SETUP_TOKEN` oder wird beim ersten Aufruf erzeugt und steht im Log: `docker compose logs app`.
3. Administratorkonto anlegen (mindestens 12 Zeichen, keine Standardzugangsdaten). Wahlweise selbst Kuratorenplatz 1 belegen.
4. Optional einen Passkey und TOTP einrichten.
5. Einladungslink für den zweiten Kurator erstellen und persönlich weitergeben (7 Tage gültig, einmalig).
6. Richtlinien festlegen (2FA/Passkey Pflicht).
7. Abschließen. Danach ist `/einrichtung` dauerhaft gesperrt. Neue Konten entstehen nur noch über Einladungen.

---

## Backup und Restore

Zu sichern sind zwei Dinge: die Datenbank und das Volume `appdata` (Audioaufnahmen).

**Backup**

```bash
mkdir -p backups
docker compose exec -T db pg_dump -U peake -Fc peake > backups/peake-$(date +%F).dump
docker run --rm -v peake_appdata:/data -v "$PWD/backups":/out alpine \
  tar czf /out/peake-audio-$(date +%F).tgz -C /data .
```

Als täglicher Cronjob (`crontab -e`):

```
30 3 * * * cd /opt/peake-woerter && docker compose exec -T db pg_dump -U peake -Fc peake > backups/peake-$(date +\%F).dump && find backups -name '*.dump' -mtime +30 -delete
```

Backups liegen unverschlüsselt vor und enthalten E-Mail-Adressen sowie Passwort-Hashes. Bewahre sie entsprechend auf (z. B. verschlüsselt mit `age` oder `gpg` und außerhalb des Servers).

**Restore**

```bash
docker compose stop app
docker compose exec -T db pg_restore -U peake -d peake --clean --if-exists < backups/peake-2026-10-13.dump
docker run --rm -v peake_appdata:/data -v "$PWD/backups":/in alpine \
  sh -c "rm -rf /data/* && tar xzf /in/peake-audio-2026-10-13.tgz -C /data"
docker compose start app
```

Zusätzlich gibt es unter *Verwaltung → Export & Backup* einen JSON-Export (alles außer Zugangsdaten) und einen CSV-Export der Sammlung.

---

## Update

```bash
cd /opt/peake-woerter
docker compose exec -T db pg_dump -U peake -Fc peake > backups/vor-update-$(date +%F).dump   # vorher sichern
git pull
docker compose up -d --build
```

Beim Start wendet der Container ausstehende Migrationen an (`prisma migrate deploy`). Migrationen sind additiv, vorhandene Daten bleiben erhalten. Die Volumes `dbdata` und `appdata` werden nie angetastet. In Portainer: *Stack → Pull and redeploy*.

---

## Konto-Wiederherstellung

| Situation | Lösung |
|---|---|
| Passwort vergessen | Admin erstellt unter *Verwaltung → Benutzer* einen **Passwort-Link** (24 h, einmalig). Zweiter Faktor und Passkeys bleiben bestehen. |
| Authenticator verloren | Mit einem **Recovery-Code** anmelden (Anmeldung → „Wiederherstellungscode nutzen“). Danach neue Codes erzeugen. |
| Authenticator und Codes verloren | Admin nutzt **2FA zurücksetzen**. Gilt eine 2FA-Pflicht, muss die Person sie direkt nach der Anmeldung neu einrichten. Vorher ist nichts anderes erreichbar. |
| Kein Admin kommt mehr hinein | Mit Shell-Zugriff auf den Server: `docker compose exec app node scripts/admin-reset-link.mjs admin@example.de` (optional `--reset-2fa`). Der Server-Zugang ist hier der Vertrauensanker. |

Pflicht-Richtlinien lassen sich durch keinen dieser Wege umgehen. Eine Wiederherstellung führt immer zurück in die Pflicht-Einrichtung.

---

## Entwicklung und Tests

Node.js ≥ 22. Für die lokale Entwicklung ohne Docker startet `npm run db:dev` ein eingebettetes PostgreSQL (Port 5433).

```bash
npm install
npm run db:dev                     # Terminal 1
cp .env.example .env.local         # DATABASE_URL=postgresql://peake:peake@localhost:5433/peake,
                                   # BETTER_AUTH_URL=http://localhost:3000, BETTER_AUTH_SECRET=…
npx prisma migrate deploy
npm run dev
```

> **Windows-Hinweis:** Enthält der Projektpfad ein `&` (z. B. „GmbH & Co. KG“), scheitern npm-Skripte an `cmd.exe`. Lege eine Junction ohne Sonderzeichen an (`mklink /J C:\dev\peake "<Pfad>"`) und arbeite von dort, oder rufe die Werkzeuge direkt auf (`node node_modules/next/dist/bin/next dev`).

**Unit- und Integrationstests** (Vitest gegen ein echtes, automatisch gestartetes PostgreSQL; alternativ `TEST_DATABASE_URL` setzen):

```bash
npm test
```

Abgedeckt sind unter anderem: alle Kombinationen der Entscheidungstabelle, ausstehende Runden, kein doppeltes Abstimmen (auch bei gleichzeitigem Doppelklick), gleichzeitige Stimmen beider Kuratoren, keine Stimmen von Gästen, Admins ohne Sitz und gesperrten Konten, Duplikaterkennung, Rückgängig, Neubewertung (alle Ausgänge, Ausblenden beim ersten Nein), Wiederherstellung von der Negativliste, Bearbeitung von Definitionen, mehrere Aussprachevarianten, wesentliche Änderungen, öffentliche Sichtbarkeit, Wort des Tages (stabil, Ersatz, Tagesgrenze Europe/Berlin), Jahresstatistik, Ersteinrichtung, Einladungen, Kuratorensitze, Passwort- und 2FA-Reset, Authentifizierungsrichtlinien.

**End-to-End-Test auf Smartphone-Viewport** (Playwright; erwartet eine laufende Instanz mit **leerer** Datenbank und `SETUP_TOKEN=test-setup-token`):

```bash
npx playwright install chromium    # oder PW_CHANNEL=msedge / chrome für einen installierten Browser
npm run test:e2e
```

Der Ablauf: Einrichtung mit falschem und richtigem Token, Einladung annehmen (einmalig), Wort einreichen, Duplikat-Hinweis, Wischen nach rechts, Nein per Button, Rückgängig, Später per Tastatur, öffentliche Sichtbarkeit, ohne Anmeldung nichts sichtbar, Mitglied ohne Stimmrecht, Suche und Kategorienfilter, Eintrag mit IPA bearbeiten.

---

## Architektur und Entscheidungen

```
src/
  app/
    (app)/            Archiv (Start, Sammlung, Wortseiten), Kuratorenbereich (/k), Verwaltung (/admin), Konto – alles nur mit Anmeldung
    (bare)/           Anmelden, Einrichtung, Einladung, Passwort-Link
    actions/          Server Actions (validieren mit Zod, prüfen Rechte serverseitig)
    api/              Better Auth, Health, Audio, Export
  lib/
    voting.ts         Zustandsmaschine – jede Statusänderung eines Wortes läuft hier durch
    words.ts          Einreichen, Duplikate, Redaktion, Kommentare
    accounts.ts       Setup-Token, Einladungen, Passwort-/2FA-Reset
    access.ts         Sitzung, Rollen, Richtlinien-Gate
    daily.ts          Wort des Tages
    wrapped.ts        Jahresrückblick
    ai.ts             austauschbare KI-Provider-Schnittstelle
  components/         Quartett-Karte, Navigation, Formulare, Sicherheitspanel
prisma/               Schema und Migrationen (inkl. handgeschriebener Constraints)
tests/ e2e/           Vitest- und Playwright-Tests
```

**Entscheidungen**

- **Stimmrecht = Kuratorensitz.** Es gibt genau zwei Sitze (Tabelle `curator_seat`, per CHECK auf 1 und 2 begrenzt). Adminrechte geben keine Stimme. Votes sind eindeutig pro Runde und Sitz.
- **Runden statt Überschreiben.** Jede Abstimmung ist eine `voting_round`. Neubewertungen und neue Runden legen neue Zeilen an. Ein partieller Unique-Index erlaubt nur eine offene Runde pro Wort. Statistiken entstehen aus diesen Ereignissen.
- **Nebenläufigkeit.** Stimmabgabe sperrt Wort und Runde (`SELECT … FOR UPDATE`) in einer Transaktion. Kartennummern werden unter einem Advisory Lock vergeben. Getestet mit parallelen Stimmen.
- **Sichtbarkeit wird nur von der Zustandsmaschine gesetzt** (`word.isPublic`). Eine DB-Constraint verhindert öffentliche, nicht akzeptierte Wörter. Öffentliche Abfragen selektieren nur öffentliche Felder.
- **Intern statt öffentlich.** Das App-Layout leitet jede Anfrage ohne Sitzung auf `/anmelden` um, ebenso `/zufall`; Audio und Export prüfen selbst. Suchmaschinen sind ausgesperrt (`robots.txt`, `noindex`). Rollen: zwei Kuratoren mit Stimme, Admin, und Mitglieder ohne Stimmrecht, die nur lesen (Einladung ohne Kuratorenplatz). Die frühere Tabelle `submission` für Gastvorschläge bleibt im Schema, wird aber nicht mehr benutzt.
- **Rückgängig** hat zwei Stufen: 4 Sekunden lang wird die Stimme gar nicht gesendet. Danach kann die eigene Stimme zurückgenommen werden, solange die Runde offen ist. Beim Verlassen der Seite wird sofort gesendet, damit keine Stimme verloren geht.
- **Die Stimme des anderen bleibt verborgen**, solange eine Runde offen ist (gegen Beeinflussung). Nach der Entscheidung ist alles sichtbar.
- **Lautschrift:** IPA wird ohne Klammern gespeichert und in Charis SIL gesetzt (volle IPA-Abdeckung inkl. Verbindungsbogen t͡s). Öffentlich erscheint nur von Kuratoren bestätigte Lautschrift.
- **Wort des Tages** wird einmal pro Berliner Kalendertag gezogen und gespeichert. Fällt ein Wort aus der Sammlung, wird beim nächsten Aufruf ersetzt.
- **Keine Pflicht-Cloud-Dienste.** Schriften sind selbst gehostet, kein CDN, keine Analyse. KI ist optional und austauschbar.
- **UI-Basis:** Statt der shadcn/ui-CLI nutzt die App eigene schlanke Komponenten im selben Prinzip (Tailwind, Lucide, native Elemente wie `<select>`, `<input type=checkbox>`, `<audio>`). So kommen keine zusätzlichen Radix-Abhängigkeiten dazu, und das Kartenspiel-Design muss nicht gegen Standard-Styles arbeiten.
- **Designsystem „Wort-Quartett“:** Jedes Wort ist eine Sammelkarte mit Kartennummer und echten Werten (Buchstaben, Bedeutungen, Runden, Aufnahmedatum). Farbe trägt ausschließlich Bedeutung: Kategoriefarben und die drei Stimmfarben. Details in `PRODUCT.md` und `DESIGN.md`.

**Stack:** Next.js 16 (App Router), React 19, TypeScript, PostgreSQL, Prisma 7 (Driver Adapter `pg`), Better Auth 1.7 (E-Mail/Passwort, `@better-auth/passkey`, `twoFactor`), Zod 4, Tailwind CSS 4, Lucide, Vitest, Playwright.

---

## Stand und bekannte Grenzen

Bewusst offen dokumentiert:

- **Docker-Image ungetestet gebaut.** Dockerfile und Compose sind fertig, auf der Entwicklungsmaschine stand aber kein Docker zur Verfügung. Build, Migrationen, Tests und der Produktionsserver (`next start`) liefen lokal. Beim ersten `docker compose up --build` bitte das Log prüfen.
- **Rate Limiting** übernimmt Better Auth für die Anmeldung (im Speicher, korrekt für einen App-Container).
- **Kein E-Mail-Versand.** Einladungs- und Passwort-Links werden kopiert und persönlich weitergegeben.
- **Text-to-Speech** ist nicht eingebaut. Die Audiofunktion nutzt echte Aufnahmen (Upload oder Aufnahme am Handy). Ein Lautsprecher-Symbol erscheint nur, wenn eine Aufnahme existiert.
- **KI** wurde gegen die Schnittstelle implementiert, aber ohne echten Anbieter getestet. Ohne Konfiguration ist sie unsichtbar.
- **Offline:** Der Service Worker liefert Static-Assets und eine Offline-Seite. Abstimmen offline ist nicht vorgesehen.
