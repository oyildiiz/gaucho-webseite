import { pruefeBestellung } from './lib/bestellung.mjs';
import { sendeMail, sendeTelegram, antwort } from './lib/senden.mjs';

export default async (req) => {
  if (req.method !== 'POST') return antwort(405, { ok: false, fehler: 'Nur POST' });
  let daten;
  try { daten = await req.json(); } catch (e) { return antwort(400, { ok: false, fehler: 'Ungültige Anfrage' }); }
  const e = pruefeBestellung(daten || {});
  if (e.spam) return antwort(200, { ok: true });
  if (!e.gueltig) return antwort(200, { ok: false, fehler: e.fehler });
  try { await sendeMail(e.mail); } catch (err) { console.error(err.message); return antwort(500, { ok: false, fehler: 'Senden fehlgeschlagen' }); }
  await sendeTelegram(e.nachricht);
  return antwort(200, { ok: true, nr: e.nr });
};

export const config = { path: '/api/bestellung' };
