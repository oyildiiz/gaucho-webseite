// Cloudflare Worker: /api/bestellung, /api/reservierung und /api/bestaetigen, alles andere liefert Cloudflare als fertige Seite aus (public/)
import { pruefeBestellung } from '../netlify/functions/lib/bestellung.mjs';
import { pruefeReservierung } from '../netlify/functions/lib/reservierung.mjs';
import { sendeMail, sendeTelegram, sendeBestaetigung, pruefeToken, antwort } from '../netlify/functions/lib/senden.mjs';

async function verarbeite(request, env, pruefe, mitNr) {
  if (request.method !== 'POST') return antwort(405, { ok: false, fehler: 'Nur POST' });
  let daten;
  try { daten = await request.json(); } catch (e) { return antwort(400, { ok: false, fehler: 'Ungültige Anfrage' }); }
  const e = pruefe(daten || {});
  if (e.spam) return antwort(200, { ok: true });
  if (!e.gueltig) return antwort(200, { ok: false, fehler: e.fehler });
  try { await sendeMail(e.mail, env); } catch (err) { console.error(err.message); return antwort(500, { ok: false, fehler: 'Senden fehlgeschlagen' }); }
  await sendeTelegram(e.nachricht, env);
  return antwort(200, mitNr ? { ok: true, nr: e.nr } : { ok: true });
}

// ---- Bestätigung an den Gast (Link aus der Mail an das Restaurant) ----
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function seite(titel, inhalt, status = 200) {
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(titel)}</title>
<style>*{box-sizing:border-box}body{margin:0;background:#0f0c0b;color:#f2ebe0;font-family:Georgia,'Times New Roman',serif;line-height:1.5}
main{max-width:560px;margin:0 auto;padding:28px 18px 60px}h1{font-weight:500;font-size:26px;margin:0 0 6px}.k{color:#c9a46a;letter-spacing:.2em;text-transform:uppercase;font:600 12px Arial,sans-serif;margin:0 0 18px}
.box{background:#1a1514;border:1px solid #3a302a;padding:16px 18px;margin:18px 0;font:15px/1.6 Arial,sans-serif}.box b{color:#c9a46a}
button,.knopf{display:block;width:100%;border:0;padding:16px 20px;font:700 16px Arial,sans-serif;color:#fff;background:#2e7d32;cursor:pointer;text-align:center;text-decoration:none;margin:10px 0}
.rot{background:#b81d24}.grau{background:#3a302a}p{font-family:Arial,sans-serif;font-size:15px}</style></head><body><main><div class="k">Argentinisches Steakhaus Gaucho</div>${inhalt}</main></body></html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}

// Merkt sich, welche Bestätigung schon gesendet wurde (Cloudflare-Cache, optional)
const marke = (t) => new Request('https://gaucho.at/__gesendet/' + encodeURIComponent(String(t).split('.')[1] || t));
async function schonGesendet(t) {
  try { return typeof caches !== 'undefined' && !!(await caches.default.match(marke(t))); } catch (e) { return false; }
}
async function merke(t) {
  try { if (typeof caches !== 'undefined') await caches.default.put(marke(t), new Response('1', { headers: { 'Cache-Control': 'public, max-age=2592000' } })); } catch (e) { /* ignorieren */ }
}

async function bestaetige(request, env) {
  const url = new URL(request.url);
  let token = url.searchParams.get('t'), nochmal = false;
  if (request.method === 'POST') {
    const f = await request.formData().catch(() => null);
    if (f) { token = f.get('t') || token; nochmal = f.get('nochmal') === '1'; }
  } else if (request.method !== 'GET') return seite('Nicht erlaubt', '<h1>Nicht erlaubt</h1>', 405);
  const d = await pruefeToken(token, env);
  if (!d) return seite('Link ungültig', '<h1>Link ungültig</h1><p>Dieser Link ist abgelaufen oder nicht vollständig. Bitte öffnen Sie die Mail noch einmal oder antworten Sie dem Gast direkt.</p>', 400);

  const vorschau = `<div class="box"><b>An:</b> ${esc(d.e)}<br><b>Betreff:</b> ${esc(d.b)}<br><br>${esc(d.x).replace(/\n/g, '<br>')}<br><br><span style="color:#9a8f82">Danach folgen Ihre Signatur und der rote Name des Steakhauses.</span></div>`;
  const form = (extra, text, klasse) => `<form method="post" action="/api/bestaetigen"><input type="hidden" name="t" value="${esc(token)}">${extra}<button class="${klasse || ''}" type="submit">${text}</button></form>`;

  if (request.method === 'GET') {
    const bereits = await schonGesendet(token);
    return seite(d.l || 'Bestätigung', `<h1>${esc(d.l || 'Bestätigung')}</h1>${bereits ? '<p><b>Hinweis:</b> Diese Bestätigung wurde schon gesendet.</p>' : '<p>Diese Mail geht jetzt an den Gast:</p>'}${vorschau}${form(bereits ? '<input type="hidden" name="nochmal" value="1">' : '', bereits ? 'Trotzdem noch einmal senden' : 'Jetzt an den Gast senden', bereits ? 'grau' : '')}`);
  }

  if ((await schonGesendet(token)) && !nochmal) {
    return seite('Schon gesendet', `<h1>Schon gesendet</h1><p>Diese Bestätigung ist bereits an ${esc(d.e)} gegangen.</p>${form('<input type="hidden" name="nochmal" value="1">', 'Trotzdem noch einmal senden', 'grau')}`);
  }
  try { await sendeBestaetigung(d, env); } catch (err) {
    console.error(err.message);
    const grund = String(err.message || '').replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '…').slice(0, 260);
    return seite('Fehler', `<h1>Das hat nicht geklappt</h1><p>Die Mail konnte nicht gesendet werden. Bitte versuchen Sie es noch einmal oder antworten Sie dem Gast direkt.</p><div class="box" style="font-size:12px;color:#9a8f82;word-break:break-word"><b>Technischer Hinweis:</b><br>${esc(grund)}</div>`, 500);
  }
  await merke(token);
  await sendeTelegram(`✅ <b>${esc(d.l || 'Bestätigung')}</b> gesendet an ${esc(d.e)}`, env);
  return seite('Gesendet', `<h1>Gesendet ✓</h1><p>Die Mail ist an <b>${esc(d.e)}</b> gegangen. Sie liegt in Ihrem Postfach unter „Gesendet“.</p>`);
}

export default {
  async fetch(request, env) {
    const pfad = new URL(request.url).pathname;
    if (pfad === '/api/bestellung') return verarbeite(request, env, pruefeBestellung, true);
    if (pfad === '/api/reservierung') return verarbeite(request, env, pruefeReservierung, false);
    if (pfad === '/api/bestaetigen') return bestaetige(request, env);
    return env.ASSETS.fetch(request);
  }
};
