# ⚽ TERRACE WARS

Ein browserbasiertes Echtzeit-Strategiespiel über rivalisierende Fußball-Fangruppen.

## MVP-Prototyp

Dieses Repository enthält ein spielbares lokales Trainings-MVP mit:

- Arena mit zwei Lanes, Flusszone, Brücken, Festungen und Außenposten
- Hype-Ressource mit automatischer Regeneration
- Acht Karten mit unterschiedlichen Kosten und Rollen
- Hauptmenü und gespeicherter Deck-Reihenfolge; vier Handkarten mit Rotation
- Kartenwahl per Klick/Touch oder Tasten 1–4; Einsetzen per Klick/Touch oder Desktop-Drag-and-drop
- KI mit eigenem Hype-Budget, automatische Kämpfe und Gebäude-Verteidigung
- Feste, sichtbare Lane-Wege über die Brücken und gegnerischen Kneipen zum Clubhaus;
  die Kneipe der jeweiligen Lane muss zuerst zerstört werden
- Truppen erkennen Gegner im Umkreis von 24 Einheiten, verfolgen erfasste Ziele
  bis 32 Einheiten Entfernung und priorisieren Gegner vor Gebäuden.
  Nach dem Kampf setzen sie ihren Lane-Weg fort; auch bei Verfolgung nutzen sie Brücken.
- Dachwachen auf allen vier Kneipen: Bengalo-Würfe alle 1,5 Sekunden in 20 Einheiten
  Reichweite, 0,65 Sekunden Flugzeit, 45 Direktschaden und 15 Schaden an weiteren
  Gegnern im Umkreis von 4 Einheiten; sichtbare Flugbahnen und Einschläge
- Unterschiedliche Lebenspunkte, Reichweiten, Geschwindigkeiten und Fähigkeiten
- Animierte Pyrofackeln mit mehrschichtigen Flammen, Funken und leichtem Rauch;
  Bengalos ziehen beim Flug eine Rauchspur
- Pyro-Fans holen zum Wurf aus und schleudern eine rotierende Fackel mit
  Rauch- und Funkenspur. Nach 0,6 Sekunden verursacht der Einschlag Direkt-
  und Flächenschaden; ein rein visueller Brandfleck brennt 3 Sekunden nach
  und erlischt mit Rauch
- Kneipen-Dachwachen und Bierbecher-Werfer greifen jetzt bis 20 Spielfeld-Einheiten weit an.
- Bierbecher-Werfer mit Wurfanimation, erkennbaren Bierbechern samt Schaumkrone,
  0,5 Sekunden Flugzeit und Schaden beim Einschlag; Spritzer und eine nach
  2,4 Sekunden verschwindende Bierpfütze (rein visueller Bodeneffekt)
- Capo-Schadensbonus, Trommler-Heilung, Ordner-Verlangsamung und Pyro-Flächenschaden
- 3-Minuten-Matches, doppelte Hype-Regeneration in der Schlussminute
- Sieg, Niederlage, Unentschieden, Pause (Leertaste), Aufgeben und Revanche
- Live-Lebenspunkte und Kampfprotokoll, responsive Oberfläche und zuschaltbare synthetische Soundeffekte

## Start

```bash
npm install
npm run dev
```

Für den lokalen Multiplayer zusätzlich in einem zweiten Terminal:

```bash
npm run server
```

Danach im Spiel **Multiplayer-Spiel erstellen** wählen. Der erzeugte Link kann
an den zweiten Spieler geschickt werden. Der Server läuft standardmäßig auf
`ws://localhost:8787`; für echte Einladungslinks muss er öffentlich gehostet
und der WebSocket-Endpunkt in `src/main.tsx` angepasst werden.

### Deployment mit Render

Das Repository enthält eine fertige `render.yaml`. In Render:

1. **New → Blueprint** wählen.
2. Das GitHub-Repository verbinden.
3. Beide Services aus `render.yaml` deployen lassen.
4. Nach dem Deploy die Frontend-URL öffnen.

Der WebSocket-Server besitzt den Healthcheck `/health`; die Frontend-Variable
`VITE_MULTIPLAYER_URL` wird über die Blueprint-Konfiguration gesetzt.

Für einen Produktions-Build:

```bash
npm run build
```

Simulationstests (Node.js 22.6 oder neuer):

```bash
npm test
```

## Technik und Umfang

React + TypeScript + Vite mit einer individuell illustrierten SVG-Arena.
`src/Arena.tsx` enthält die isometrische Projektion, Gebäude, acht Fan-Illustrationen,
Tribünen, Flutlicht und Pyro-Nebel. Eingabepositionen werden über die inverse SVG-Matrix
in Spielkoordinaten umgerechnet; Gebäude und Einheiten werden nach Tiefe sortiert.
`src/derby.css` gestaltet Arena, Karten und Menü im rauen Derby-Nacht-Look.
Die Simulation ist in `src/game.ts` von der Oberfläche getrennt und läuft mit 20 Schritten pro Sekunde lokal im Browser.
Bei Zeitablauf zählen zerstörte gegnerische Außenposten; bei Gleichstand endet das Match unentschieden.
Die acht enthaltenen Karten bilden das Deck; ihre Reihenfolge lässt sich verändern und wird lokal gespeichert.

Der Multiplayer nutzt einen autoritativen Node.js-WebSocket-Server in
`server/index.mjs`. Beide Spieler haben eigene Decks und Hype-Ressourcen; der
Server simuliert das Match und verteilt den Zustand. Der Ersteller spielt blau
und der Beitretende rot. Accounts, Ranglisten, Shop und Fortschritt sind nicht
Bestandteil des MVP.
