// Versand: Mail über Resend, Nachricht an Telegram. Zugangsdaten stehen nur in den Umgebungsvariablen.
const adresseVon = (env) => {
  const basis = env.MAIL_FROM || 'GAUCHO Webseite <onboarding@resend.dev>';
  return { basis, adresse: (basis.match(/<([^>]+)>/) || [, basis])[1] };
};

async function resendSenden(env, body) {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY fehlt');
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error('Mailversand fehlgeschlagen: HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
}

// Mail an das Restaurant. „aktionen“ sind die Bestätigungsknöpfe: jeder bekommt einen signierten Link
export async function sendeMail({ subject, html, replyTo, absender, aktionen }, env = process.env) {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY fehlt');
  // Nur der Anzeigename wechselt (Bestellung / Reservierungsanfrage), die Adresse bleibt die bestätigte
  const { basis, adresse } = adresseVon(env);
  const von = absender ? `${absender} <${adresse}>` : basis;
  if (aktionen && aktionen.length) {
    const seite = env.SEITE_URL || 'https://gaucho.at';
    for (let i = 0; i < aktionen.length; i++) {
      let link;
      if (microsoftBereit(env)) link = `${seite}/api/bestaetigen?t=${await erzeugeToken({ ...aktionen[i], ts: Date.now() }, env)}`;
      else link = `mailto:${aktionen[i].e}?subject=${encodeURIComponent(aktionen[i].b)}&amp;body=${encodeURIComponent(aktionen[i].x)}`;
      html = html.split(`{{LINK:${i}}}`).join(link);
    }
  }
  await resendSenden(env, { from: von, to: [env.MAIL_TO || 'info@gaucho.at'], reply_to: replyTo, subject, html });
}

// Microsoft-Anbindung: Mail wird im Namen von info@gaucho.at über Microsoft Graph gesendet und liegt danach in „Gesendet“
export const microsoftBereit = (env) => !!(env.MS_TENANT_ID && env.MS_CLIENT_ID && env.MS_CLIENT_SECRET);
async function microsoftToken(env) {
  const r = await fetch(`https://login.microsoftonline.com/${env.MS_TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.MS_CLIENT_ID, client_secret: env.MS_CLIENT_SECRET, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' })
  });
  if (!r.ok) throw new Error('Microsoft-Anmeldung fehlgeschlagen: HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return (await r.json()).access_token;
}

// Bestätigung an den Gast: schöne Mail mit der Signatur des Restaurants, gesendet aus dem eigenen Postfach
export async function sendeBestaetigung(d, env = process.env) {
  if (!microsoftBereit(env)) throw new Error('Microsoft-Anbindung nicht eingerichtet');
  const absender = env.MS_SENDER || 'info@gaucho.at';
  const token = await microsoftToken(env);
  const r = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(absender)}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: { subject: d.b, body: { contentType: 'HTML', content: bestaetigungsHtml(d.x) }, toRecipients: [{ emailAddress: { address: d.e } }] },
      saveToSentItems: true
    })
  });
  if (!r.ok) throw new Error('Senden über Microsoft fehlgeschlagen: HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
}

export function bestaetigungsHtml(text) {
  const absaetze = String(text).split(/\n\n+/).map((a) => `<p style="margin:0 0 14px;line-height:1.6">${esc2(a).replace(/\n/g, '<br>')}</p>`).join('');
  return `<div style="font-family:Calibri,Arial,sans-serif;font-size:15px;color:#000;max-width:600px">${absaetze}<div style="margin-top:22px">${SIG_HTML}</div></div>`;
}

// Signierte Links: nur wer die Mail vom Server bekommen hat, kann eine Bestätigung auslösen
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
async function schluessel(env) {
  const geheim = env.LINK_SECRET || env.RESEND_API_KEY;
  if (!geheim) throw new Error('Kein Geheimnis für die Links');
  return crypto.subtle.importKey('raw', enc.encode('gaucho-bestaetigung:' + geheim), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function erzeugeToken(daten, env) {
  const body = b64u(enc.encode(JSON.stringify(daten)));
  return body + '.' + b64u(await crypto.subtle.sign('HMAC', await schluessel(env), enc.encode(body)));
}
export async function pruefeToken(token, env, maxTage = 30) {
  try {
    const [body, sig] = String(token).split('.');
    if (!body || !sig) return null;
    if (!(await crypto.subtle.verify('HMAC', await schluessel(env), unb64u(sig), enc.encode(body)))) return null;
    const d = JSON.parse(new TextDecoder().decode(unb64u(body)));
    if (!d.ts || Date.now() - d.ts > maxTage * 86400000) return null;
    return d;
  } catch (e) { return null; }
}

// Telegram ist optional: ohne Zugangsdaten passiert nichts, ein Fehler hier stoppt die Mail nicht
export async function sendeTelegram(text, env = process.env) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' })
    });
  } catch (e) { /* ignorieren */ }
}

export const antwort = (status, daten) => new Response(JSON.stringify(daten), { status, headers: { 'Content-Type': 'application/json' } });

// Anrede für die vorbereitete Antwort: mit Auswahl „Herr/Frau“ förmlich, sonst allgemein
export function begruessung(anrede, name) {
  const nachname = String(name).trim().split(/\s+/).slice(-1)[0];
  if (anrede === 'Herr') return `Sehr geehrter Herr ${nachname}`;
  if (anrede === 'Frau') return `Sehr geehrte Frau ${nachname}`;
  return 'Sehr geehrte Kundin, sehr geehrter Kunde';
}


// Signatur, wie sie das Restaurant in seinen Mails verwendet (reiner Text, damit sie im vorbereiteten Antworttext steht)
export const SIGNATUR = `Mit freundlichen Grüßen
Ihr Team vom Gaucho

Argentinisches Steakhaus Gaucho
Rheinstraße 89
6972 Fußach

Tel.: +43 5578 73027
Mobil: +43 676 9181 402
E-Mail: info@gaucho.at
Web: www.gaucho.at

Instagram: @steakhausgaucho
Facebook: Argentinisches Steakhaus Gaucho

UID-Nummer: ATU64560004`;

// HTML-Fassung: ruhig und untereinander, der Name in Rot
const SIG_HTML = `<p style="margin:0 0 18px;line-height:1.5">Mit freundlichen Grüßen<br>Ihr Team vom Gaucho</p>
<p style="margin:0 0 10px;padding:0 0 8px;border-bottom:2px solid #8f1d1d;display:inline-block"><b style="color:#8f1d1d;font-size:17px;letter-spacing:.3px">Argentinisches Steakhaus Gaucho</b></p>
<p style="margin:0 0 12px;line-height:1.6;color:#222">Rheinstraße 89<br>6972 Fußach</p>
<p style="margin:0 0 12px;line-height:1.6;color:#222">Tel.: <a href="tel:+43557873027" style="color:#222;text-decoration:none">+43 5578 73027</a><br>Mobil: <a href="tel:+436769181402" style="color:#222;text-decoration:none">+43 676 9181 402</a><br>E-Mail: <a href="mailto:info@gaucho.at" style="color:#222;text-decoration:none">info@gaucho.at</a><br>Web: <a href="https://www.gaucho.at" style="color:#8f1d1d;text-decoration:none">www.gaucho.at</a></p>
<p style="margin:0 0 12px;line-height:1.6;color:#222">Instagram: <a href="https://www.instagram.com/steakhausgaucho" style="color:#222;text-decoration:none">@steakhausgaucho</a><br>Facebook: <a href="https://www.facebook.com/ArgentinischesSteakhausGaucho" style="color:#222;text-decoration:none">Argentinisches Steakhaus Gaucho</a></p>
<p style="margin:0;line-height:1.6;color:#777;font-size:12px">UID-Nummer: ATU64560004</p>`;

// Bestätigungsblock für die Mails: Knöpfe lösen die Bestätigung aus, darunter derselbe Text zum Kopieren (für eigene Änderungen)
const esc2 = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function bestaetigung(email, optionen, aktionen) {
  const knopf = (o, i) => {
    aktionen.push({ e: email, b: o.betreff, x: o.text, l: o.knopf });
    return `<table cellpadding="0" cellspacing="0" border="0" style="display:inline-block;margin:0 10px 10px 0"><tr><td bgcolor="${o.farbe}" style="background:${o.farbe};padding:12px 20px"><a href="{{LINK:${i}}}" style="color:#ffffff;text-decoration:none;font-weight:bold"><span style="color:#ffffff">${esc2(o.knopf)}</span></a></td></tr></table>`;
  };
  const knoepfe = optionen.map((o, i) => knopf(o, aktionen.length)).join('');
  const kopie = optionen[0];
  return `<p style="margin:18px 0 6px">${knoepfe}</p>
<p style="color:#444;font-size:13px;margin:14px 0 4px"><b>Eigener Text?</b> Auf „Antworten“ klicken und diesen Text einfügen (Betreff: ${esc2(kopie.betreff)}):</p>
<div style="border:1px solid #bbb;background:#f7f7f7;padding:12px 14px;font-size:14px;color:#000">${esc2(kopie.text).replace(/\n/g, '<br>')}<br><br>${SIG_HTML}</div>`;
}
