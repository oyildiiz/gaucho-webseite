// Cloudflare Pages Function: /api/bestellung (gleiche Logik wie die Netlify-Funktion, Zugangsdaten aus den Cloudflare-Variablen)
import { pruefeBestellung } from '../../netlify/functions/lib/bestellung.mjs';
import { sendeMail, sendeTelegram, antwort } from '../../netlify/functions/lib/senden.mjs';

export async function onRequestPost({ request, env }) {
  let daten;
  try { daten = await request.json(); } catch (e) { return antwort(400, { ok: false, fehler: 'Ungültige Anfrage' }); }
  const e = pruefeBestellung(daten || {});
  if (e.spam) return antwort(200, { ok: true });
  if (!e.gueltig) return antwort(200, { ok: false, fehler: e.fehler });
  try { await sendeMail(e.mail, env); } catch (err) { console.error(err.message); return antwort(500, { ok: false, fehler: 'Senden fehlgeschlagen' }); }
  await sendeTelegram(e.nachricht, env);
  return antwort(200, { ok: true, nr: e.nr });
}

export const onRequest = () => antwort(405, { ok: false, fehler: 'Nur POST' });
