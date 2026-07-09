# Zeiterfassung — Iteration 3: Review 2

**Datum:** 2026-07-09
**Status:** Review 2 — Bugs dokumentiert, Konzeptaenderungen und neue Features spezifiziert
**Bezug:** `2026-07-09--zeiterfassung-import-alt.md`, `2026-07-09-zeiterfassung-import-alt-review.md`

---

## 1. Ergebnis Review 2

| Feature | Status | Befund |
|---|---|---|
| Statistik-Seite | OK | Crash behoben, Toggle + Navigation funktionieren |
| Excel-Import | FEHLER | Noch immer "Keine Daten gefunden" |
| Header-Grid (Saldo-Uebersicht) | KONZEPT ANPASSEN | Falsche Jahr-Werte, Layout-Aenderung gewuenscht |
| Neuzaehlen-Button | KONZEPT ANPASSEN | Timing und Speicherlogik fehlerhaft |
| Zeitfelder | ERWEITERUNG | "Jetzt"-Button gewuenscht |
| Statistik-Auswertung | ERWEITERUNG | Kuchendiagramm + Wochenende-Toggle gewuenscht |

---

## 2. Bug: Excel-Import noch immer keine Daten

Die erste Ursachenanalyse (Uint8Array-Fix) hat das Problem nicht vollstaendig geloest.
Der Import benoetigt vertiefte Fehleranalyse direkt an der echten Excel-Datei.

**Naechster Schritt:** Debug-Ausgabe im Parser einbauen (Konsolenlog der erkannten Sheets,
Zeilen und gefundenen Daten), um die tatsaechliche Ursache zu ermitteln.

---

## 3. Konzeptaenderung: Header-Grid Saldo-Uebersicht

### 3.1 Jahr-Soll-Berechnung

**Problem:** `Jahr Soll = 1088:00` weil alle Arbeitstage seit 01.01. mit je 8h Soll
gezaehlt werden — auch Tage ohne eingetragene Daten (Status Default-geplant).

**Gewuenschtes Verhalten:** Nur Tage mit explizitem Status (worked, imported, halfday,
vacation, sick) zaehlen in Soll und Ist. Tage mit Default-Status "geplant" und ohne
Eintraege zaehlen nicht.

**Betrifft:** Jahr-Zeile und analog auch die Gesamt-Zeile.

### 3.2 Layout-Aenderung

**Aktuell:** Periode / Jahr / Gesamt / Geschenkt

**Neu:**
```
             Ist      Soll      Delta
Geschenkt  xx:xx                      <- balanceGiftMinutes, nur Kontowert
Jahr       xx:xx    xx:xx    +/-xx:xx
Periode    xx:xx    xx:xx    +/-xx:xx
```

- "Gesamt"-Zeile entfaellt
- "Geschenkt" steht oben als kumulierter Kontowert (kein Soll/Ist)
- Reihenfolge: Geschenkt oben → Jahr → Periode unten

---

## 4. Konzeptaenderung: Neuzaehlen

### 4.1 Timing-Fehler

**Aktuell:** Beim Klick "Ab hier neuzaehlen" an Tag X wird der Gesamtsaldo bis HEUTE
zum Geschenkt-Konto addiert.

**Korrekte Logik:**
- Klick Neuzaehlen an Tag X →
  Geschenkt += Saldo(aktueller balanceStartDate bis X-1 einschliesslich)
- Neuer balanceStartDate = X (Saldo startet neu ab X)

**Beispiel:**
- balanceStartDate = 01.05, heute = 09.07
- Klick Neuzaehlen am 01.06 → Geschenkt += Saldo(01.05–31.05), balanceStartDate = 01.06
- Klick Neuzaehlen am 14.06 → Geschenkt += Saldo(01.06–13.06), balanceStartDate = 14.06

### 4.2 Neuzaehlen als persistentes Tages-Flag

Das Neuzaehlen-Datum muss dauerhaft gespeichert bleiben, damit:
- Der Marker auf der historischen Tageszeile sichtbar bleibt
- Zukuenftige Perioden-Abgrenzungen korrekt sind

**Loesungsvorschlag:** Liste `balanceStartDates: string[]` in AppSettings
(alle bisherigen Neuzaehlen-Daten, nicht nur das aktuellste).
Das letzte Element der Liste = aktueller balanceStartDate.

---

## 5. Erweiterung: "Jetzt"-Button in Zeitfeldern

In jedem Von/Bis-Zeitfeld soll ein kleiner Button erscheinen, der die aktuelle
Uhrzeit (HH:MM) direkt in das Feld eintraegt und committet.

**Platzierung:** Icon-Button (z.B. "⏱" oder Uhr-Symbol) direkt neben dem Eingabefeld
in `TimeInput.tsx`.

---

## 6. Erweiterung: Statistik-Seite

### 6.1 Wochenende ausblenden

In der Tagesliste der Statistik sollen Wochenend-Tage (Sa/So) standardmaessig
ausgeblendet sein. Ein Toggle ermoeglicht das Einblenden (analog zur HomePage).

### 6.2 Status-Kuchendiagramm

Zusaetzlich zur Ist/Soll/Saldo-Zusammenfassung soll ein Kuchendiagramm die
Verteilung der Tage nach Status im aktuellen Zeitraum zeigen.

**Interaktivitaet:**
- Checkboxen/Toggles je Status → nur ausgewaehlte Status erscheinen im Diagramm
- Standard: alle Status eingeblendet
- Legende mit Anzahl Tage pro Status

**Bibliothek:** Recharts (React-nativ, TypeScript-freundlich) — bei Implementierung
alternativ Chart.js / react-chartjs-2 pruefbar.

**Platzierung:** Unterhalb der Tagesliste, gleicher Zeitraum-Kontext.

---

## 7. Definition of Done fuer Nacharbeit

- [ ] Excel-Import: Debug-Analyse und tatsaechlichen Fehler beheben
- [ ] Jahr-Soll: Nur Tage mit explizitem Status zaehlen (nicht Default-geplant)
- [ ] Header: Layout auf Geschenkt / Jahr / Periode umstellen, Gesamt entfernen
- [ ] Neuzaehlen: Timing-Fix (Geschenkt bis X-1, nicht bis heute)
- [ ] Neuzaehlen: Als persistente Liste in AppSettings speichern
- [ ] TimeInput: "Jetzt"-Button fuer aktuelle Uhrzeit
- [ ] Statistik: Wochenende standardmaessig ausgeblendet + Toggle zum Einblenden
- [ ] Statistik: Kuchendiagramm mit Status-Auswahl (Recharts o.ae.)