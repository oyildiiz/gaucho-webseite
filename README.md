# Argentinisches Steakhaus GAUCHO – Webseite mit Fleisch-Shop

Statische Seite, erzeugt mit `python3 build/build.py` nach `public/` (Netlify baut automatisch).

- Inhalte: `daten/produkte.json` (Fleisch-Shop: Preise, verfügbar ja/nein), `daten/speisekarte.json`, Rechtstexte `daten/*.html.inhalt`
- Design/Technik: `assets/style.css`, `assets/site.js`, Schriften lokal in `assets/fonts/` (keine Google-Verbindung)
- Bestellungen: POST an n8n-Webhook `gaucho-bestellung` (prüft und rechnet serverseitig, speichert in Data Table `gaucho_bestellungen`, Mail an info@gaucho.at)
- Reservierungen: POST an n8n-Webhook `gaucho-reservierung` (Mail an info@gaucho.at)
- Code der n8n-Prüfung zum Nachlesen: `n8n/bestellung-pruefen.js`

**Preis ändern:** in `daten/produkte.json` **und** im n8n-Workflow „Gaucho – Fleisch-Bestellung“ (Knoten „Bestellung prüfen und berechnen“, Tabelle `PREISE`).

## Bestellung & Reservierung ohne n8n (Netlify-Funktionen)
- Code: `netlify/functions/` (`bestellung.mjs`, `reservierung.mjs`, Prüflogik in `lib/`), Adressen `/api/bestellung` und `/api/reservierung`.
- Umschalten: in Netlify die Variable `GAUCHO_BACKEND=netlify` setzen und neu veröffentlichen. Ohne die Variable läuft weiter n8n.
- Netlify-Variablen (Site configuration → Environment variables): `RESEND_API_KEY` (nötig), `MAIL_FROM` (z. B. `GAUCHO Webseite <bestellung@gaucho.at>`, erst nach Bestätigung der Domain bei Resend), `MAIL_TO` (Standard `info@gaucho.at`), `TELEGRAM_BOT_TOKEN` und `TELEGRAM_CHAT_ID` (optional).
- Preise stehen dann in `netlify/functions/lib/bestellung.mjs` (Tabelle `PREISE`) **und** in `daten/produkte.json`.

## Cloudflare (Worker mit Seiten)
- Konfiguration: `wrangler.jsonc` (Seiten aus `public/`, Code in `worker/index.js`, nutzt die Logik aus `netlify/functions/lib/`). Build-Befehl `python3 build/build.py`, Deploy-Befehl `npx wrangler deploy`.
- Laufzeit-Variablen in Cloudflare (Settings → Variables and Secrets): `RESEND_API_KEY` (Secret), optional `MAIL_FROM`, `MAIL_TO`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. Standard sind die eigenen Funktionen; mit der Build-Variable `GAUCHO_BACKEND=n8n` läuft es über n8n.
