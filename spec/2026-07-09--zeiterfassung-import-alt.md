# Zeiterfassung — Iteration 3: Statistik, Gesamtsaldo & Excel-Import

**Datum:** 2026-07-09
**Iteration:** 3

## 1. Kontext & Ziel

Der Nutzer möchte mehr Überblick über seine erfassten Zeiten und seinen Altbestand aus einer Excel-Datei importieren. Konkret:

- **Statistik-Seite**: Woche/Monat/Jahr navigierbar, mit Soll/Ist/Saldo und Tagesliste
- **Gesamtsaldo mit Neuzählen**: Kumulierter Saldo ab einem frei wählbaren Startdatum, direkt auf der HomePage sichtbar
- **Excel-Import**: Altdaten aus dem bestehenden Zeiterfassungs-Excel einlesen

## 2. Nicht-Ziele (Out of Scope)

- OneDrive/WebDAV-Sync (Iter. 4+)
- Export (CSV/Excel/PDF) (Iter. 4+)
- Cross-Midnight-Spans (kein Nacht-/Spätschichtbetrieb)
- Multi-Tab-Sync

## 3. Statistik-Seite

### 3.1 Aufbau

Die Statistik-Seite ist über die Bottom-Nav erreichbar. Sie ist in drei Bereiche gegliedert:

```
[ Woche | Monat | Jahr ]   ← Toggle-Tabs

[ < ]  KW 27 · 30.06–06.07.2026  [ > ]   ← Navigation vor/zurück

┌─────────────────────────────┐
│  Ist      Soll     Saldo    │
│  32:15    40:00    -7:45    │
└─────────────────────────────┘

Tagesliste (Mo–So dieser Woche):
  Mo 30.06   09:22  /  08:00  +1:22  ✔
  Di 01.07   07:37  /  08:00  -0:23  ✔
  ...
```

- **Toggle**: Woche / Monat / Jahr
- **Navigation**: Pfeile links/rechts wechseln zur vorherigen/nächsten Periode
- **Zusammenfassung**: Ist / Soll / Saldo für die gewählte Periode
- **Tagesliste**: Alle Tage der Periode mit Ist, Soll, Delta und Status-Badge

### 3.2 Berechnungsregeln

- Selbe Logik wie HomePage: `effectiveTargetMinutes`, `deltaMinutesForDay` etc. aus `lib/dayTotals`
- Tage ohne Eintrag und ohne Status werden nicht in die Saldo-Berechnung einbezogen (Zukunft)
- Wochenende ohne Status zählt als `free` (Soll = 0, Ist = 0, Delta = 0)

## 4. Gesamtsaldo & Neuzählen

### 4.1 Konzept

Neben dem Jahressaldo gibt es einen **Gesamtsaldo**, der von einem konfigurierbaren Startdatum bis heute aufaddiert wird. Dieses Startdatum heißt **Neuzählen-Datum**.

- Das Neuzählen-Datum wird in `AppSettings` gespeichert.
- Der Gesamtsaldo ist die Summe aller `deltaMinutesForDay` vom Neuzählen-Datum bis einschließlich heute.
- Das Jahressaldo bleibt davon unberührt (immer 01.01.–31.12. des aktuellen Jahres).

### 4.2 Anzeige auf der HomePage

Jede Tageszeile (zugeklappt) zeigt zusätzlich den **kumulierten Gesamtsaldo bis einschließlich diesem Tag** als kleines Label an.

Beispiel einer Tageszeile:
```
Mo 30.06  ✔  Ist: 09:22  Soll: 08:00  Δ+1:22  |  Gesamt: +3:45
```

### 4.3 Neuzählen setzen

- Beim Aufklappen eines Tages erscheint ein Button **„Ab hier neuzählen"**.
- Klick setzt das Neuzählen-Datum auf dieses Datum und schließt den Dialog.
- In der zugeklappten Tageszeile des Neuzählen-Tags erscheint ein kleines Markierungs-Icon (z.B. 🔄 oder ein Flag).
- Das Neuzählen-Datum kann auch in den Settings manuell als Datum eingegeben werden.

## 5. Datenmodell-Erweiterungen

### 5.1 AppSettings

```ts
interface AppSettings {
  // ... bestehende Felder ...
  balanceStartDate: string | null;  // YYYY-MM-DD, Neuzählen-Datum; null = kein Gesamtsaldo
}
```

### 5.2 DayStatus

```ts
type DayStatus = 'planned' | 'worked' | 'halfday' | 'free' | 'vacation' | 'sick' | 'imported';
```

- `imported`: Tag wurde via Excel-Import angelegt. Zählt in Ist und Gesamtsaldo. Wird in der Tagesliste mit einem Import-Badge gekennzeichnet.

## 6. Excel-Import

### 6.1 Excel-Format (Quelldatei)

Die Quelldatei ist jahresweise in Tabellenblättern aufgebaut (z.B. Tab „2026"). Jedes Tabellenblatt enthält Wochen-Blöcke:

| Spalte | Inhalt |
|--------|--------|
| B | Wochenanfangsdatum (z.B. „Mo, 29. Jun 2026") |
| D | Wochentag + Datum (z.B. „Montag\n29. Juni") |
| E | Von-Zeit (z.B. „07:45") |
| F | Bis-Zeit (z.B. „12:04") |
| G | Pause – wird **ignoriert** (bereits in Von/Bis eingerechnet) |
| K | Bemerkung / Status (z.B. „gepl.", „Urlaub", „krank", „Frei", „halbtags") |

Pro Tag gibt es typischerweise 2 Zeilen (Vormittag + Nachmittag = 2 Blöcke).

### 6.2 Status-Mapping

| Excel Bem. (K) | App-Status |
|----------------|------------|
| *(leer)*       | `imported` |
| `gepl.`        | `planned`  |
| `halbtags`     | `halfday`  |
| `Frei`         | `free`     |
| `Urlaub`       | `vacation` |
| `krank`        | `sick`     |
| `Manuel`       | wird ignoriert / Tag erhält `imported` |

### 6.3 Import-UI

- Die Import-Funktion ist auf einer eigenen **Import-Seite** erreichbar (Bottom-Nav).
- Der Nutzer wählt per **File-Picker** eine `.xlsx`-Datei aus.
- Nach der Auswahl analysiert die App die Datei und zeigt eine **Vorschau**:
  - Anzahl der Tage, die importiert werden
  - Anzahl der Tage, die bereits in der App vorhanden sind (Konflikte)
- Der Nutzer entscheidet global:
  - **„Vorhandene überschreiben"** – alle Tage werden importiert, bestehende Einträge ersetzt
  - **„Vorhandene behalten"** – nur neue Tage werden importiert, bestehende bleiben unberührt
- Nach dem Import erscheint eine Bestätigung: „X Tage importiert, Y Tage übersprungen."

### 6.4 Parsing-Logik

- Das Jahr wird aus dem Tab-Namen (z.B. „2026") ermittelt.
- Das Datum pro Zeile wird aus Spalte D geparst: Tagesname + Datum (z.B. „29. Juni") + Jahr aus Tab.
- Zeilen ohne Von- oder Bis-Zeit werden als Tageszeile ohne Block importiert (nur Status).
- Leere Zeilen und Summenzeilen (Neuzählen, Für die Firma) werden übersprungen.
- Alle importierten Tage erhalten `updatedAt = Date.now()`.

## 7. Definition of Done

- [ ] Statistik-Seite mit Toggle Woche/Monat/Jahr und Vor-/Zurück-Navigation
- [ ] Statistik zeigt Soll, Ist, Saldo pro Periode und Tagesliste
- [ ] Gesamtsaldo wird auf der HomePage je Tageszeile kumuliert angezeigt
- [ ] „Ab hier neuzählen"-Button in aufgeklapptem Tag setzt Neuzählen-Datum
- [ ] Neuzählen-Tag erhält visuelles Markierungs-Icon in der Tageszeile
- [ ] Neuzählen-Datum auch manuell in Settings eingebbar
- [ ] Jahressaldo bleibt vom Neuzählen unberührt
- [ ] Import-Seite mit File-Picker für `.xlsx`
- [ ] Vorschau vor dem Import: Anzahl Tage + Konflikte
- [ ] Globale Konfliktbehandlung: überschreiben oder behalten
- [ ] Status-Mapping aus Excel-Bem. funktioniert korrekt
- [ ] Importierte Tage haben Status `imported` und Import-Badge
- [ ] Bestätigungsmeldung nach Import
