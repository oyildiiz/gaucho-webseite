// n8n Code-Knoten „Bestellung prüfen“: prüft die Bestellung und rechnet die Summe selbst (Browserwerte zählen nicht)
const b = $input.first().json.body || {};
const PREISE = {
  lomo: { name: 'Lomo (Rinderfilet)', stueck: 43.90, portion: 48.90 },
  'bife-ancho': { name: 'Bife Ancho (Entrecôte)', stueck: 36.90, portion: 41.90 },
  bife: { name: 'Bife (Rumpsteak)', stueck: 28.90, portion: 33.90 },
  churrasco: { name: 'Churrasco (Hüftsteak)', stueck: 22.90, portion: 28.90 },
  lammkrone: { name: 'Lammkrone (Neuseeland)', stueck: 39.90 }
};
const GROESSEN = { 'bife-ancho': [300, 400, 500, 600, 700, 800, 900, 1000] }, STANDARD_GROESSEN = [200, 300, 400, 500, 600, 700, 800, 900, 1000], KG = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5];
// Abholzeiten: Di–Fr 15:00–22:00, Sa/So 11:00–13:30 und 17:00–22:00 (jeweils Ende minus 30 Minuten)
const OEFFNUNG = { 0: [[660, 840], [1020, 1350]], 1: [], 2: [[900, 1350]], 3: [[900, 1350]], 4: [[900, 1350]], 5: [[900, 1350]], 6: [[660, 840], [1020, 1350]] };
const TAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const esc = s => String(s == null ? '' : s).slice(0, 600).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const euro = x => '€ ' + x.toFixed(2).replace('.', ',');
const fehler = m => [{ json: { gueltig: false, spam: false, fehler: m } }];

if (b.website && String(b.website).trim()) return [{ json: { gueltig: false, spam: true } }];
const name = String(b.name || '').trim().slice(0, 80), email = String(b.email || '').trim().slice(0, 120), tel = String(b.tel || '').trim().slice(0, 40);
if (!name) return fehler('Name fehlt');
if (tel.replace(/\D/g, '').length < 6) return fehler('Telefon fehlt');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fehler('E-Mail ungültig');
const ab = b.abholung || {}, datum = String(ab.datum || ''), zeit = String(ab.zeit || '');
if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || !/^\d{2}:\d{2}$/.test(zeit)) return fehler('Abholtermin fehlt');
// Wiener Ortszeit: Abholung ab heute, am selben Tag frühestens 15 Minuten nach der Bestellung
const wien = {}; new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).forEach(t => { wien[t.type] = t.value; });
const heuteWien = `${wien.year}-${wien.month}-${wien.day}`, jetztMin = +wien.hour * 60 + +wien.minute;
const tag = new Date(datum + 'T12:00:00Z'), heute = new Date(heuteWien + 'T12:00:00Z');
const tageVoraus = Math.round((tag - heute) / 86400000);
if (tageVoraus < 0) return fehler('Abholtag liegt in der Vergangenheit');
const min = +zeit.slice(0, 2) * 60 + +zeit.slice(3, 5);
if (tageVoraus === 0 && min < jetztMin + 10) return fehler('Abholung heute frühestens in 15 Minuten möglich');
// Silvester (31.12.) ist immer offen – fällt er auf einen Montag, gelten die Dienstagszeiten
const wtag = tag.getUTCDay() === 1 && datum.slice(5) === '12-31' ? 2 : tag.getUTCDay();
if (!(OEFFNUNG[wtag] || []).some(([v, bis]) => min >= v && min <= bis - 30)) return fehler('Abholzeit außerhalb der Öffnungszeiten');
const pos = Array.isArray(b.positionen) ? b.positionen.slice(0, 30) : [];
if (!pos.length) return fehler('Warenkorb leer');
let summe = 0, aufAnfrage = false;
const zeilen = [];
for (const p of pos) {
  const pr = PREISE[p.pid]; if (!pr) return fehler('Unbekanntes Produkt');
  let text, kg = 0, kiloPreis;
  if (p.vid === 'portion' && pr.portion) {
    const g = +p.groesse_g, n = Math.round(+p.anzahl);
    if (!(GROESSEN[p.pid] || STANDARD_GROESSEN).includes(g) || !(n >= 1 && n <= 30)) return fehler('Menge ungültig');
    kg = n * g / 1000; kiloPreis = pr.portion; text = `${n} × ${g} g Steak, portioniert`;
  } else if (p.vid === 'stueck' && pr.stueck) {
    const k = +p.kg; if (!KG.includes(k)) return fehler('Menge ungültig');
    kg = k; kiloPreis = pr.stueck; text = `ca. ${String(k).replace('.', ',')} kg ${p.pid === 'lammkrone' ? '(ganze Krone)' : 'am Stück'}`;
  } else return fehler('Zuschnitt ungültig');
  const betrag = kiloPreis ? Math.round(kg * kiloPreis * 100) / 100 : null;
  if (betrag) summe += betrag;
  zeilen.push({ produkt: pr.name, menge: text, kilopreis: kiloPreis ? euro(kiloPreis) + '/kg' : 'auf Anfrage', betrag: betrag ? 'ca. ' + euro(betrag) : 'auf Anfrage' });
}
summe = Math.round(summe * 100) / 100;
const jetzt = new Date();
const nr = 'G-' + datum.slice(2, 4) + datum.slice(5, 7) + datum.slice(8, 10) + '-' + String(jetzt.getTime()).slice(-4);
const wann = `${TAGE[tag.getUTCDay()]}, ${datum.slice(8, 10)}.${datum.slice(5, 7)}.${datum.slice(0, 4)} um ${zeit} Uhr`;
const zahlart = b.zahlung === 'online' ? 'Online (noch nicht aktiv)' : 'Bei Abholung (bar/Karte)';
const tabelle = zeilen.map(z => `<tr><td style="padding:8px 16px 8px 0;border-bottom:1px solid #eee"><b>${esc(z.produkt)}</b><br><span style="color:#666">${esc(z.menge)}</span></td><td style="padding:8px 16px 8px 0;border-bottom:1px solid #eee;color:#666">${esc(z.kilopreis)}</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">${esc(z.betrag)}</td></tr>`).join('');
const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222"><div style="background:#f4efe6;border-left:4px solid #b08d57;padding:12px 16px;margin:0 0 16px;font-size:16px"><b>${esc(name)}</b><br><a href="mailto:${esc(email)}">${esc(email)}</a> · <a href="tel:${esc(tel.replace(/[^\d+]/g, ''))}">${esc(tel)}</a></div><h2 style="margin:0 0 4px">Neue Fleisch-Bestellung ${nr}</h2><p style="margin:0 0 18px;font-size:16px"><b>Abholung: ${esc(wann)}</b></p>
<table style="border-collapse:collapse;width:100%;max-width:640px">${tabelle}<tr><td colspan="2" style="padding:12px 0"><b>Richtpreis gesamt</b> (nach Gewicht)</td><td style="padding:12px 0;text-align:right"><b>ca. ${euro(summe)}${aufAnfrage ? ' + Anfrage' : ''}</b></td></tr></table>
<p><b>Kunde:</b> ${esc(name)}<br><b>E-Mail:</b> ${esc(email)}<br><b>Telefon:</b> ${esc(tel) || '–'}<br><b>Bezahlung:</b> ${esc(zahlart)}</p>
${b.msg ? `<p><b>Wünsche:</b><br>${esc(b.msg).replace(/\n/g, '<br>')}</p>` : ''}
<p style="color:#666;font-size:12px">Mit „Antworten“ schreiben Sie direkt an den Kunden. Bestellung über gaucho-webseite (Fleisch-Shop).</p></div>`;
const mail = { message: { subject: `${name} (${email}) – Fleisch-Bestellung ${nr} – Abholung ${wann}`, body: { contentType: 'HTML', content: html }, toRecipients: [{ emailAddress: { address: 'info@gaucho.at' } }], replyTo: [{ emailAddress: { address: email, name } }] }, saveToSentItems: false };
// Telegram (HTML): Kundeneingaben maskieren
const nachricht = `🥩 <b>Neue Fleisch-Bestellung ${nr}</b>\n<b>Abholung: ${esc(wann)}</b>\n\n${zeilen.map(z => `${esc(z.produkt)}: ${esc(z.menge)}`).join('\n')}\nca. ${euro(summe)}\n\n${esc(name)}\nTel: ${esc(tel)}\n${esc(email)}${b.msg ? '\n\nWünsche: ' + esc(String(b.msg).slice(0, 300)) : ''}`;
return [{ json: { gueltig: true, spam: false, nr, mail, nachricht, zeile: { nr, abholung: `${datum} ${zeit}`, kunde: name, email, tel, positionen: zeilen.map(z => `${z.produkt}: ${z.menge} (${z.betrag})`).join(' | '), summe_eur: summe, zahlart, status: 'neu', wunsch: String(b.msg || '').slice(0, 600) } } }];
