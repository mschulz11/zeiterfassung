# Zeiterfassung

Mobile-first PWA für persönliche Zeiterfassung — portabler Nachfolger deines Excel-Sheets.

## Was ist drin (Iteration 1)

- Woche Mo–Fr mit navigierbaren Wochen (vor/zurück/heute)
- Pro Tag beliebig viele Zeitblöcke (Defaults anwendbar)
- Tages-Status: geplant / eingetragen / halbtags / krank / Urlaub / frei / manuel
- Farbcodierung passend zu deinem Excel-Sheet
- "geplant → ✓-Button" um Block als real zu markieren
- Wochen-Ist / Wochen-Soll / Δ Anzeige
- Überstundensaldo in der Header-Leiste (Editieren in Settings kommt)
- Settings-Screen für Sprache (DE/EN) und Tages-Soll
- IndexedDB lokal (Dexie) — funktioniert offline
- PWA: installierbar auf iOS/Android, Service Worker cached alles
- i18n: Deutsch & Englisch (umschaltbar, persistent in localStorage)

## Was noch fehlt (Iteration 2+)

- OneDrive / WebDAV-Sync
- Excel-Import für 2026
- Überstunden-Logik ("Neuzählen"-Toggle pro Woche, Saldo wird hochgezählt)
- Statistik / Charts (Monatssummen, Überstunden-Verlauf, Krank-/Urlaubstage)
- Export als CSV / Excel / PDF
- Settings: WebDAV-URL, User, Passwort UI (Felder schon da, Sync-Logik offen)

## Tech-Stack

- Vite 8 + React 19 + TypeScript
- Tailwind CSS 3 (Mobile-First)
- Dexie.js 4 + dexie-react-hooks (IndexedDB + Reactive Query)
- React Router v7
- i18next + react-i18next
- date-fns (de, enUS locales)
- vite-plugin-pwa (Workbox Service Worker)
- xlsx (für späteren Excel-Import)

## Lokal starten

### Variante 1: direkt mit Node (>= 22)

```bash
npm install
npm run dev          # Dev-Server auf http://localhost:5173
npm run build        # Production-Build nach dist/
npm run preview      # Build lokal serven
```

### Variante 2: Docker (kein Node nötig)

**Production** (statischer nginx-Container, fertig zum Deploy):

```bash
docker compose up -d --build
# → http://localhost:8080
```

Stoppen & entfernen:
```bash
docker compose down
```

**Development** mit Live-Reload – Code in WSL/Windows bearbeiten,
Vite rendert im Container neu:

```bash
docker compose --profile dev up zeiterfassung-dev
# → http://localhost:5173
```

Nur das Production-Image bauen (ohne `docker compose`):
```bash
docker build --target prod -t zeiterfassung:latest .
docker run --rm -p 8080:80 zeiterfassung:latest
```

#### Was das Dockerfile macht

- **Stage `dev`** – Node-22-Container mit installierten Deps, Vite dev server
- **Stage `build`** – baut die App (`npm run build` → `dist/`)
- **Stage `prod`** – nginx:alpine, legt `dist/` nach `/usr/share/nginx/html`,
  mit SPA-Fallback, Cache-Strategien für Service Worker und gehashte Assets,
  Security-Header

Die Compose-Volumes im Dev-Modus mounten den Source-Code read-write, aber
`node_modules` bleiben im Container (Windows-Mount ist mit Linux nicht
kompatibel und würde sonst die Deps zerschießen).

## Installation auf dem Handy

1. App deployen (z.B. Vercel, Netlify, eigener Webspace — siehe unten)
2. URL im Mobile-Browser öffnen (Safari iOS / Chrome Android)
3. "Zum Startbildschirm hinzufügen" / "Install" — danach startet die App als Vollbild-PWA

## Deployment-Hinweise

Statisches Hosting reicht. Empfehlung:
- **Vercel** (kostenlos, auto-Deploy bei Git-Push)
- **Netlify** (ebenso kostenlos)
- **Eigener Webspace** (Hetzner, All-Inkl, etc.) — `dist/` einfach hochladen

Wichtig: der WebDAV-Sync wird direkt aus dem Browser gegen OneDrive sprechen. Dafür brauchen wir entweder CORS-fähigen OneDrive-Zugriff oder einen kleinen Relay-Endpoint. Iteration 2 klärt das.

## Projektstruktur

```
src/
├── App.tsx                 # Routes
├── main.tsx                # Bootstrap (BrowserRouter)
├── styles.css              # Tailwind directives + components
├── components/
│   ├── BottomNav.tsx
│   ├── DayCard.tsx         # Tages-Ansicht mit Blöcken
│   ├── EntryForm.tsx       # neuer Block hinzufügen
│   ├── StatusBadge.tsx
│   ├── StatusPicker.tsx
│   └── WeekView.tsx        # Wochen-Liste
├── pages/
│   ├── HomePage.tsx
│   ├── SettingsPage.tsx
│   └── StatsPage.tsx
├── db/
│   ├── database.ts         # Dexie-Schema + ensureSettings
│   └── types.ts
├── i18n/
│   ├── index.ts            # i18next init, setLanguage()
│   ├── de.json
│   └── en.json
└── lib/
    ├── dates.ts            # Wochen-/Datumshelper
    └── format.ts           # HH:MM <-> Minuten
```

## Datenmodell

**Entries** (Tabelle)
```
{
  id, date (YYYY-MM-DD), order, fromTime, toTime,
  breakMinutes, status, note?, updatedAt
}
```

**Settings** (Single Row, id='app')
```
{
  language, dayTargets { Mon..Sun },
  overtimeBalanceMinutes,
  webdav { url, username, password, enabled, lastSyncAt, ... }
}
```

**Weeks** (Tabelle) — für Neuzählen-Logik
```
{ iso, countedForOvertime: 'yes' | 'no' | null, appliedAt }
```

## Nächste Schritte

1. **Excel-Migration bauen** — wir parsen dein Excel-File und erzeugen ein JSON, das die App importiert (Iteration 2)
2. **WebDAV-Sync** — OneDrive-Anbindung. Vorschlag: zuerst mit einer simplen `Basic`-Auth-Variante testen, dann OAuth-Layer draufsetzen wenn OneDrive das nicht nativ unterstützt
3. **Neuzählen-Logik** — pro Woche ein Toggle; wenn "Ja", wird Differenz der Vorwoche zum Überstundensaldo addiert
4. **UI-Politur** — Tags-Defaults als Settings, Vorlagen pro Wochentag editierbar
5. **Statistik** — Chart.js oder Recharts für Monatsansicht, Urlaubstage-Zähler, Krankheitsquote

Magst du die Iteration 1 anschauen (ich schicke dir den Code als ZIP unten) und mir sagen was du anders haben willst? Insbesondere: klappt die Wochen-Navigation, ist die Status-Auswahl am Handy bedienbar, soll noch was an die UI?
