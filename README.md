# Gaucho Home – Ferienwohnungen (gauchohome.pages.dev)

Statische Seite + Server (`_worker.js`) auf Cloudflare Pages, Projekt `gauchohome`.

- Inhalte (Wohnungen, Fotos, Texte, FAQ): `js/data.js`
- Server: `_worker.js` – Kalender und Tagespreise aus Smoobu, Bezahlung über Stripe Checkout,
  nach der Zahlung Eintrag in Smoobu und Mails über Resend.
- **Preisregel:** Booking.com-Preis aus Smoobu, minus 10 % Genius auf die Nächte (Reinigung ohne Rabatt),
  davon 5 % weniger. Zu ändern über `GENIUS_FACTOR` / `DIRECT_FACTOR` in `_worker.js`.
- Geheimnisse in Cloudflare: `STRIPE_SECRET_KEY`, `SMOOBU_API_KEY`, `RESEND_API_KEY`.

Veröffentlichen:
```
npx wrangler pages deploy . --project-name gauchohome --branch main
```
