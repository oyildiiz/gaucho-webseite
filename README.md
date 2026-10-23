# Argentinisches Steakhaus GAUCHO – Webseite mit Fleisch-Shop

Statische Seite, erzeugt mit `python3 build/build.py` nach `public/` (Netlify baut automatisch).

- Inhalte: `daten/produkte.json` (Fleisch-Shop: Preise, verfügbar ja/nein), `daten/speisekarte.json`, Rechtstexte `daten/*.html.inhalt`
- Design/Technik: `assets/style.css`, `assets/site.js`, Schriften lokal in `assets/fonts/` (keine Google-Verbindung)
- Bestellungen: POST an n8n-Webhook `gaucho-bestellung` (prüft und rechnet serverseitig, speichert in Data Table `gaucho_bestellungen`, Mail an info@gaucho.at)
- Reservierungen: POST an n8n-Webhook `gaucho-reservierung` (Mail an info@gaucho.at)
- Code der n8n-Prüfung zum Nachlesen: `n8n/bestellung-pruefen.js`

**Preis ändern:** in `daten/produkte.json` **und** im n8n-Workflow „Gaucho – Fleisch-Bestellung“ (Knoten „Bestellung prüfen und berechnen“, Tabelle `PREISE`).
