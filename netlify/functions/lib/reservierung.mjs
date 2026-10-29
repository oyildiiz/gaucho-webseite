import { begruessung, bestaetigung } from './senden.mjs';
// Prüft die Eingaben serverseitig (Browserwerte zählen nicht) und baut Mail und Telegram-Nachricht. Gleiche Logik wie früher in n8n.
export function pruefeReservierung(b = {}) {
  const esc = s => String(s == null ? '' : s).slice(0, 600).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fehler = m => ({ gueltig: false, spam: false, fehler: m });
  if (b.website && String(b.website).trim()) return { gueltig: false, spam: true };
  const name = String(b.name || '').trim().slice(0, 80), email = String(b.email || '').trim().slice(0, 120), tel = String(b.tel || '').trim().slice(0, 40);
  if (!name || !tel) return fehler('Name oder Telefon fehlt');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fehler('E-Mail ungültig');
  const datum = String(b.datum || ''), zeit = String(b.zeit || ''), personen = Math.round(+b.personen);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || !/^\d{2}:\d{2}$/.test(zeit)) return fehler('Datum oder Uhrzeit fehlt');
  if (!(personen >= 1 && personen <= 200)) return fehler('Personenzahl ungültig');
  const tag = new Date(datum + 'T12:00:00Z');
  // Silvester (31.12.) ist immer offen – fällt er auf einen Montag, gelten die Dienstagszeiten
  const wtag = tag.getUTCDay() === 1 && datum.slice(5) === '12-31' ? 2 : tag.getUTCDay();
  if (wtag === 1) return fehler('Montag ist Ruhetag');
  // Reservierbar: Di–Fr 17:00–21:45, Sa/So 11:00–13:30 und 17:00–21:45
  const FENSTER = { 0: [[660, 810], [1020, 1305]], 2: [[1020, 1305]], 3: [[1020, 1305]], 4: [[1020, 1305]], 5: [[1020, 1305]], 6: [[660, 810], [1020, 1305]] };
  const min = +zeit.slice(0, 2) * 60 + +zeit.slice(3, 5);
  if (!(FENSTER[wtag] || []).some(([v, bis]) => min >= v && min <= bis)) return fehler('Uhrzeit außerhalb der Reservierungszeiten');
  const TAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const wann = `${TAGE[tag.getUTCDay()]}, ${datum.slice(8, 10)}.${datum.slice(5, 7)}.${datum.slice(0, 4)} um ${zeit} Uhr`;
  const kurz = `${datum.slice(8, 10)}.${datum.slice(5, 7)}.${datum.slice(0, 4)} ${zeit}`;
  const zeile = (k, v) => `<tr><td style="padding:2px 24px 2px 0;font-weight:bold;vertical-align:top">${k}:</td><td style="padding:2px 0">${v}</td></tr>`;
  const gruss = begruessung(b.anrede, name);
  const knoepfe = bestaetigung(email, [{ knopf: 'Reservierung bestätigen', betreff: 'Ihre Reservierung im Gaucho', text: `${gruss},\n\nvielen Dank für Ihre Reservierungsanfrage. Wir bestätigen Ihren Tisch für ${personen} Person(en) am ${wann}.\n\nWir freuen uns auf Sie!\nIhr Team vom Gaucho`, farbe: '#2e7d32' }, { knopf: 'Kein Tisch frei', betreff: 'Ihre Reservierungsanfrage im Gaucho', text: `${gruss},\n\nvielen Dank für Ihre Reservierungsanfrage. Zu Ihrem Wunschtermin (${wann}) haben wir leider keinen Tisch mehr frei. Gerne finden wir gemeinsam einen anderen Termin. Antworten Sie uns einfach oder rufen Sie uns an: +43 676 9181402.\n\nIhr Team vom Gaucho`, farbe: '#b81d24' }]);
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#000"><table style="border-collapse:collapse">${zeile('Name', esc(name))}${zeile('E-Mail', `<a href="mailto:${esc(email)}">${esc(email)}</a>`)}${zeile('Telefon', esc(tel))}${zeile('Anzahl Personen', personen)}${zeile('Datum', kurz)}${b.msg ? zeile('Bemerkung', esc(b.msg).replace(/\n/g, '<br>')) : ''}</table>${knoepfe}</div>`;
  const mail = { subject: `${name} (${email}) – Reservierung ${wann} – ${personen} Pers.`, html, replyTo: email, absender: 'Reservierungsanfrage Gaucho' };
  // Telegram (HTML): Kundeneingaben maskieren
  const nachricht = `🔔 <b>Neue Reservierung</b>\n<b>${esc(wann)}</b>\n<b>${personen} Person(en)</b>\n\n${esc(name)}\nTel: ${esc(tel)}\n${esc(email)}${b.msg ? '\n\nBemerkung: ' + esc(String(b.msg).slice(0, 300)) : ''}`;
  return { gueltig: true, spam: false, mail, nachricht };
}
