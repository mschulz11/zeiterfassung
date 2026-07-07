# Zeiterfassung

Mobile-first PWA fuer persoenliche Zeiterfassung. Iteration 2 ersetzt den
Excel-nahen Wochenraster durch einen Heute-oben-Stream mit Inline-Bearbeitung,
lokaler IndexedDB-Persistenz und optionalem Dark Mode.

## Was ist drin (Iteration 2)

- Home-Stream: Heute ist oben voll ausgeklappt, vergangene Tage sind kompakte Zeilen
- Inline-Bearbeitung der Zeitbloecke direkt in der Tageskarte, kein Modal
- Zeitbloecke pro Tag: hinzufuegen, bearbeiten, loeschen
- Pause wird implizit aus Luecken zwischen Bloecken berechnet
- Tagesstatus statt Entry-Status: geplant, gearbeitet, halbtags, frei, Urlaub, krank
- Auto-Promotion: Editieren oder Block hinzufuegen setzt geplante Tage automatisch auf gearbeitet
- Lokale Datumsberechnung ohne `toISOString().slice(0, 10)`-Timezone-Bug
- Lookback 7 / 14 / 30 Tage plus "aeltere Tage laden"
- Wochenende optional einblendbar
- Default-Bloecke pro Wochentag in Settings editierbar
- Tages-Soll pro Wochentag in Settings editierbar
- Theme: Auto / Hell / Dunkel
- IndexedDB lokal via Dexie, offlinefaehig
- PWA: installierbar, Service Worker, Manifest
- i18n: Deutsch & Englisch
- Docker-Setup fuer Production-nginx und Dev-Container

## Was noch fehlt (Iteration 3+)

- OneDrive / WebDAV-Sync
- Excel-Import fuer 2026
- Ueberstunden-Logik mit "Neuzaehlen"-Toggle
- Statistik / Charts
- Export als CSV / Excel / PDF
- Cross-Tab-Sync
- Cross-Midnight-Zeitbloecke

## Tech-Stack

- Vite 8 + React 19 + TypeScript
- Tailwind CSS 3
- Dexie.js 4 + dexie-react-hooks
- React Router v7
- i18next + react-i18next
- date-fns
- vite-plugin-pwa / Workbox
- nginx fuer das Production-Image

## Lokal starten

### Direkt mit Node >= 22

```bash
npm install
npm run dev
npm run build
npm run preview
```

Dev-Server: <http://localhost:5173>

### Docker / WSL

Production-Container:

```bash
docker compose build
docker compose up -d
```

App: <http://localhost:8080>

Stoppen:

```bash
docker compose down
```

Dev-Container mit Vite Live-Reload:

```bash
docker compose --profile dev up --build zeiterfassung-dev
```

Dev-App: <http://localhost:5173>

Nur das Production-Image bauen:

```bash
docker build --target prod -t zeiterfassung:latest .
docker run --rm -p 8080:80 zeiterfassung:latest
```

### Docker-Aufbau

- `dev`: Node-22-Container, installiert Dependencies per `npm ci`, startet Vite
- `build`: installiert inklusive Dev-Dependencies, baut `dist/`
- `prod`: nginx:alpine, serviert `dist/` mit SPA-Fallback und PWA-gerechten Cache-Headern

Im Dev-Profil werden Source-Dateien gemountet, `node_modules` bleiben im Linux-Container.
Das vermeidet Windows/WSL-Inkompatibilitaeten bei nativen Dependencies.

## Datenmodell

### Entries

```ts
interface Entry {
  id?: number;
  date: string;      // YYYY-MM-DD lokal erzeugt
  order: number;
  fromTime: string;  // HH:MM
  toTime: string;    // HH:MM
  updatedAt: number;
}
```

### DayState

```ts
type DayStatus = 'planned' | 'worked' | 'halfday' | 'free' | 'vacation' | 'sick';

interface DayState {
  date: string;
  status: DayStatus;
  updatedAt: number;
}
```

### Settings

```ts
interface AppSettings {
  id: 'app';
  language: 'de' | 'en';
  theme: 'auto' | 'light' | 'dark';
  lookbackDays: 7 | 14 | 30;
  dayTargets: { Mon: number; Tue: number; Wed: number; Thu: number; Fri: number; Sat: number; Sun: number };
  defaultBlocks: Record<string, Array<{ from: string; to: string }>>;
  showWeekend: boolean;
  overtimeBalanceMinutes: number;
  webdav: WebDavConfig;
}
```

Legacy-Daten aus Iteration 1 werden ueber Dexie Schema v2 migriert: alte
Entry-Statuswerte werden pro Datum zu `DayState.status` verdichtet. Alte
Entry-Felder wie `breakMinutes`, `status` und `note` werden im neuen UI ignoriert.

## Projektstruktur

```text
src/
├── App.tsx
├── main.tsx
├── styles.css
├── components/
│   ├── BottomNav.tsx
│   ├── DayCard.tsx
│   ├── DayListItem.tsx
│   ├── StatusBadge.tsx
│   └── StatusMenu.tsx
├── pages/
│   ├── HomePage.tsx
│   ├── SettingsPage.tsx
│   └── StatsPage.tsx
├── db/
│   ├── database.ts
│   └── types.ts
├── i18n/
│   ├── index.ts
│   ├── de.json
│   └── en.json
└── lib/
    ├── dates.ts
    ├── format.ts
    └── theme.ts
```

## Bedienlogik

- Ein geplanter Tag zaehlt nicht ins Ist.
- `gearbeitet` zaehlt die Summe der Bloecke als Ist.
- `halbtags` reduziert das Soll auf 4 Stunden, Bloecke zaehlen normal.
- `frei`, `Urlaub` und `krank` setzen Soll und Ist auf 0.
- Bei `fromTime >= toTime` zaehlt der Block 0 Minuten und wird visuell markiert.
- Cross-Midnight-Bloecke sind bewusst noch nicht unterstuetzt.

## Deployment-Hinweise

Statisches Hosting reicht: `npm run build` erzeugt `dist/`. Fuer React-Router-Pfade
braucht der Webserver einen SPA-Fallback auf `index.html`. Die mitgelieferte
`nginx.conf` setzt diesen Fallback sowie passende Cache-Header fuer Service Worker,
Manifest, Workbox und gehashte Assets.

## Naechste Schritte

1. WebDAV/OneDrive-Sync mit Konfliktstrategie
2. Excel-Import fuer Bestandsdaten
3. Ueberstunden-Saldo und Wochen-Neuzaehlung
4. Statistiken und Monatsauswertung
5. Exportformate
