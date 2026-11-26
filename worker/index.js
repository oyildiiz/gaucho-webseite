// Cloudflare Worker: /api/bestellung und /api/reservierung, alles andere liefert Cloudflare als fertige Seite aus (public/)
import { pruefeBestellung } from '../netlify/functions/lib/bestellung.mjs';
import { pruefeReservierung } from '../netlify/functions/lib/reservierung.mjs';
import { pruefeAnfrage } from '../netlify/functions/lib/anfrage.mjs';
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
    const url = new URL(request.url), pfad = url.pathname;
    // Nur eine Adresse für Google: www.gaucho.at leitet dauerhaft auf gaucho.at
    // Adressen der alten Webseite (vor 2026) auf die passenden neuen Seiten
    const alt = ziel => Response.redirect(new URL(ziel, 'https://gaucho.at').toString(), 301);
    if (pfad.startsWith('/essen-im-steakhaus-gaucho') || pfad.startsWith('/trinken-im-steakhaus-gaucho') || pfad.startsWith('/das-steak-im-steakhaus-gaucho')) return alt('/speisekarte');
    if (pfad === '/newsletter-anmeldung.html' || pfad === '/index.php') return alt('/');
    // Alte Adressen mit .html dauerhaft auf die Adresse ohne Endung (ausgenommen alte Webseite, siehe unten)
    const ohneHtml = /^\/(index|speisekarte|reservieren|fleisch|kontakt|impressum|datenschutz|agb|steak-kaufen|grosshandel)\.html$/.test(pfad)
      ? (pfad === '/index.html' ? '/' : pfad.slice(0, -5)) : null;
    if (url.hostname === 'www.gaucho.at' || (url.protocol === 'http:' && url.hostname === 'gaucho.at') || ohneHtml) {
      url.hostname = 'gaucho.at'; url.protocol = 'https:'; if (ohneHtml) url.pathname = ohneHtml;
      return Response.redirect(url.toString(), 301);
    }
    if (pfad === '/api/bestellung') return verarbeite(request, env, pruefeBestellung, true, ctx);
    if (pfad === '/api/anfrage') return verarbeite(request, env, pruefeAnfrage, false, ctx);
    if (pfad === '/api/reservierung') return verarbeite(request, env, pruefeReservierung, false, ctx);
    // Alte Adresse der Großhandelsseite
    if (pfad === '/gastronomie' || pfad === '/gastronomie.html') return alt('/grosshandel');
    return env.ASSETS.fetch(request);
  }
};
