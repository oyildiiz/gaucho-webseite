// Cloudflare Worker: /api/bestellung und /api/reservierung, alles andere liefert Cloudflare als fertige Seite aus (public/)
import { pruefeBestellung } from '../netlify/functions/lib/bestellung.mjs';
import { pruefeReservierung } from '../netlify/functions/lib/reservierung.mjs';
import { sendeMail, sendeTelegram, antwort } from '../netlify/functions/lib/senden.mjs';

async function verarbeite(request, env, pruefe, mitNr, ctx) {
  if (request.method !== 'POST') return antwort(405, { ok: false, fehler: 'Nur POST' });
  let daten;
  try { daten = await request.json(); } catch (e) { return antwort(400, { ok: false, fehler: 'Ungültige Anfrage' }); }
  const e = pruefe(daten || {});
  if (e.spam) return antwort(200, { ok: true });
  if (!e.gueltig) return antwort(200, { ok: false, fehler: e.fehler });
  // Gleiche Absendung (Wiederholung nach Fehler) wird von Resend 24 h lang nicht doppelt verschickt
  const id = String((daten && daten.id) || '').replace(/[^\w-]/g, '').slice(0, 60);
  try { await sendeMail({ ...e.mail, schluessel: id && id + '-a' }, env); } catch (err) { console.error(err.message); return antwort(500, { ok: false, fehler: 'Senden fehlgeschlagen' }); }
  // Kundenmail und Telegram im Hintergrund, damit der Gast nicht warten muss
  const rest = Promise.allSettled([
    e.kundenMail ? sendeMail({ ...e.kundenMail, schluessel: id && id + '-k' }, env).catch(err => console.error('Kundenmail: ' + err.message)) : null,
    sendeTelegram(e.nachricht, env)
  ]);
  if (ctx && ctx.waitUntil) ctx.waitUntil(rest); else await rest;
  return antwort(200, mitNr ? { ok: true, nr: e.nr } : { ok: true });
}

export default {
  async fetch(request, env, ctx) {
    const pfad = new URL(request.url).pathname;
    if (pfad === '/api/bestellung') return verarbeite(request, env, pruefeBestellung, true, ctx);
    if (pfad === '/api/reservierung') return verarbeite(request, env, pruefeReservierung, false, ctx);
    return env.ASSETS.fetch(request);
  }
};
