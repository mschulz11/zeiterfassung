# Zeiterfassung — Iteration 3: Statistik, Gesamtsaldo & Excel-Import

**Datum:** 2026-07-09
**Status:** Review zu Iteration 3 — Bugs dokumentiert, Nacharbeiten erforderlich
**Bezug:** `2026-07-09--zeiterfassung-import-alt.md`

---

## 1. Ergebnis der Review

| Feature | Status | Befund |
|---|---|---|
| BottomNav (4 Tabs) | OK | Home / Statistik / Import / Einstellungen korrekt |
| Neuzaehlen-Button in Tageskarte | OK | Button sichtbar und funktioniert |
| Statistik-Seite | FEHLER | Seite laedt nicht, friert App ein |
| Gesamtsaldo auf HomePage | KONZEPT ANPASSEN | Anzeige fehlt + neues "Zeit geschenkt"-Konto |
| Excel-Import | FEHLER | Parser findet keine Daten |

---

## 2. Bug: Statistik-Seite – React-Crash

**Symptom:** Aufruf von `/stats` fuehrt zu einem Blank-Screen. Alle anderen Seiten
(Home, Import, Settings) koennen danach ebenfalls nicht mehr angezeigt werden bis
zum naechsten Hard-Reload.

**Fehlermeldung aus dem Browser:**
```
Uncaught Error: Minified React error #310
    at useMemo (index-B0wQsxo5.js:1)
```

**Ursache:** In `StatsPage.tsx` wird `today = new Date()` direkt als Dependency im
`periodRange`-useMemo uebergeben. Da `new Date()` bei jedem Render ein neues Objekt
erzeugt, recomputed `periodRange` bei jedem Render → `periodRange.start` ist immer
ein neues `Date`-Objekt → `dayRows` recomputed bei jedem Render →
unendliche Render-Schleife in React 19 Concurrent Mode.

**Fix:** `new Date()` in den useMemo-Body verlagern (nicht als Dependency).

---

## 3. Bug: Excel-Import – Parser findet keine Daten

**Symptom:** Datei auswaehlen → Dateiname erscheint → Meldung "Keine Daten gefunden".

**Sonderfall:** Wenn die Datei noch in Excel geoeffnet ist, erscheint ein
Windows-Datei-Sperren-Dialog → erwartet, kein Code-Fix noetig; Hinweistext auf der
Seite ergaenzen.

**Ursache:** `XLSX.read()` wird mit `{ type: 'array' }` aufgerufen und erwartet ein
`Uint8Array`. `file.arrayBuffer()` liefert einen `ArrayBuffer` → Typ-Mismatch →
XLSX.js liest leer.

**Fix:**
```ts
// Vorher:
const workbook = XLSX.read(buffer, { type: 'array' });

// Nachher:
const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
```

---

## 4. Konzeptanpassung: Gesamtsaldo & "Zeit geschenkt"

### 4.1 Neues Datenfeld

```ts
interface AppSettings {
  balanceStartDate: string | null;  // bereits vorhanden
  balanceGiftMinutes: number;       // NEU: akkumuliertes "Zeit geschenkt"-Konto
}
```

### 4.2 Logik beim Neuzaehlen

Beim Klick auf "Ab hier neuzaehlen" wird der aktuelle Gesamtsaldo nicht verworfen,
sondern in `balanceGiftMinutes` akkumuliert:

```ts
async function setBalanceStart(date: string, currentGesamtsaldo: number) {
  await db.settings.update('app', {
    balanceStartDate: date,
    balanceGiftMinutes: (settings.balanceGiftMinutes ?? 0) + currentGesamtsaldo,
  });
}
```

**Beispielablauf:**
1. Gesamtsaldo = +02:00 → Neuzaehlen → `balanceGiftMinutes` = 02:00, Gesamtsaldo startet neu
2. 14 Tage spaeter: Gesamtsaldo = +01:23 → Neuzaehlen → `balanceGiftMinutes` = 03:23

### 4.3 Saldo-Uebersicht im Header (massgebliche Vorgabe)

Der sticky Header der HomePage zeigt eine kompakte Grid-Tabelle mit vier Zeilen
und den Spalten Ist / Soll / Delta (analog zur Excel-Darstellung):

```
             Ist      Soll      Delta
Jahr      153:39   152:00   +1:39   <- Jan-Dez des aktuellen Jahres
Periode    32:15    40:00    -7:45  <- aktuell angezeigte Tage (Lookback)
Gesamt     xx:xx    xx:xx   +x:xx   <- ab balanceStartDate bis heute
Geschenkt   9:47       -       -    <- balanceGiftMinutes (nur ein Wert)
```

- Delta-Spalte: rot wenn negativ, gruen/emerald wenn positiv
- "Geschenkt" hat nur einen Wert (kein Soll/Ist)
- Zeilen "Gesamt" und "Geschenkt" nur anzeigen wenn `balanceStartDate` gesetzt ist

---

## 5. Definition of Done fuer Nacharbeit

- [ ] `StatsPage.tsx`: `new Date()` aus useMemo-Deps entfernen → kein Crash mehr
- [ ] `AppSettings` + `database.ts`: Feld `balanceGiftMinutes: number` ergaenzen, Default 0, Migration
- [ ] `HomePage.tsx`: Neuzaehlen-Logik mit `balanceGiftMinutes`-Akkumulation
- [ ] `HomePage.tsx`: Header durch Saldo-Grid-Tabelle ersetzen (Abschnitt 4.3)
- [ ] `excelImport.ts`: `new Uint8Array(buffer)` statt `buffer` in `XLSX.read()`
- [ ] `ImportPage.tsx`: Hinweistext "Datei vor dem Import in Excel schliessen"