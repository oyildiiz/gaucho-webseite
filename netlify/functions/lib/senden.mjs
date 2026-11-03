// Versand: Mail über Resend, Nachricht an Telegram. Zugangsdaten stehen nur in den Netlify-Umgebungsvariablen.
export async function sendeMail({ subject, html, replyTo, absender }, env = process.env) {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY fehlt');
  // Nur der Anzeigename wechselt (Bestellung / Reservierungsanfrage), die Adresse bleibt die bestätigte
  const basis = env.MAIL_FROM || 'GAUCHO Webseite <onboarding@resend.dev>';
  const adresse = (basis.match(/<([^>]+)>/) || [, basis])[1];
  const von = absender ? `${absender} <${adresse}>` : basis;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: von,
      to: [env.MAIL_TO || 'info@gaucho.at'],
      reply_to: replyTo,
      subject, html
    })
  });
  if (!r.ok) throw new Error('Mailversand fehlgeschlagen: HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
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
<p style="margin:0 0 10px;padding:0 0 8px;border-bottom:2px solid #c0161d;display:inline-block"><b style="color:#c0161d;font-size:17px;letter-spacing:.3px">Argentinisches Steakhaus Gaucho</b></p>
<p style="margin:0 0 12px;line-height:1.6;color:#222">Rheinstraße 89<br>6972 Fußach</p>
<p style="margin:0 0 12px;line-height:1.6;color:#222">Tel.: <a href="tel:+43557873027" style="color:#222;text-decoration:none">+43 5578 73027</a><br>Mobil: <a href="tel:+436769181402" style="color:#222;text-decoration:none">+43 676 9181 402</a><br>E-Mail: <a href="mailto:info@gaucho.at" style="color:#222;text-decoration:none">info@gaucho.at</a><br>Web: <a href="https://www.gaucho.at" style="color:#c0161d;text-decoration:none">www.gaucho.at</a></p>
<p style="margin:0 0 12px;line-height:1.6;color:#222">Instagram: <a href="https://www.instagram.com/steakhausgaucho" style="color:#222;text-decoration:none">@steakhausgaucho</a><br>Facebook: <a href="https://www.facebook.com/ArgentinischesSteakhausGaucho" style="color:#222;text-decoration:none">Argentinisches Steakhaus Gaucho</a></p>
<p style="margin:0;line-height:1.6;color:#777;font-size:12px">UID-Nummer: ATU64560004</p>`;

// Bestätigungsblock für die Mails: Knöpfe (mailto) öffnen die Antwort im eigenen Mailprogramm. Die Signatur kommt aus Outlook selbst, deshalb steht sie nicht im vorbereiteten Text. Darunter derselbe Text zum Kopieren, falls der Link nicht aufgeht
const esc2 = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function bestaetigung(email, optionen) {
  const adresse = encodeURIComponent(email).replace(/%40/g, '@');
  const knopf = (text, betreff, body, farbe) => {
    const href = `mailto:${adresse}?subject=${encodeURIComponent(betreff)}&amp;body=${encodeURIComponent(body)}`;
    return `<table cellpadding="0" cellspacing="0" border="0" style="display:inline-block;margin:0 10px 10px 0"><tr><td bgcolor="${farbe}" style="background:${farbe};padding:12px 20px"><a href="${href}" style="color:#ffffff;text-decoration:none;font-weight:bold"><span style="color:#ffffff">${esc2(text)}</span></a></td></tr></table>`;
  };
  const knoepfe = optionen.map((o) => knopf(o.knopf, o.betreff, o.text, o.farbe)).join('');
  const kopie = optionen[0];
  return `<p style="margin:18px 0 6px">${knoepfe}</p>
<p style="color:#444;font-size:13px;margin:14px 0 4px"><b>Falls der Knopf nicht aufgeht:</b> Auf „Antworten“ klicken und diesen Text einfügen (Betreff: ${esc2(kopie.betreff)}):</p>
<div style="border:1px solid #bbb;background:#f7f7f7;padding:12px 14px;font-size:14px;color:#000">${esc2(kopie.text).replace(/\n/g, '<br>')}<br><br>${SIG_HTML}</div>`;
}
