# Iteration 2 Review - Zeiterfassung

**Datum:** 2026-07-07
**Status:** umzusetzen in Iteration 2
**Bezug:** `2026-07-06--zeiterfassung-redesign.md`

## Design

- Dark-Theme korrigieren: Der App-Hintergrund darf im dunklen Design nicht weiss bleiben.
- Kontrast im dunklen Design verbessern: Labels, Icons und Status-/Zeittexte muessen lesbar sein.
- Das bisherige Dunkelblau soll heller abgestimmt werden.
- Statt nur Hell/Dunkel werden kuratierte Themes angeboten:
  - Daylight
  - Sand
  - Slate
  - Indigo
  - Midnight
- Die Settings enthalten eine Theme-Card mit Grid und Mini-Preview je Theme.
- Expandierte Editbloecke muessen sich sichtbar von zugeklappten Tageskoepfen unterscheiden.
- Der klickbare Kopf eines Tages und der Editbereich sollen optisch getrennt sein.
- Zugeklappte Tageskoepfe zeigen Soll, Ist und Delta.

## Handling

- Der Button "Wochenende anzeigen" bleibt sichtbar und funktioniert als Toggle.
- Wochenenden werden standardmaessig mit Status "frei" gekennzeichnet.
- Die Zeiterfassung nutzt keine problematischen nativen `time`-Subfelder mehr.
- Zeitfelder werden als einzelnes Textfeld mit Parser umgesetzt.
- Beim Tippen von zwei Ziffern wird der Doppelpunkt automatisch ergaenzt.
- Eine Eingabe wie `1258` wird als `12:58` interpretiert.
- Der Zeitraum in den Einstellungen erlaubt neben 7/14/30 auch freie Eingaben, z.B. 21 oder 60 Tage.
- Der Saldo zeigt die Differenz der aktuell angezeigten Tage.
- Zusaetzlich wird ein Jahressaldo fuer alle Tage des aktuellen Jahres angezeigt.

## Einstellungen

- Es gibt nur noch ein Wochenstunden-Soll, z.B. 40 h.
- Tages-Soll-Werte werden aus dem Wochenstunden-Soll abgeleitet.
- In den Defaultbloecken wird die Konfiguration gegen das Soll verifiziert.
- Der Header der Defaultblock-Gruppe zeigt Soll-Zeit aus Wochenstunden und Ist-Zeit aus den Defaultbloecken.
- Pro Wochentag ist die konfigurierte Stundenanzahl sichtbar.
- Gruppen wie Theme, Zeitraum, Wochenende, Defaultbloecke, Sprache und WebDAV sind einklappbar.

## Definition of Done

- Dark-Theme-Hintergrund, Labels und Icons sind kontrastreich.
- Fuenf benannte Themes koennen in Settings ausgewaehlt werden.
- Collapse-/Expand-Zustaende der Tagesbloecke sind visuell eindeutig.
- Zugeklappte Tageszeilen enthalten Soll/Ist/Delta.
- Wochenende-Toggle bleibt immer bedienbar.
- Samstag und Sonntag erscheinen ohne gespeicherten Status als "frei".
- Zeitfelder erlauben fluessige Tastatureingabe ohne native HH/MM-Fokusprobleme.
- Zeitraum akzeptiert Presets und freie positive Tageszahlen.
- Tages- und Jahressaldo werden aus Eintraegen, Status und Soll berechnet.
- Settings nutzen Wochenstunden-Soll statt Tages-Soll.
- Defaultbloecke zeigen Soll/Ist/Differenz zur schnellen Plausibilitaetspruefung.
- Settings-Gruppen sind einklappbar.
