# Zeiterfassung — Redesign Spec

**Datum:** 2026-07-06
**Status:** Draft (pending spec review and user approval)
**Iteration:** 2 (Layout + Datenmodell + Dark Mode)

## 1. Kontext & Ziel

Die PWA ist Iter. 1 lauffähig (`npm run dev` auf http://localhost:5173), aber:

- **Layout ist excel-nah** (Tages-Tabellen-Zellen-Stil) und nicht mobiloptimiert
- **Erfassung erfordert zu viele Klicks** (Block hinzufügen → Modal → Von/Bis/Pause/Status einzeln)
- **Tages-Zuordnung im Stream ist um einen Tag versetzt** (Timezone-Bug: `toISOString().slice(0,10)` vs. lokales Render)
- **Status-Logik pro Eintrag** überfrachtet das UI, ohne Mehrwert
- **Pause wird explizit erfasst**, obwohl sie sich natürlich aus Block-Lücken ergibt
- **Optik monochrom hell**, kein Dark Mode

Ziel dieser Iteration: vom Excel-Look weg zu einem **„Heute-oben-Stream"**-Layout, **Inline-Edit** auf der Heute-Card, **weniger Konzept-Last** (Status nur pro Tag, Pause implizit), **dunkles Design** optional zuschaltbar, Timezone-Bug behoben.

## 2. Nicht-Ziele (Out of Scope)

- OneDrive/WebDAV-Sync (Iter. 3)
- Excel-Import für 2026 (Iter. 3)
- Überstunden-Berechnung („Neuzählen"-Toggle) (Iter. 4)
- Statistik/Charts (Iter. 5+)
- Export (CSV/Excel/PDF) (Iter. 5+)
- Zukunftsplanung (Tage in der Zukunft eintragen) — wird weggelassen, alte Planung wurde aussortiert
- Tags/Mehrere Einträge mit unterschiedlichem Status pro Tag — Status ist rein tag-basiert
- **Cross-Midnight-Spans**: Ein Block pro Datum, keine Spätschicht-/Nachtschicht-Einträge (siehe §4.5)
- **Multi-Tab-Sync**: Iter. 2 ist single-tab. Zwei offene Tabs ignorieren sich gegenseitig. Cross-Tab-Broadcast kommt mit Iter. 3 (WebDAV-Sync) sowieso dazu.

## 3. Layout & Navigation

### 3.1 Home-Page

```
┌──────────────────────────────────────────┐
│ ZEITERFASSUNG         ☀/🌙   Saldo: +2:34 │
├──────────────────────────────────────────┤
│ (stream = scrollbar)                     │
│                                          │
│ HEUTE · Mo 06. Jul          [gearbeitet] │
│  08:00 – 12:30              [Status ▼]   │
│  13:00 – 17:00                            │
│  ─────────────────                        │
│  Pause: 00:30                             │
│  Ist 08:00 · Soll 08:00 · Δ 0:00          │
│  [+ Block]                  [✓ Eintragen] │
│                                          │
│ ────────────                              │
│ So 05. Jul · geplant        [eintragen ▼]│
│ Sa 04. Jul · geplant        [eintragen ▼]│
│ Fr 03. Jul · eingetragen …  [▼]          │
│ ...                                      │
│                                          │
│ [ältere Tage laden]                      │
└──────────────────────────────────────────┘
```

- **Heute-Card**: voll expandiert, editierbar. Status-Pill oben rechts, Block-Liste mittig, Footer mit Summen + Buttons.
- **Vergangene Tage**: zugeklappt. Eine Zeile pro Tag (Wochentag + Datum + Status-Badge + Status-Aktion + Toggle-Pfeil). Tap = aufklappen.
- **Sa/So**: ausgeblendet wenn Tages-Soll = 0. Klick auf „+ Wochenende anzeigen" am Listenende holt sie optional rein (toggle).
- **„ältere Tage laden"**: paginiert die Lookback-Range nach hinten (eine zusätzliche Periode).

### 3.2 Bottom-Nav

Unverändert: `Home / Stats / Settings`.

### 3.3 Header

- Logo-Text links
- Theme-Switch-Icon (3-state-Cycle: light → dark → auto) oder einfacher Toggle in Settings — **Entscheidung: in Settings lassen**, Header zeigt nur Logo + Saldo
- Saldo rechts (`overtimeBalanceMinutes`, Minutes → HH:MM, gerundet; rot wenn negativ)

## 4. Datenmodell

### 4.1 Entries — schlanker

```ts
interface Entry {
  id?: number;
  date: string;        // YYYY-MM-DD, lokal gerendert (format(d, 'yyyy-MM-dd'))
  order: number;       // Reihenfolge der Blöcke am Tag (0, 1, 2, …)
  fromTime: string;    // HH:MM
  toTime: string;      // HH:MM
  updatedAt: number;
}
```

**Entfernt:** `status` (war pro Eintrag), `breakMinutes` (jetzt implizit aus Lücke), `note?` (kommt evtl. wieder, erstmal raus — YAGNI). Diese Felder sind weder in der Type-Definition noch im Dexie-Schema-Index. Legacy-Daten mit diesen Feldern werden ignoriert.

### 4.2 Day-Status

```ts
type DayStatus = 'planned' | 'worked' | 'halfday' | 'free' | 'vacation' | 'sick';

interface DayState {
  date: string;          // YYYY-MM-DD (eindeutiger Key)
  status: DayStatus;
  updatedAt: number;
}
```

Eigene Dexie-Tabelle `dayState` mit Key `date` (unique). Wird live über `useLiveQuery` gelesen.

Status-Semantik:
- `planned` (default für Tage mit Default-Blöcken): Tag existiert, hat Default-Blöcke, zählt NICHT in Ist/Gesamt
- `worked`: promoted, zählt in Ist/Gesamt
- `halfday`: Soll wird auf 4h (240 Min) reduziert, Einträge zählen normal
- `free | vacation | sick`: kein Soll, kein Ist (Soll wird als 0 behandelt)
- Status `gepl.` und `manuel` aus altem Datenmodell → **explizit migriert** in DayState. Mapping:
  - Legacy entry-`status === 'manuel'` oder `'entered'` → DayState mit `status: 'worked'` für dieses Datum
  - Legacy entry-`status === 'gepl.'` → DayState mit `status: 'planned'` (oder kein DayState, weil Default)
  - Legacy entry-`status === 'halfday'` → DayState mit `status: 'halfday'`
  - Legacy entry-`status === 'sick'` / `'vacation'` / `'free'` → DayState mit `status: ...` ensprechend
  - Pro Datum gilt der **specific-status** (sick/vacation/free/halfday) wenn vorhanden, sonst `manuel`/`entered` → `worked`, sonst `planned`. Implementation-Detail der `version(2)`-Upgrade-Migration (siehe §10).

### 4.3 Settings

```ts
interface AppSettings {
  id: 'app';
  language: 'de' | 'en';
  theme: 'auto' | 'light' | 'dark';
  lookbackDays: 7 | 14 | 30;
  dayTargets: { Mon: number; Tue: number; Wed: number; Thu: number; Fri: number; Sat: number; Sun: number; };
  defaultBlocks: {
    Mon: Array<{ from: string; to: string }>;
    Tue: ...; Wed: ...; Thu: ...;
    Fri: Array<{ from: '08:00'; to: '14:00' }>;
    Sat: [];
    Sun: [];
  };
  showWeekend: boolean;
  overtimeBalanceMinutes: number;
  webdav: WebDavConfig;   // bleibt strukturell
}
```

**Defaults beim ersten Start** (für einen typischen User aus dem Excel):
- Mo–Do: 2 Blöcke (`08:00–12:30`, `13:00–17:00`), Soll 480 Min
- Fr: 1 Block (`08:00–14:00`), Soll 360 Min
- Sa/So: leer, Soll 0, ausgeblendet
- Lookback 14
- Theme auto
- Language `de`

### 4.4 Pause-Implizit

Pause wird **berechnet** aus der Lücke zwischen aufeinanderfolgenden Einträgen desselben Tages (sortiert nach `order`). Ist die Differenz ≥ 1 Min, gilt sie als Pause (z.B. Mittagspause 00:30). Bei nur 1 Eintrag = 0 Pause.

Library-Helper:
```ts
function computeBreakMinutes(entries: Entry[]): number {
  const sorted = [...entries].sort((a, b) => a.order - b.order);
  let pause = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = hhmmToMinutes(sorted[i-1].toTime);
    const currStart = hhmmToMinutes(sorted[i].fromTime);
    const gap = currStart - prevEnd;
    // Negative Gaps (Tipper, sortierreihenfolge quirk) werden als 0 behandelt.
    pause += Math.max(0, gap);
  }
  return pause;
}

// Plus Schutz für Tippfehler pro Block (fromTime > toTime):
function blockMinutes(e: Entry): number {
  return Math.max(0, hhmmToMinutes(e.toTime) - hhmmToMinutes(e.fromTime));
}
```

### 4.5 Keine Mitternachts-Spans

Spätschicht-/Nachtschicht-Einträge (`fromTime > 16:00` und `toTime < 08:00` am Folgetag) werden in Iter. 2 **nicht unterstützt**. Ein Block gilt als auf ein Datum bezogen, ohne cross-midnight-Logik. Wenn `fromTime ≥ toTime` am selben Tag, liefert `blockMinutes` 0 (UI zeigt dies als „leerer Block“ an; User kann korrigieren). Spätere Iterationen können einen optionalen `crossesMidnight`-Flag auf Entry nachziehen.

## 5. Komponenten

### 5.1 `DayCard` — expandierte Tag-Karte

Eine Komponente, zwei Varianten via Prop `variant: 'today' | 'past'`. Layout-Inhalt identisch, Footer-Buttons unterscheiden sich:

- **`variant: 'today'`**: Heute-Card im Stream oben. Zeigt zusätzlich `✓ Eintragen` (promotion `planned → worked`) und großen Add-Block-Button.
- **`variant: 'past'`**: Vergangene Tage. Kein „Eintragen"-Button. Status weiterhin änderbar.
- Beide Varianten teilen sich: Status-Pill (Inline-Menü), Block-Liste (inline editierbar), Pause/Ist/Soll/Δ-Footer.

Props:
- `date`, `entries` (sortiert), `status`, `targetMinutes`, `language`, `variant`, `onChange`

Inhalt von oben nach unten:
1. Header: „HEUTE · `formatDateLong(date, lang)`"
2. Status-Pill (rechts): Tap öffnet Inline-Menü (gearbeitet / halbtags / frei / urlaub / krank)
3. Block-Liste:
   - Pro Block: `fromTime – toTime` mit Tappable-Inputs (`<input type="time">`)
   - Rechts daneben: `×` zum Löschen
   - Untereinander, mit etwas Abstand
4. Trennlinie + Footer:
   - `Pause: HH:MM` (computed)
   - `Ist HH:MM · Soll HH:MM · Δ HH:MM`
5. Buttons:
   - `+ Block` (links, secondary)
   - `✓ Eintragen` (rechts, primary; promoted `planned → worked`)

### 5.2 `DayListItem` (zugeklappt)

Eine Zeile pro Tag, tappbar. Inhalt:
- Wochentag-Kürzel (Mo/Di/…)
- Datum (kurz, lokalisiert)
- Status-Badge
- Pfeil-Chevron `▼`

### 5.3 `StatusMenu` (Inline Popover)

Beim Tap auf Status-Pill, eine kleine Auswahl:
- gearbeitet (= `worked` intern)
- halbtags
- frei
- urlaub
- krank

Tap einer Option = Tag-Status gesetzt, Menü schließt. Bei `free | vacation | sick` wird Inhalt der Block-Liste ausgegraut, Block-Inputs disabled.

## 6. Datenfluss

1. Beim App-Start: `db.settings.get('app')` lädt Settings; Defaults werden geschrieben falls leer
2. Auf Home-Page: `useLiveQuery` auf `db.entries.where('date')` im Lookback-Range (heute minus `lookbackDays`, Obergrenze heute) **plus Filter `date <= today`** (keine Zukunftstage, siehe §12 Beobachtung), `db.dayState.where('date')` im selber Range
3. Pro Tag wird im Client aggregiert:
   - `entries` (sortiert nach `order`)
   - `status` (aus DayState, fallback `planned`)
   - `targetMinutes` (aus Settings → `dayTargets[wday]`)
   - `actualMinutes`, `breakMinutes` (computed)
4. **Default-Seeding**: Bei der ersten Anzeige einer DayCard (für heute oder eine Vergangen-Card), wenn `entries.length === 0` und keine `DayState`-Row mit `status ∈ {free,vacation,sick,halfday}` existiert, werden die `defaultBlocks[wday]` als Entries persistiert. DayState bleibt `planned` (oder wird neu angelegt als `planned`). Seeding einmalig pro Datum (Idempotenz: vor Insert prüfen).
5. **Inline-Edit-Policy**: Bei jedem `<input type="time">` wird **nur das `change`-Event** ausgewertet (dieses feuert beim Spin-UI auf Commit, also wenn der User eine Zeit final setzt). Beim `input`-Event während des Tippens wird NICHT persistiert. So werden native Picker-Interaktionen effizient gehandhabt. Pro UI gibt es keine 500 ms-Debounce.
6. **Auto-Promotion-Regel**: Sobald `entries.length > 0` und der User irgendwo editiert (Datum hat jetzt einen echten Eintrag), ohne explizit auf `✓ Eintragen` zu tippen → DayState wird bei nächstem Edit in `worked` überführt, **wenn der aktuelle Status `planned` ist**. Damit fällt der User nicht in die „Ist = 0, obwohl ich was eingetragen habe"-Falle (siehe §12). Diese Regel wird in der Speicher-Pipeline angewendet (nicht in der UI), damit sie auch bei „+ Block" wirkt.
7. Status-Wechsel: `db.dayState.put({date, status, updatedAt})`
8. „✓ Eintragen"-Button: erzwingt `DayState.status = 'worked'` (auch wenn schon anders).

## 7. Interaktionen im Detail

### 7.1 Inline Edit

```tsx
<input
  type="time"
  value={entry.fromTime}
  onChange={(e) => updateFromTime(entry.id!, e.target.value)}   // fires on commit (spinner/dialog commit)
  className="font-mono"
/>
```

`updateFromTime` ruft die Persist-Pipeline (§6 Schritt 5–6): validiert, speichert, triggert ggf. Auto-Promotion. **Kein Debounce**, kein `onBlur`. Native `<input type="time">`-Picker emittieren `input` *und* `change` — wir nutzen `onChange`, das dem User-Commit-Event entspricht. Bei leerem Input: revert auf letzten Wert.

### 7.2 Block hinzufügen

`+ Block` fügt einen neuen Eintrag ans Ende der Liste ein:
- `fromTime` = `toTime` des letzten Blocks
- `toTime` = `fromTime + 60 Min` (Default)
- `order` = `entries.length`
- Sofortiges `db.entries.add(...)` → Live-Update

### 7.3 Block löschen

`×`-Tap = `db.entries.delete(id)`. Kein Confirm-Dialog (zu viel Reibung), aber Undo-Möglichkeit durch Status-Pill-Revert auf `planned` falls versehentlich.

### 7.4 Block-Reihenfolge ändern

Nicht in dieser Iteration — Annahme: Reihenfolge ist Reihenfolge der Eintragung. Falls nötig, in Iter. 3 nachziehen.

## 8. Dark Mode

### 8.1 Theme-Strategie

- `theme: 'auto' | 'light' | 'dark'` in Settings
- Tailwind `darkMode: 'class'` in `tailwind.config.js`
- Beim Boot: `document.documentElement.classList.toggle('dark', matchesTheme(theme))`
- Bei Theme-Wechsel in Settings → sofortige Anwendung (Live)
- Auto-Modus: `window.matchMedia('(prefers-color-scheme: dark)')` listener registriert sich beim Boot und folgt System-Einstellung

### 8.2 Design-Tokens (CSS-Variablen in `styles.css`)

```css
:root {
  --bg-page: #f8fafc;        /* slate-50 */
  --bg-card: #ffffff;
  --text-primary: #0f172a;   /* slate-900 */
  --text-muted: #64748b;     /* slate-500 */
  --border: #e2e8f0;         /* slate-200 */

  --status-planned: #facc15;
  --status-worked: #ffffff;
  --status-halfday: #fde68a;
  --status-free: #e5e7eb;
  --status-vacation: #93c5fd;
  --status-sick: #fca5a5;
}

.dark {
  --bg-page: #0f172a;
  --bg-card: #1e293b;
  --text-primary: #f1f5f9;
  --text-muted: #94a3b8;
  --border: #334155;

  --status-planned: #ca8a04;     /* dunkler, weniger knallig */
  --status-worked: #1e293b;      /* = card-bg, wirkt als „neutral" */
  --status-halfday: #a16207;
  --status-free: #475569;
  --status-vacation: #1d4ed8;
  --status-sick: #b91c1c;
}
```

In Components: `bg-[var(--bg-card)]` oder Tailwind-Klassen, die die Variablen lesen (`bg-white dark:bg-slate-800`). Pragmatisch: Variable **und** Tailwind-Utilities parallel.

### 8.3 Settings-UI

Neue Card in Settings:
- Heading: „Theme"
- Drei Buttons (Segmented Control): Auto / Hell / Dunkel
- Aktive Option hervorgehoben

## 9. Settings-Page erweitern

Neue Sektionen (oben nach bestehenden):

1. **Theme** (siehe 8.3)
2. **Lookback**: 7 / 14 / 30 Tage
3. **Wochenende**: Show/Hide Toggle
4. **Default-Blöcke**: Tabelle pro Wochentag, je Block `Von – Bis` (editierbar); + / − Buttons für Blöcke
5. Tages-Soll (bestehend)
6. Sprache (bestehend)
7. WebDAV-Config (bestehend, weiterhin tot — UI schon da, Sync kommt Iter. 3)

## 10. Migration aus Iter. 1

Auf bestehender Codebase:
- `db.version(2).stores({ entries: '++id, date, updatedAt', dayState: '&date, status', settings: 'id' }).upgrade(async tx => { … })`
- **Entry-Tabelle-Index** reduziert auf `{id, date, updatedAt}` (ohne `status` — Status wird nicht mehr pro Eintrag abgefragt).
- **DayState-Tabelle** neu mit eindeutigem Schlüssel `&date`.
- **Settings-Schema-Keys** sind unverändert; neue Felder (`theme`, `lookbackDays`, `defaultBlocks`, `showWeekend`) bekommen Defaults bei `ensureSettings()` falls fehlend (defensiv, kein Backfill nötig).
- **Legacy-DayState-Derivation** in der Upgrade-Migration (Pseudo-Code) — Priority §4.2 folgt „specific-status schlägt worked schlägt planned":

```ts
const RANK: Record<DayStatus, number> = {
  sick: 6, vacation: 6, free: 5, halfday: 4, worked: 3, planned: 1,
};

await db.version(2).upgrade(async (tx) => {
  const legacyEntries = await tx.table('entries').toArray();
  // Für jedes Datum merken wir uns den höchstrangigen Status.
  const best = new Map<string, { status: DayStatus; rank: number }>();
  for (const e of legacyEntries) {
    let mapped: DayStatus = 'planned';
    switch (e.status) {
      case 'manuel':
      case 'entered':  mapped = 'worked'; break;
      case 'halfday':  mapped = 'halfday'; break;
      case 'sick':     mapped = 'sick'; break;
      case 'vacation': mapped = 'vacation'; break;
      case 'free':     mapped = 'free'; break;
      case 'planned':  mapped = 'planned'; break;
      default:         mapped = 'planned';
    }
    const rank = RANK[mapped];
    const current = best.get(e.date);
    if (!current || current.rank < rank) {
      best.set(e.date, { status: mapped, rank });
    }
  }
  const dayStates: DayState[] = [];
  for (const [date, { status }] of best) {
    dayStates.push({ date, status, updatedAt: Date.now() });
  }
  if (dayStates.length > 0) await tx.table('dayState').bulkPut(dayStates);
});
```

- **Timezone-Bug-Fix**: NICHT der `dates.ts`-Helper (der ist schon korrekt mit `format(d, 'yyyy-MM-dd')`). Die Übeltäter sind Aufruf-Sites — konkret `src/components/WeekView.tsx` (wird im Refactor sowieso gelöscht) und ggf. `src/pages/HomePage.tsx` (zu prüfen). Audit per `grep -rn "toISOString().slice(0,10)" src/` vor Implementations-Start. Plus DST-Hinweis: `today()` und Lookback-Range-Endpoints (das `bis`-Datum der Query) müssen ebenfalls den `format`-basierten Pfad nehmen, nicht `toISOString`. HH:MM-only Entries sind DST-safe (zeitzonenunabhängig) per Definition.

Refactor-Plan:
- Neue Datei `src/components/DayCard.tsx` (mit `variant`-Prop, siehe §5.1)
- Neue Datei `src/components/DayListItem.tsx`
- Neue Datei `src/components/StatusMenu.tsx`
- Neue Datei `src/lib/theme.ts` (Theme-Management)
- `src/pages/HomePage.tsx` neu: statt `WeekView` jetzt Stream-Layout
- `src/components/WeekView.tsx`, `src/components/DayCard.tsx` (alter File, alter Inhalt), `src/components/EntryForm.tsx` → **gelöscht**. Achtung: Naming-Kollision — alter DayCard.tsx (mit Excel-Tabellen-Stil) löschen, neue Komponente heißt auch `DayCard.tsx`, das ist ein sauberer Cut ohne Altlasten.
- `src/styles.css` → Token-Variablen ergänzt
- `src/lib/dates.ts` → unverändert; Bug-Fix liegt in den Aufruf-Sites.
- `tailwind.config.js` → `darkMode: 'class'` setzen.

## 11. Definition of Done

**Funktional:**
- [ ] Timezone-Bug behoben: Tag-Datum passt zum Wochentag-Label (Audit: `grep -L "toISOString().slice(0,10)" src/`)
- [ ] Heute-Card voll editierbar ohne Modal
- [ ] Inline-Edit der Zeit-Felder mit `change`-Event-Auto-Save (kein Debounce, kein onBlur)
- [ ] Block hinzufügen / löschen per Klick
- [ ] Pause erscheint korrekt aus Lücke zwischen Blöcken (inkl. Schutz bei `fromTime > toTime`)
- [ ] Status nur pro Tag, 5 Optionen (gearbeitet / halbtags / frei / urlaub / krank)
- [ ] Auto-Promotion: echte Edits ohne „✓ Eintragen"-Klick befördern `planned → worked`
- [ ] ✓ Eintragen-Button erzwingt `worked` (auch wenn Status abweicht)
- [ ] Lookback-Range konfigurierbar (7/14/30)
- [ ] Sa/So ausblendbar; „+ Wochenende anzeigen" holt sie; bei Soll=0 keine Default-Blocks
- [ ] Default-Seeding einmalig pro Datum (idempotent)
- [ ] „ältere Tage laden" paginiert weiter zurück
- [ ] `date ≤ today`-Filter in Query (keine Zukunftstage im Stream)
- [ ] Kein Cross-Midnight-Eintrag; UI akzeptiert nicht `fromTime ≥ toTime` (zeigt 0 Min und revert)

**Theme:**
- [ ] Dark Mode: Auto / Light / Dark in Settings; sofortige Anwendung; CSS-Variablen für Tokens
- [ ] `tailwind.config.js` hat `darkMode: 'class'`
- [ ] WCAG-Kontrast-Check: Statusbadges erfüllen mindestens 3:1 (UI), Body 4.5:1 — manuelle Augenprobe + optional Browser-Devtools

**Migration:**
- [ ] Dexie Schema v2 Upgrade migriert legacy `entry.status` per Datum zu `DayState.status` (siehe §10 Pseudo-Code). Test: lege in v1-DB Test-Daten mit `manuel`, `gepl.`, `sick`, `vacation`, `halfday` an, öffne App, prüfe DayState-Tabelle
- [ ] Kein Verlust alter Entry-Daten
- [ ] Legacy-Defaults werden zu `defaultBlocks` migriert, falls welche in Hardcode gefunden (Hardcode liegt in Iter. 1 `WeekView.tsx` `applyDefaults` — diese Mapping-Tabelle übernehmen)

**Build + Verify:**
- [ ] Build clean (`npm run build`)
- [ ] PWA installierbar (manifest + sw unverändert)
- [ ] Settings-Page funktional für alle neuen Felder (Theme, Lookback, Defaults, ShowWeekend, Tages-Soll, Sprache, WebDAV-Config)
- [ ] i18n: DE + EN, alle neuen Strings lokalisiert
- [ ] Manual-Test: App lädt, Defaults seeding, Eintragen ohne ✓ funktioniert (Auto-Promotion), Status-Wechsel persistiert, Theme-Switch in allen drei Modi, Sa/So-Toggle wirkt, Lookback-Wechsel zeigt korrekte Range
- [ ] Single-Tab-Bestätigung: App verhält sich korrekt mit genau einer offenen Browser-Tab; bei zwei offenen Tabs kein Crash, aber ggf. stale Reads akzeptabel (out of scope)

## 12. Risiken & Edge-Cases

- **Lücken > 4h**: was, wenn jemand 12:00 Pause macht und 16:00 weiterarbeitet? Compute-mäßig zählt's als 04:00 Pause. Akzeptabel für Iter. 2, dokumentieren in Kommentar.
- **Auto-Promotion-Falle (§6 Schritt 6)**: ohne explizites „✓ Eintragen" werden Tage mit echten Einträgen automatisch `worked`. User-Workflow ist dadurch: tippen, fertig — kein Risiko von „Ist = 0 obwohl ich was eingetragen habe“ (siehe Reviewer-Issue #5). Test-Check: `npm run dev`, „Defaults anwenden", Zeit editieren ohne auf ✓ zu drücken → Saldo/Ist steigt.
- **Backwards-Compat für `entry.status`**: alte Daten haben den Wert, neues Schema ignoriert. Falls jemand die App lange offline nutzt und die entries-Tabelle migriert wird, kein Verlust.
- **Dark-Mode + Statusfarben**: geplante Status (`status-planned`) ist auf dunklem Hintergrund schlecht kontrastiert — wird im Implementation-Pass ggf. neu kalibriert.
- **Auto-Theme + System-Update**: Browser emittiert `prefers-color-scheme`-Change-Event; Listener registriert sich beim Boot. Falls App im Hintergrund war, kommt das Event trotzdem an (Standard-Browser-Verhalten).
- **Lookback 30 Tage + Paginierung**: bei 30-Tage-Range und 12h am Tag in IndexedDB wird's nicht zu groß (< 1000 Einträge). Index auf `date` reicht.
- **Single-Tab Policy**: Iter. 2 ist single-tab. Zwei offene Tabs führen zu race conditions beim Schreiben desselben Datensatzes (last-write-wins still). `db.on('storagemutation')` Broadcast-Channel-Hook von Dexie wird in Iter. 3 (Sync) eingebaut, sobald wir eh Cross-Device-Invalidation brauchen. DoD-Hinweis: Build verifiziert, dass nur eine offene Browser-Tab typisch ist.
- **Dark Mode Kontrast (§8.2)**: Akzeptanzkriterium: WCAG AA (4.5:1 für Body, 3:1 für UI/Fett). Statusbadges sind UI-Components, also 3:1 als Minimum. Falls die vorgeschlagenen Werte nicht reichen, werden sie im Implementation-Pass pro Badge nachjustiert (siehe DoD §11).

## 13. Reihenfolge der Implementierung

1. Datenmodell (`types.ts`, `database.ts` v2 Migration mit Legacy-Derivation)
2. Theme-Tokens (`styles.css`, `tailwind.config.js darkMode: 'class'`, `lib/theme.ts`)
3. Timezone-Audit (`grep "toISOString().slice(0,10)" src/`) und Fix an Aufruf-Sites
4. `DayCard` (mit `variant`) + `StatusMenu` + `DayListItem`
5. `HomePage` neu strukturieren (Stream statt Wochenansicht, Lookback-Pagination, Show-Weekend-Toggle, `date ≤ today`-Filter)
6. Settings erweitern (Theme, Lookback, Default-Blocks-Editor, Wochenende-Toggle, alle Defaults gegen Defaults abgeglichen)
7. Alte WeekView/EntryForm löschen; alter DayCard.tsx entfernen, neuer DayCard.tsx rein
8. i18n-Strings nachziehen (DE + EN)
9. `npm run build` + TS-Check
10. Manuelle Tests laut DoD §11 (Defaults seeding, Auto-Promotion, Theme-Switch, Sa/So, Lookback, Timezone-Bug)

Geschätzt: ~2–3 Stunden aktive Tool-Aufwand (Settings-Editor + i18n + manuelle QA). Eine kompakte Iteration.
