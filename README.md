# Gaucho Home – Ferienwohnungen (gauchohome.pages.dev)

Statische Seite + Server (`_worker.js`) auf Cloudflare Pages, Projekt `gauchohome`.

- Inhalte (Wohnungen, Fotos, Texte, FAQ): `js/data.js`
- Server: `_worker.js` – Tagespreise aus `daten-preise.json` (Booking.com-Preise, gültig bis 15.11.2027),
  belegte Tage aus den Kalenderlinks (Variablen `ICAL_FUENF`, `ICAL_ZWEI`) und aus bezahlten Direktbuchungen,
  Bezahlung über Stripe Checkout, Mails über Resend.
- **Preisregel:** Booking.com-Preis aus Smoobu, minus 10 % Genius auf die Nächte (Reinigung ohne Rabatt),
  davon 5 % weniger. Zu ändern über `GENIUS_FACTOR` / `DIRECT_FACTOR` in `_worker.js`.
- Geheimnisse in Cloudflare: `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, dazu `ICAL_FUENF` / `ICAL_ZWEI`.

Veröffentlichen:
```
python3 deploy.py --live
```
`deploy.py` bündelt geänderte und neue Dateien in den Server, weil aus der Claude-Umgebung keine neuen Dateien
in den Cloudflare-Dateispeicher geladen werden können (Erklärung steht oben in der Datei).

Gestaltung: helles Papier, Tannengrün als Tinte, Ochsenblut als Akzent. Überschriften in Bricolage Grotesque,
Text in Instrument Sans. Schriften und Symbole liegen in `assets/` (keine Verbindung zu Google oder unpkg).
