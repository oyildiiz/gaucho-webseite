// n8n Code-Knoten „Reservierung prüfen“: prüft die Anfrage, baut die Mail an info@gaucho.at und die Telegram-Nachricht an Papa
const b = $input.first().json.body || {};
const esc = s => String(s == null ? '' : s).slice(0, 600).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fehler = m => [{ json: { gueltig: false, spam: false, fehler: m } }];
if (b.website && String(b.website).trim()) return [{ json: { gueltig: false, spam: true } }];
const name = String(b.name || '').trim().slice(0, 80), email = String(b.email || '').trim().slice(0, 120), tel = String(b.tel || '').trim().slice(0, 40);
if (!name || !tel) return fehler('Name oder Telefon fehlt');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fehler('E-Mail ungültig');
const datum = String(b.datum || ''), zeit = String(b.zeit || ''), personen = Math.round(+b.personen);
if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || !/^\d{2}:\d{2}$/.test(zeit)) return fehler('Datum oder Uhrzeit fehlt');
if (!(personen >= 1 && personen <= 200)) return fehler('Personenzahl ungültig');
const tag = new Date(datum + 'T12:00:00Z');
if (tag.getUTCDay() === 1) return fehler('Montag ist Ruhetag');
// Reservierbar: Di–Fr 17:00–22:00, Sa/So 11:00–13:30 und 17:00–22:00
const FENSTER = { 0: [[660, 810], [1020, 1320]], 2: [[1020, 1320]], 3: [[1020, 1320]], 4: [[1020, 1320]], 5: [[1020, 1320]], 6: [[660, 810], [1020, 1320]] };
const min = +zeit.slice(0, 2) * 60 + +zeit.slice(3, 5);
if (!(FENSTER[tag.getUTCDay()] || []).some(([v, bis]) => min >= v && min <= bis)) return fehler('Uhrzeit außerhalb der Reservierungszeiten');
const TAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const wann = `${TAGE[tag.getUTCDay()]}, ${datum.slice(8, 10)}.${datum.slice(5, 7)}.${datum.slice(0, 4)} um ${zeit} Uhr`;
const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222"><div style="background:#f4efe6;border-left:4px solid #b08d57;padding:12px 16px;margin:0 0 16px;font-size:16px"><b>${esc(name)}</b><br><a href="mailto:${esc(email)}">${esc(email)}</a> · <a href="tel:${esc(tel.replace(/[^\d+]/g, ''))}">${esc(tel)}</a></div><h2 style="margin:0 0 8px">Neue Reservierungsanfrage</h2><p style="font-size:16px;margin:0 0 16px"><b>${esc(wann)} · ${personen} Person(en)</b></p>${b.msg ? `<p><b>Bemerkung:</b><br>${esc(b.msg).replace(/\n/g, '<br>')}</p>` : ''}<p style="color:#666;font-size:12px">Bitte bestätigen: Mit „Antworten“ schreiben Sie direkt an den Gast. Ist kein Tisch frei, bitte anrufen.</p></div>`;
const mail = { message: { subject: `${name} (${email}) – Reservierung ${wann} – ${personen} Pers.`, body: { contentType: 'HTML', content: html }, toRecipients: [{ emailAddress: { address: 'info@gaucho.at' } }], replyTo: [{ emailAddress: { address: email, name } }] }, saveToSentItems: false };
const nachricht = `🔔 Neue Reservierung\n${wann}\n${personen} Person(en)\n\n${name}\nTel: ${tel}\n${email}${b.msg ? '\n\nBemerkung: ' + String(b.msg).slice(0, 300) : ''}`;
return [{ json: { gueltig: true, spam: false, mail, nachricht } }];
