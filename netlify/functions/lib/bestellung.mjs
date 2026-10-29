import { begruessung } from './senden.mjs';
// Prüft die Eingaben serverseitig (Browserwerte zählen nicht) und baut Mail und Telegram-Nachricht. Gleiche Logik wie früher in n8n.
export function pruefeBestellung(b = {}) {
  const PREISE = {
    lomo: { name: 'Lomo (Rinderfilet)', stueck: 43.90, portion: 48.90 },
    'bife-ancho': { name: 'Bife Ancho (Entrecôte)', stueck: 36.90, portion: 41.90 },
    bife: { name: 'Bife (Rumpsteak)', stueck: 28.90, portion: 33.90 },
    churrasco: { name: 'Churrasco (Hüftsteak)', stueck: 22.90, portion: 28.90 },
    lammkrone: { name: 'Lammkrone (Neuseeland)', stueck: 39.90 }
  };
  // Ganze Stücke: Gewichtsspanne je Stück in kg (Richtpreis mit dem Mittelwert)
  const GANZ = { lomo: [1.6, 1.8], 'bife-ancho': [2.5, 3.5], bife: [3.5, 4.5], churrasco: [2.5, 3.5], lammkrone: [1.0, 1.3] };
  // Steakgewicht: frei wählbar in 100-g-Schritten, mindestens 200 g (Bife Ancho 300 g), höchstens 5 kg je Steak
  const MIN_G = { 'bife-ancho': 300 }, STANDARD_MIN_G = 200, MAX_G = 5000;
  // Abholzeiten: Di–Fr 15:00–21:00, Sa/So 12:00–14:00 und 16:00–21:00 (jeweils Ende minus 30 Minuten)
  const OEFFNUNG = { 0: [[720, 870], [960, 1290]], 1: [], 2: [[900, 1290]], 3: [[900, 1290]], 4: [[900, 1290]], 5: [[900, 1290]], 6: [[720, 870], [960, 1290]] };
  const TAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const esc = s => String(s == null ? '' : s).slice(0, 600).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const euro = x => '€ ' + x.toFixed(2).replace('.', ',');
  const fehler = m => ({ gueltig: false, spam: false, fehler: m });

  if (b.website && String(b.website).trim()) return { gueltig: false, spam: true };
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
      if (!(Number.isInteger(g) && g % 100 === 0 && g >= (MIN_G[p.pid] || STANDARD_MIN_G) && g <= MAX_G) || !(n >= 1 && n <= 30)) return fehler('Menge ungültig');
      kg = n * g / 1000; kiloPreis = pr.portion; text = `${n} × ${g} g Steak, portioniert`;
    } else if (p.vid === 'stueck' && GANZ[p.pid]) {
      const n = Math.round(+p.anzahl), [von, bis] = GANZ[p.pid];
      if (!(n >= 1 && n <= 5)) return fehler('Menge ungültig');
      kg = n * (von + bis) / 2; kiloPreis = pr.stueck; text = `${n} × ${p.pid === 'lammkrone' ? 'ganze Krone, tiefgefroren' : 'ganzes Stück'}, je ca. ${String(von).replace('.', ',')}–${String(bis).replace('.', ',')} kg (je nach Lager)`;
    } else return fehler('Zuschnitt ungültig');
    const betrag = kiloPreis ? Math.round(kg * kiloPreis * 100) / 100 : null;
    if (betrag) summe += betrag;
    zeilen.push({ produkt: pr.name, menge: text, kilopreis: kiloPreis ? euro(kiloPreis) + '/kg' : 'auf Anfrage', betrag: betrag ? 'ca. ' + euro(betrag) : 'auf Anfrage' });
  }
  summe = Math.round(summe * 100) / 100;
  const jetzt = new Date();
  const nr = 'G-' + datum.slice(2, 4) + datum.slice(5, 7) + datum.slice(8, 10) + '-' + String(jetzt.getTime()).slice(-4);
  const wann = `${TAGE[tag.getUTCDay()]}, ${datum.slice(8, 10)}.${datum.slice(5, 7)}.${datum.slice(0, 4)} um ${zeit} Uhr`;
  const zahlart = 'Bei Abholung (bar/Karte)';
  const tabelle = zeilen.map(z => `<tr><td style="padding:8px 16px 8px 0;border-bottom:1px solid #eee"><b>${esc(z.produkt)}</b><br><span style="color:#666">${esc(z.menge)}</span></td><td style="padding:8px 16px 8px 0;border-bottom:1px solid #eee;color:#666">${esc(z.kilopreis)}</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">${esc(z.betrag)}</td></tr>`).join('');
  const gruss = begruessung(b.anrede, name);
  const knopf = (text, href, farbe) => `<a href="${href}" style="display:inline-block;margin:0 10px 8px 0;padding:12px 20px;background:${farbe};color:#fff;text-decoration:none;font-weight:bold;border-radius:4px">${text}</a>`;
  const mailto = (betreff, text) => `mailto:${encodeURIComponent(email).replace(/%40/g, '@')}?subject=${encodeURIComponent(betreff)}&amp;body=${encodeURIComponent(text)}`;
  const knoepfe = knopf('Bestellung bestätigen', mailto('Ihre Bestellung im Gaucho', `${gruss},\n\nvielen Dank für Ihre Bestellung ${nr}. Wir bestätigen sie gerne. Ihr Fleisch ist am ${wann} zur Abholung bereit. Die Bezahlung erfolgt bei der Abholung, der Endpreis richtet sich nach dem tatsächlichen Gewicht.\n\nIhr Team vom Gaucho`), '#2e7d32') + knopf('Rückfrage an den Kunden', mailto('Ihre Bestellung im Gaucho', `${gruss},\n\nzu Ihrer Bestellung ${nr} müssen wir uns leider kurz bei Ihnen melden. Bitte rufen Sie uns an: +43 676 9181402.\n\nIhr Team vom Gaucho`), '#b81d24');
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222"><div style="background:#f4efe6;border-left:4px solid #b08d57;padding:12px 16px;margin:0 0 16px;font-size:16px"><b>${esc(name)}</b><br><a href="mailto:${esc(email)}">${esc(email)}</a> · <a href="tel:${esc(tel.replace(/[^\d+]/g, ''))}">${esc(tel)}</a></div><h2 style="margin:0 0 4px">Neue Fleisch-Bestellung ${nr}</h2><p style="margin:0 0 18px;font-size:16px"><b>Abholung: ${esc(wann)}</b></p>
  <table style="border-collapse:collapse;width:100%;max-width:640px">${tabelle}<tr><td colspan="2" style="padding:12px 0"><b>Richtpreis gesamt</b> (nach Gewicht)</td><td style="padding:12px 0;text-align:right"><b>ca. ${euro(summe)}${aufAnfrage ? ' + Anfrage' : ''}</b></td></tr></table>
  <p><b>Kunde:</b> ${esc(name)}<br><b>E-Mail:</b> ${esc(email)}<br><b>Telefon:</b> ${esc(tel) || '–'}<br><b>Bezahlung:</b> ${esc(zahlart)}</p>
  ${b.msg ? `<p><b>Wünsche:</b><br>${esc(b.msg).replace(/\n/g, '<br>')}</p>` : ''}
  <p style="margin:18px 0 0">${knoepfe}</p>
  <p style="color:#666;font-size:12px">Mit „Antworten“ schreiben Sie direkt an den Kunden. Bestellung über gaucho-webseite (Fleisch-Shop).</p></div>`;
  const mail = { subject: `${name} (${email}) – Fleisch-Bestellung ${nr} – Abholung ${wann}`, html, replyTo: email, absender: 'Bestellung Gaucho' };
  // Telegram (HTML): Kundeneingaben maskieren
  const nachricht = `🥩 <b>Neue Fleisch-Bestellung ${nr}</b>\n<b>Abholung: ${esc(wann)}</b>\n\n${zeilen.map(z => `${esc(z.produkt)}: ${esc(z.menge)}`).join('\n')}\nca. ${euro(summe)}\n\n${esc(name)}\nTel: ${esc(tel)}\n${esc(email)}${b.msg ? '\n\nWünsche: ' + esc(String(b.msg).slice(0, 300)) : ''}`;
  return { gueltig: true, spam: false, nr, mail, nachricht, zeile: { nr, abholung: `${datum} ${zeit}`, kunde: name, email, tel, positionen: zeilen.map(z => `${z.produkt}: ${z.menge} (${z.betrag})`).join(' | '), summe_eur: summe, zahlart, status: 'neu', wunsch: String(b.msg || '').slice(0, 600) } };
}
