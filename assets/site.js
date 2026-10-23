document.documentElement.classList.add('js');

// Kopf, Menü und Einblenden
(function () {
  var kopf = document.getElementById('kopf'), burger = document.getElementById('burger');
  function scroll() { kopf.classList.toggle('gescrollt', window.scrollY > 30); }
  scroll(); window.addEventListener('scroll', scroll, { passive: true });
  function menu(offen) { kopf.classList.toggle('offen', offen); burger.setAttribute('aria-expanded', offen); burger.setAttribute('aria-label', offen ? 'Menü schließen' : 'Menü öffnen'); document.body.style.overflow = offen ? 'hidden' : ''; }
  burger.addEventListener('click', function () { menu(!kopf.classList.contains('offen')); });
  document.querySelectorAll('#nav a').forEach(function (a) { a.addEventListener('click', function () { menu(false); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') menu(false); });
  var el = document.querySelectorAll('.einblenden');
  if (!('IntersectionObserver' in window)) { el.forEach(function (x) { x.classList.add('sichtbar'); }); return; }
  var io = new IntersectionObserver(function (es) { es.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('sichtbar'); io.unobserve(x.target); } }); }, { threshold: 0.12 });
  el.forEach(function (x) { io.observe(x); });
})();

// Öffnungszeiten -> mögliche Uhrzeiten (0 = Sonntag)
var OEFFNUNG = { 0: [['11:00', '14:00'], ['17:00', '22:30']], 1: [], 2: [['17:00', '22:30']], 3: [['17:00', '22:30']], 4: [['17:00', '22:30']], 5: [['17:00', '22:30']], 6: [['11:00', '14:00'], ['17:00', '22:30']] };
var TAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
var VORLAUF = 15; // Minuten: so kurzfristig kann man heute noch reservieren oder abholen
function minuten(t) { var p = t.split(':'); return +p[0] * 60 + +p[1]; }
function zeitText(m) { return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
function isoDatum(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function slots(datum, abSchluss) {
  var liste = [];
  (OEFFNUNG[datum.getDay()] || []).forEach(function (f) { for (var m = minuten(f[0]); m <= minuten(f[1]) - abSchluss; m += 15) liste.push(zeitText(m)); });
  return liste;
}
function fuelleZeiten(select, datum, abSchluss, nurZukunft) {
  var jetzt = new Date(), heute = isoDatum(jetzt) === isoDatum(datum);
  var liste = slots(datum, abSchluss).filter(function (z) { return !(nurZukunft && heute && minuten(z) < jetzt.getHours() * 60 + jetzt.getMinutes() + VORLAUF); });
  select.innerHTML = liste.length ? liste.map(function (z) { return '<option>' + z + '</option>'; }).join('') : '<option value="">An diesem Tag geschlossen</option>';
}
function sende(form, daten, ok, knopf) {
  var status = form.querySelector('.form-status');
  knopf.disabled = true; status.className = 'form-status'; status.textContent = 'Wird gesendet …';
  return fetch(form.dataset.ziel, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(daten) })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json().catch(function () { return {}; }); })
    .then(function (antwort) { if (antwort && antwort.ok === false) throw new Error(antwort.fehler || 'abgelehnt'); ok(antwort || {}); })
    .catch(function () { status.className = 'form-status fehler'; status.textContent = 'Das Senden hat leider nicht geklappt. Bitte versuchen Sie es erneut oder rufen Sie uns an: +43 5578 73027.'; })
    .finally(function () { knopf.disabled = false; });
}

// Reservierung
(function () {
  var form = document.getElementById('reservierung');
  if (!form) return;
  var datum = form.querySelector('#r-datum'), zeit = form.querySelector('#r-zeit');
  var heute = new Date(); datum.min = isoDatum(heute);
  var bis = new Date(); bis.setDate(bis.getDate() + 120); datum.max = isoDatum(bis);
  datum.addEventListener('change', function () { if (datum.value) fuelleZeiten(zeit, new Date(datum.value + 'T12:00'), 30, true); });
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (datum.value && !zeit.value) { datum.setCustomValidity('An diesem Tag haben wir geschlossen (Montag Ruhetag).'); }
    if (!form.checkValidity()) { form.reportValidity(); datum.setCustomValidity(''); return; }
    var d = {}; new FormData(form).forEach(function (v, k) { d[k] = String(v).trim(); });
    sende(form, d, function () {
      form.innerHTML = '<div class="danke"><h3>Vielen Dank, ' + d.name.replace(/[<>&]/g, '') + '!</h3><p>Ihre Reservierungsanfrage für ' + d.personen + ' Person(en) am ' + new Date(d.datum + 'T12:00').toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long' }) + ' um ' + d.zeit + ' Uhr ist bei uns eingegangen.</p><p>Wir bestätigen Ihre Reservierung per E-Mail. Ist kein Tisch mehr frei, melden wir uns telefonisch.</p></div>';
    }, form.querySelector('button[type="submit"]'));
  });
})();

// Warenkorb (Local Storage) und Shop
(function () {
  var SPEICHER = 'gaucho_korb';
  function lies() { try { return JSON.parse(localStorage.getItem(SPEICHER)) || []; } catch (e) { return []; } }
  function schreib(k) { try { localStorage.setItem(SPEICHER, JSON.stringify(k)); } catch (e) {} zaehler(); }
  function zaehler() { var n = lies().length; document.querySelectorAll('[data-korb-zahl]').forEach(function (z) { z.textContent = n; z.hidden = !n; }); }
  zaehler();

  var datenEl = document.getElementById('produktdaten');
  if (!datenEl) return;
  var DATEN = JSON.parse(datenEl.textContent), P = {};
  DATEN.produkte.forEach(function (p) { P[p.id] = p; });
  function euro(x) { return '€ ' + x.toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function kgVon(pos) { return pos.art === 'steak' ? pos.anzahl * pos.groesse_g / 1000 : pos.art === 'kg' ? pos.kg : 0; }
  function preisVon(pos) { var v = variante(pos.pid, pos.vid); return v && v.preis_kg ? kgVon(pos) * v.preis_kg : null; }
  function variante(pid, vid) { var p = P[pid]; if (!p) return null; for (var i = 0; i < p.varianten.length; i++) if (p.varianten[i].id === vid) return p.varianten[i]; return null; }
  function beschreibung(pos) {
    if (pos.art === 'steak') return pos.anzahl + ' × ' + pos.groesse_g + ' g Steak (ca. ' + kgVon(pos).toLocaleString('de-AT') + ' kg)';
    if (pos.art === 'kg') return 'ca. ' + pos.kg.toLocaleString('de-AT') + ' kg am Stück';
    return pos.anzahl + ' Stück';
  }
  function optionen(werte, text, vorgabe) { return werte.map(function (w) { return '<option value="' + w + '"' + (w === vorgabe ? ' selected' : '') + '>' + text(w) + '</option>'; }).join(''); }

  document.querySelectorAll('[data-produkt]').forEach(function (karte) {
    var p = P[karte.dataset.produkt], menge = karte.querySelector('[data-menge]'), rp = karte.querySelector('[data-richtpreis]');
    function aktuelleVariante() { var r = karte.querySelector('input[type=radio]:checked'); return variante(p.id, r ? r.value : p.varianten[0].id); }
    function zeichneMenge() {
      var v = aktuelleVariante(), id = p.id;
      if (v.art === 'steak') menge.innerHTML = '<div><label for="g-' + id + '">Steakgröße</label><select id="g-' + id + '" data-g>' + optionen(v.groessen_g || DATEN.steak_groessen_g, function (g) { return 'ca. ' + (g >= 1000 ? (g / 1000).toString().replace('.', ',') + ' kg' : g + ' g'); }, 300) + '</select></div><div><label for="a-' + id + '">Anzahl</label><select id="a-' + id + '" data-a>' + optionen([1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20], function (a) { return a + (a === 1 ? ' Steak' : ' Steaks'); }, 2) + '</select></div>';
      else if (v.art === 'kg') menge.innerHTML = '<div><label for="k-' + id + '">Menge</label><select id="k-' + id + '" data-k>' + optionen(DATEN.kg_mengen, function (k) { return 'ca. ' + k.toLocaleString('de-AT') + ' kg'; }, 1) + '</select></div>';
      else menge.innerHTML = '<div><label for="s-' + id + '">Anzahl</label><select id="s-' + id + '" data-s>' + optionen([1, 2, 3, 4, 5, 6], function (a) { return a + ' Stück'; }, 1) + '</select></div>';
      menge.querySelectorAll('select').forEach(function (s) { s.addEventListener('change', rechne); });
      rechne();
    }
    function position() {
      var v = aktuelleVariante(), pos = { pid: p.id, vid: v.id, art: v.art };
      if (v.art === 'steak') { pos.groesse_g = +menge.querySelector('[data-g]').value; pos.anzahl = +menge.querySelector('[data-a]').value; }
      else if (v.art === 'kg') pos.kg = +menge.querySelector('[data-k]').value;
      else pos.anzahl = +menge.querySelector('[data-s]').value;
      return pos;
    }
    function rechne() { var pr = preisVon(position()); rp.innerHTML = pr === null ? 'Preis auf Anfrage<small>wir bestätigen ihn vor der Abholung</small>' : 'ca. ' + euro(pr) + '<small>Richtpreis inkl. MwSt.</small>'; }
    karte.querySelectorAll('input[type=radio]').forEach(function (r) { r.addEventListener('change', zeichneMenge); });
    zeichneMenge();
    karte.querySelector('[data-in-korb]').addEventListener('click', function () {
      var k = lies(); k.push(position()); schreib(k); korbZeichnen();
      var b = this; b.textContent = 'Hinzugefügt ✓'; setTimeout(function () { b.textContent = 'In den Warenkorb'; }, 1600);
    });
  });

  var liste = document.querySelector('[data-korb-liste]'), summeBox = document.querySelector('[data-korb-summe]'), summe = document.querySelector('[data-summe]');
  function korbZeichnen() {
    var k = lies().filter(function (pos) { return P[pos.pid] && variante(pos.pid, pos.vid); });
    if (!k.length) { liste.innerHTML = '<p class="leer">Ihr Warenkorb ist noch leer.</p>'; summeBox.hidden = true; return; }
    var gesamt = 0, offen = false;
    liste.innerHTML = k.map(function (pos, i) {
      var p = P[pos.pid], v = variante(pos.pid, pos.vid), pr = preisVon(pos);
      if (pr === null) offen = true; else gesamt += pr;
      return '<div class="posten"><span class="posten-name">' + p.name + ' · ' + v.name + '</span><span class="posten-preis">' + (pr === null ? 'auf Anfrage' : 'ca. ' + euro(pr)) + '</span><span class="posten-info">' + beschreibung(pos) + '</span><button class="posten-weg" type="button" data-weg="' + i + '">Entfernen</button></div>';
    }).join('');
    summeBox.hidden = false; summe.textContent = 'ca. ' + euro(gesamt) + (offen ? ' + Anfrage' : '');
    liste.querySelectorAll('[data-weg]').forEach(function (b) { b.addEventListener('click', function () { var kk = lies(); kk.splice(+b.dataset.weg, 1); schreib(kk); korbZeichnen(); }); });
  }
  korbZeichnen();

  // Abholtermine: ab heute, 12 Öffnungstage im Voraus
  var form = document.getElementById('bestellung'), tag = form.querySelector('#b-datum'), zeit = form.querySelector('#b-zeit');
  var tage = [], d = new Date(); d.setHours(12, 0, 0, 0);
  // Abholung auch heute möglich, frühestens 15 Minuten nach der Bestellung
  function heuteNochFrei(x) { var j = new Date(); return slots(x, 30).some(function (z) { return minuten(z) >= j.getHours() * 60 + j.getMinutes() + VORLAUF; }); }
  for (var i = 0; tage.length < 12 && i < 30; i++) { var x = new Date(d); x.setDate(d.getDate() + i); if (i === 0 ? heuteNochFrei(x) : slots(x, 30).length) tage.push(x); }
  tag.innerHTML = tage.map(function (x) { return '<option value="' + isoDatum(x) + '">' + (isoDatum(x) === isoDatum(new Date()) ? 'Heute' : TAGE[x.getDay()]) + ', ' + x.toLocaleDateString('de-AT', { day: 'numeric', month: 'long' }) + '</option>'; }).join('');
  function zeiten() { fuelleZeiten(zeit, new Date(tag.value + 'T12:00'), 30, true); }
  tag.addEventListener('change', zeiten); zeiten();

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var status = form.querySelector('.form-status'), k = lies();
    if (!k.length) { status.className = 'form-status fehler'; status.textContent = 'Bitte legen Sie zuerst Fleisch in den Warenkorb.'; return; }
    if (!form.checkValidity()) { form.reportValidity(); return; }
    var f = form.elements;
    var daten = { name: f['name'].value.trim(), email: f['email'].value.trim(), tel: f['tel'].value.trim(), msg: f['msg'].value.trim(), website: f['website'].value,
      abholung: { datum: tag.value, zeit: zeit.value }, zahlung: (form.querySelector('input[name=zahlung]:checked') || {}).value || 'abholung', positionen: k };
    sende(form, daten, function (a) {
      schreib([]); korbZeichnen();
      var wann = new Date(tag.value + 'T12:00').toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long' });
      form.innerHTML = '<div class="danke"><h3>¡Muchas gracias!</h3><p>Ihre Bestellung' + (a.nr ? ' <strong>' + a.nr + '</strong>' : '') + ' ist bei uns eingegangen.</p><p>Abholung: ' + wann + ', ' + daten.abholung.zeit + ' Uhr im Gaucho, Rheinstraße 89, Fußach. Bezahlung bei Abholung, bar oder mit Karte.</p><p>Bei Fragen melden wir uns bei Ihnen. Sie erreichen uns unter +43 5578 73027.</p></div>';
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, form.querySelector('[data-bestellen]'));
  });
})();
