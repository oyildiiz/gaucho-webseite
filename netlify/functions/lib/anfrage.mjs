// Händler- und Gastronomie-Anfrage: prüft die Eingaben und baut Mail und Telegram-Nachricht
export function pruefeAnfrage(b = {}) {
  const esc = s => String(s == null ? '' : s).slice(0, 1500).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fehler = m => ({ gueltig: false, spam: false, fehler: m });
  if (b.website && String(b.website).trim()) return { gueltig: false, spam: true };
  const feld = (k, n) => String(b[k] || '').trim().slice(0, n);
  const betrieb = feld('betrieb', 120), name = feld('name', 80), email = feld('email', 120), tel = feld('tel', 40), ort = feld('ort', 80), art = feld('art', 60), menge = feld('menge', 300), msg = feld('msg', 1500);
  if (!betrieb) return fehler('Name des Betriebs fehlt');
  if (!name) return fehler('Ansprechpartner fehlt');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fehler('E-Mail ungültig');
  if (tel.replace(/\D/g, '').length < 6) return fehler('Telefon fehlt');
  const zeile = (k, v) => v ? `<tr><td style="padding:3px 24px 3px 0;font-weight:bold;vertical-align:top">${k}:</td><td style="padding:3px 0">${v}</td></tr>` : '';
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#000"><h2 style="margin:0 0 12px">Neue Händler-/Gastro-Anfrage</h2><table style="border-collapse:collapse">${zeile('Betrieb', esc(betrieb))}${zeile('Art', esc(art))}${zeile('Ort', esc(ort))}${zeile('Ansprechpartner', esc(name))}${zeile('E-Mail', `<a href="mailto:${esc(email)}">${esc(email)}</a>`)}${zeile('Telefon', esc(tel))}${zeile('Interesse / Mengen', esc(menge).replace(/\n/g, '<br>'))}${zeile('Nachricht', esc(msg).replace(/\n/g, '<br>'))}</table><p style="color:#666;font-size:12px">Mit „Antworten“ schreiben Sie direkt an den Betrieb.</p></div>`;
  const mail = { subject: `Händler-Anfrage: ${betrieb.slice(0, 60).replace(/https?:\/\/\S+|www\.\S+/gi, '')}${ort ? ' (' + ort.slice(0, 40) + ')' : ''}`, html, replyTo: email };
  const nachricht = `🤝 <b>Neue Händler-/Gastro-Anfrage</b>\n<b>${esc(betrieb)}</b>${art ? ' · ' + esc(art) : ''}${ort ? '\n' + esc(ort) : ''}\n\n${esc(name)}\nTel: ${esc(tel)}\n${esc(email)}${menge ? '\n\nInteresse: ' + esc(menge.slice(0, 300)) : ''}`;
  return { gueltig: true, spam: false, mail, nachricht };
}
