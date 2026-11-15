(() => {
  "use strict";

  const S = window.SITE;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const live = S.apartments.filter((a) => a.status === "live");

  /* ---------- Formate ---------- */
  const money = new Intl.NumberFormat(S.locale, { style: "currency", currency: S.currency, maximumFractionDigits: 0 });
  const fmtShort = new Intl.DateTimeFormat(S.locale, { day: "numeric", month: "short" });
  const fmtDay = new Intl.DateTimeFormat(S.locale, { weekday: "short", day: "numeric", month: "short" });
  const fmtLong = new Intl.DateTimeFormat(S.locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const fmtMonth = new Intl.DateTimeFormat(S.locale, { month: "long", year: "numeric" });
  const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const nightsLabel = (n) => (n === 1 ? "1 Nacht" : `${n} Nächte`);
  const guestsLabel = (n) => (n === 1 ? "1 Gast" : `${n} Gäste`);

  // Lokale Fotos haben eine kleine Fassung im Unterordner "klein"
  const img = (src, w) => (w <= 500 && src.startsWith("assets/fotos/") ? src.replace("assets/fotos/", "assets/fotos/klein/") : src);

  /* ---------- Datum ---------- */
  const pad = (n) => String(n).padStart(2, "0");
  const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const diffDays = (a, b) => Math.round((b - a) / 864e5);
  const now = new Date();
  let today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let maxDate = addDays(today, 365);
  const monthStart = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

  /* ---------- Testanfragen (nur im Browser gespeichert) ---------- */
  const STORE_KEY = "site-demo-bookings";
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch { return []; } },
    add(b) { try { localStorage.setItem(STORE_KEY, JSON.stringify([...this.get(), b])); } catch { /* Speicher nicht verfügbar */ } },
    clear() { try { localStorage.removeItem(STORE_KEY); } catch { /* Speicher nicht verfügbar */ } },
  };

  /* ---------- Belegung und Preis ---------- */
  function blocked(a) {
    if (a._blocked) return a._blocked;
    const set = new Set();
    const addRange = (from, to) => { for (let d = from; d < to; d = addDays(d, 1)) set.add(key(d)); };
    (a.booked || []).forEach(([f, t]) => addRange(parse(f), parse(t)));
    if (api.online) return (a._blocked = set);
    if (S.preview) (a.sampleBookedOffsets || []).forEach(([f, t]) => addRange(addDays(today, f), addDays(today, t)));
    store.get().filter((b) => b.apt === a.id).forEach((b) => addRange(parse(b.in), parse(b.out)));
    return (a._blocked = set);
  }
  const isFree = (a, d) => d >= today && d <= maxDate && !blocked(a).has(key(d));

  // Letzter möglicher Abreisetag für eine Anreise: der erste belegte Tag danach
  function limitFor(a, checkin) {
    for (let d = addDays(checkin, 1); d <= maxDate; d = addDays(d, 1)) if (blocked(a).has(key(d))) return d;
    return maxDate;
  }
  // Tagesdaten vom Server: [Preis pro Nacht auf Booking.com ohne Rabatt, Mindestaufenthalt]
  const dayData = (a, d) => (a.days && a.days[key(d)]) || null;
  const minFor = (a, d) => { const x = dayData(a, d); return x && x[1] > 0 ? x[1] : a.minNights; };

  function rangeOk(a, i, o) {
    if (!i || !o || !isFree(a, i)) return false;
    return o > i && o <= limitFor(a, i) && diffDays(i, o) >= minFor(a, i);
  }
  function nextFree(a) {
    for (let d = today; d <= maxDate; d = addDays(d, 1)) {
      if (isFree(a, d) && diffDays(d, limitFor(a, d)) >= minFor(a, d)) return d;
    }
    return null;
  }
  // Preis je Personenzahl, im Verhältnis zum Preis für 2 Gäste (gleiche Rechnung wie auf dem Server)
  const guestFactor = (a, g) => (a.occupancy && a.occupancy[g]) || 1;

  // Gesamtpreis: dieselbe Rechnung wie auf dem Server (_worker.js, quote)
  // Vergleich = Booking.com mit Genius-Rabatt (10 % auf die Nächte, Reinigung ohne Rabatt),
  // Direktpreis = 5 % darunter.
  function quote(a, i, o, guests = state.guests) {
    const f = guestFactor(a, guests);
    let n = 0, nights = 0, fixed = 0, complete = !!a.days;
    for (let d = i; d < o; d = addDays(d, 1)) {
      n++;
      const x = dayData(a, d);
      if (!x || x[0] === null) complete = false;
      nights += x && x[0] ? x[0] : 0;
      const wd = d.getDay();
      fixed += wd === 5 || wd === 6 ? a.price.weekend : a.price.night;
    }
    let compare, total;
    if (complete) {
      const genius = (nights * (a.geniusFactor || 1) + (a.bookingClean || 0)) * f;
      compare = Math.round(genius);
      total = Math.round(genius * (a.directFactor || 1));
    } else {
      compare = Math.round(n * (a.price.compare || 0) * f);
      total = Math.round(fixed * f) + a.price.cleaning;
    }
    // Ersparnis gegenüber dem Genius-Preis auf Booking.com, als Betrag
    return { n, sum: total, discount: 0, cleaning: 0, total, saving: Math.max(0, compare - total) };
  }

  // Ist die Seite online (mit Serverfunktionen), kommen Kalender und Preise vom Server
  // und beim Buchen wird sofort bezahlt. Ohne Server läuft die Vorschau.
  const api = { online: false, down: false };
  // Die Vorschau ohne Server gibt es nur auf dem eigenen Rechner, nie auf der veröffentlichten Seite
  const isLocal = ["localhost", "127.0.0.1", ""].includes(location.hostname);
  let submitting = false;

  const contactLine = `Ruf uns an unter ${S.contact.phone} oder schreib an ${S.contact.email}.`;

  /* ---------- Zustand ---------- */
  const state = { apt: live[0], in: null, out: null, guests: 2, view: monthStart(today), step: 1, hint: "", done: null };

  /* ---------- Reveal ---------- */
  const io = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12 })
    : null;
  const observe = (root = document) => $$("[data-reveal]:not(.in)", root).forEach((el) => (io ? io.observe(el) : el.classList.add("in")));

  /* ---------- Marke, Kontakt, Bilder ---------- */
  function initStatic() {
    $$("[data-brand]").forEach((el) => (el.textContent = S.brand.name));
    document.title = document.title.replace("Quartier", S.brand.name);
    $("#year").textContent = today.getFullYear();

    const ph = (t) => `<span class="ph-mark">{{${t}}}</span>`;
    $("#contact-email").innerHTML = S.contact.email ? `<a href="mailto:${esc(S.contact.email)}">${esc(S.contact.email)}</a>` : ph("Mailadresse");
    $("#contact-phone").innerHTML = S.contact.phone ? `<a href="tel:${esc(S.contact.phone.replace(/\s/g, ""))}">${esc(S.contact.phone)}</a>` : ph("Telefon");

    const ad = S.address;
    $("#contact-address").innerHTML = `${esc(ad.street)}<br>${esc(ad.city)}, ${esc(ad.country)}`;
    $("#place-img").src = img(S.placePhoto.src, 1200);
    $("#place-img").alt = S.placePhoto.alt;
    $("#place-addr").href = S.mapUrl;
    $("#place-addr span").textContent = `${ad.street}, ${ad.city}`;
    $("#proof-rating").textContent = `${S.rating.score} bei ${S.rating.count} Bewertungen auf ${S.rating.source}`;

    const hero = $("#hero-img");
    const ready = () => document.documentElement.classList.add("is-ready");
    hero.addEventListener("load", ready, { once: true });
    hero.addEventListener("error", ready, { once: true });
    setTimeout(ready, 1500);
    hero.src = img(S.heroPhoto.src, 2000);
    $("#cta-img").src = img(S.ctaPhoto.src, 1600);
  }

  /* ---------- Wohnungen ---------- */
  function freeLabel(a) {
    const d = nextFree(a);
    if (api.down) return "Buchung gerade nicht erreichbar";
    if (!d) return "Aktuell ausgebucht";
    return diffDays(today, d) === 0 ? "Ab heute frei" : `Frei ab ${fmtShort.format(d)}`;
  }

  function aptHTML(a, i) {
    if (a.status !== "live") {
      const p = a.photos[0];
      return `
      <article class="soon" data-reveal id="apt-${a.id}">
        <div class="soon-media"><img src="${img(p.src, 900)}" alt="${esc(p.alt)}" loading="lazy"><span class="chip caption-3">Kommt bald</span></div>
        <div class="soon-body">
          <p class="caption-1 muted">${esc(a.label)}</p>
          <h3 class="heading-3">${esc(a.name)}</h3>
          <p class="body-3 muted">${esc(a.text)}</p>
          <a class="btn btn-primary" href="mailto:${esc(S.contact.email)}?subject=${encodeURIComponent("Bitte Bescheid geben: drittes Apartment")}"><i class="ph ph-envelope-simple" aria-hidden="true"></i> Per Mail vormerken</a>
        </div>
      </article>`;
    }
    const f = a.facts;
    return `
    <article class="apt ${i % 2 ? "apt--flip" : ""}" data-reveal id="apt-${a.id}" data-apt="${a.id}">
      <div class="apt-media">
        <div class="apt-main">
          <button type="button" class="apt-zoom" aria-label="Fotos groß ansehen: ${esc(a.name)}"><img data-main src="${img(a.photos[0].src, 1400)}" alt="${esc(a.photos[0].alt)}" loading="lazy"></button>
          <span class="chip chip--zoom caption-4" aria-hidden="true"><i class="ph ph-arrows-out"></i> Vergrößern</span>
          <span class="chip caption-4"><i class="ph ph-images" aria-hidden="true"></i> ${a.photos.length} Fotos</span>
        </div>
        <div class="apt-thumbs" role="group" aria-label="Fotos: ${esc(a.name)}">
          ${a.photos.slice(0, 5).map((p, j) => `<button type="button" class="thumb ${j ? "" : "is-active"}" data-photo="${j}" aria-label="Foto ${j + 1}: ${esc(p.alt)}"><img src="${img(p.src, 320)}" alt="" loading="lazy"></button>`).join("")}
        </div>
      </div>
      <div class="apt-info">
        <div class="apt-top">
          <div class="apt-meta caption-1"><span>${esc(a.label)}</span><span class="apt-free" data-free><span class="dot"></span> <span>${freeLabel(a)}</span></span></div>
          <h3 class="heading-3">${esc(a.name)}</h3>
          <p class="title-2">${esc(a.tagline)}</p>
          <p class="body-3 muted">${esc(a.text)}</p>
        </div>
        <ul class="apt-facts">
          <li class="chip caption-1"><i class="ph ph-ruler" aria-hidden="true"></i> ${f.size} m²</li>
          <li class="chip caption-1"><i class="ph ph-users" aria-hidden="true"></i> ${f.guestsText ? esc(f.guestsText) : `bis ${guestsLabel(f.guests)}`}</li>
          <li class="chip caption-1"><i class="ph ph-bed" aria-hidden="true"></i> ${esc(f.bedrooms)}</li>
          <li class="chip caption-1"><i class="ph ph-bathtub" aria-hidden="true"></i> ${esc(f.baths)}</li>
        </ul>
        <ul class="apt-amen">
          ${a.amenities.map(([icon, label]) => `<li class="body-6"><i class="ph ph-${icon}" aria-hidden="true"></i> ${esc(label)}</li>`).join("")}
        </ul>
        <div class="apt-buy">
          <div class="apt-price"><span class="heading-5">ab ${money.format(a.price.night)}${a.price.compare > a.price.night ? ` <s class="body-6 muted" aria-label="statt ${money.format(a.price.compare)} auf Booking.com mit Genius-Rabatt">${money.format(a.price.compare)}</s>` : ""}</span><span class="caption-2 muted">pro Nacht für 2 Gäste, Endreinigung inklusive, buchbar ab ${nightsLabel(a.minNights)}</span>${a.price.compare > a.price.night ? `<span class="caption-1 save-text">Du sparst ${money.format(a.price.compare - a.price.night)} pro Nacht gegenüber Booking.com, auch mit Genius-Rabatt</span>` : ""}</div>
          <button class="btn btn-primary btn-lg" type="button" data-book="${a.id}">Termine wählen</button>
        </div>
      </div>
    </article>`;
  }

  function renderApartments() {
    const list = $("#apt-list");
    list.innerHTML = S.apartments.map(aptHTML).join("");
    observe(list);
  }
  function refreshFree() {
    live.forEach((a) => { const el = $(`#apt-${a.id} [data-free] span:last-child`); if (el) el.textContent = freeLabel(a); });
  }

  function initApartmentEvents() {
    const list = $("#apt-list");
    list.addEventListener("click", (e) => {
      const zoom = e.target.closest(".apt-zoom");
      if (zoom) {
        const zc = zoom.closest("[data-apt]");
        openLightbox(live.find((x) => x.id === zc.dataset.apt), +(zc.dataset.idx || 0));
        return;
      }
      const thumb = e.target.closest(".thumb");
      if (!thumb) return;
      thumb.closest("[data-apt]").dataset.idx = thumb.dataset.photo;
      const card = thumb.closest("[data-apt]");
      const a = live.find((x) => x.id === card.dataset.apt);
      const p = a.photos[+thumb.dataset.photo];
      const main = $("[data-main]", card);
      $$(".thumb", card).forEach((t) => t.classList.toggle("is-active", t === thumb));
      main.classList.add("is-swapping");
      const next = new Image();
      next.onload = next.onerror = () => { main.src = next.src; main.alt = p.alt; main.classList.remove("is-swapping"); };
      next.src = img(p.src, 1400);
    });
    list.addEventListener("submit", (e) => {
      const form = e.target.closest("[data-notify]");
      if (!form) return;
      e.preventDefault();
      const input = form.elements.email;
      const msg = form.nextElementSibling;
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value.trim());
      input.setAttribute("aria-invalid", String(!ok));
      msg.className = `form-msg caption-2 ${ok ? "is-ok" : "is-error"}`;
      msg.textContent = ok
        ? `Eingetragen. Wir melden uns, sobald ${form.dataset.notify} buchbar ist.`
        : "Bitte gib eine gültige Mailadresse ein, zum Beispiel name@beispiel.de.";
      if (ok) form.reset(); else input.focus();
    });
  }

  /* ---------- Fotos groß ansehen ---------- */
  const lb = $("#lightbox");
  let lbApt = null, lbIdx = 0;
  function showLightbox() {
    const p = lbApt.photos[lbIdx];
    const el = $("#lb-img");
    el.src = img(p.src, 2000);
    el.alt = p.alt;
    $("#lb-cap").textContent = `${lbApt.name} · ${p.alt} · ${lbIdx + 1} von ${lbApt.photos.length}`;
  }
  function openLightbox(a, i) {
    lbApt = a; lbIdx = Math.min(i, a.photos.length - 1);
    showLightbox();
    lb.showModal();
    document.documentElement.classList.add("is-locked");
  }
  function initLightbox() {
    const step = (n) => { lbIdx = (lbIdx + n + lbApt.photos.length) % lbApt.photos.length; showLightbox(); };
    $("#lb-prev").addEventListener("click", () => step(-1));
    $("#lb-next").addEventListener("click", () => step(1));
    $("#lb-close").addEventListener("click", () => lb.close());
    lb.addEventListener("click", (e) => { if (e.target === lb || e.target.tagName === "FIGURE") lb.close(); });
    lb.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") step(-1); if (e.key === "ArrowRight") step(1); });
    lb.addEventListener("close", () => { if (!dlg.open) document.documentElement.classList.remove("is-locked"); });
  }

  /* ---------- Vorteile, Bewertungen, Fragen ---------- */
  // Preisbeispiel: 3 Nächte, 2 Gäste, mit derselben Rechnung wie im Buchungsfenster
  function renderReceipt() {
    const a = live[0];
    const n = 3;
    let start = addDays(today, 7);
    for (let i = 0; i < 60; i++) { const d = addDays(today, 7 + i); if (rangeOk(a, d, addDays(d, n))) { start = d; break; } }
    const q = quote(a, start, addDays(start, n), 2);
    $("#receipt").innerHTML = `
      <p class="caption-3 muted">Beispiel: ${esc(a.name)}, ${nightsLabel(n)} ab ${fmtShort.format(start)}, 2 Gäste</p>
      <div class="receipt-row body-5"><span>${nightsLabel(n)}</span><span>${money.format(q.total)}</span></div>
      <div class="receipt-row body-5"><span>Endreinigung</span><span>inklusive</span></div>
      <div class="receipt-row body-5"><span>Gebühren für die Zahlung</span><span>inklusive</span></div>
      <div class="receipt-row body-5 is-gone"><span>Servicegebühr der Plattform</span><span>entfällt</span></div>
      <hr>
      <div class="receipt-row body-1"><span>Gesamt</span><span>${money.format(q.total)}</span></div>
      ${q.saving ? `<p class="save-note caption-1"><i class="ph ph-tag" aria-hidden="true"></i> Du sparst ${money.format(q.saving)} gegenüber Booking.com, auch mit Genius-Rabatt</p>` : ""}`;
  }


  function renderPlaces() {
    const list = $("#place-list");
    list.innerHTML = S.places.map((p, i) => `
      <article class="card place-item" data-reveal style="--d:${i}">
        <span class="icon-tile"><i class="ph ph-${p.icon}" aria-hidden="true"></i></span>
        <div><p class="caption-3 place-dist">${esc(p.dist)}</p><h3 class="heading-6">${esc(p.name)}</h3></div>
        <p class="body-6 muted">${esc(p.text)}</p>
      </article>`).join("");
    observe(list);
  }

  function renderRating() {
    const r = S.rating;
    const box = $("#rating");
    box.innerHTML = `
      <article class="card rating-main" data-reveal>
        <p class="rating-score"><span class="heading-1">${esc(r.score)}</span><span class="title-2 muted">von 10</span></p>
        <div><h3 class="heading-5">${esc(r.label)}</h3>
          <p class="body-6 muted">${r.count} Bewertungen auf ${esc(r.source)}, Stand ${esc(r.asOf)}</p></div>
        <a class="btn btn-ghost" href="${esc(r.url)}" target="_blank" rel="noopener">Alle Bewertungen lesen <i class="ph ph-arrow-up-right" aria-hidden="true"></i></a>
      </article>
      <div class="rating-side">
        <ul class="rating-grid">
          ${r.categories.map(([label, score], i) => `<li class="card rating-tile" data-reveal style="--d:${i % 3}"><span class="heading-4">${esc(score)}</span><span class="caption-1 muted">${esc(label)}</span></li>`).join("")}
        </ul>
        <div class="card praise" data-reveal>
          <p class="title-3">Das heben Gäste besonders hervor</p>
          <ul>${r.highlights.map((h) => `<li class="chip caption-1"><i class="ph ph-check" aria-hidden="true"></i> ${esc(h)}</li>`).join("")}</ul>
        </div>
      </div>`;
    observe(box);
  }

  function renderFaq() {
    const list = $("#faq-list");
    list.innerHTML = S.faq.map(([q, a], i) => `
      <details name="faq" data-reveal style="--d:${Math.min(i, 4)}">
        <summary class="title-3"><span>${esc(q)}</span><i class="ph ph-plus" aria-hidden="true"></i></summary>
        <p class="answer body-3">${esc(a)}</p>
      </details>`).join("");
    observe(list);
  }

  /* ---------- Suchleiste im Hero ---------- */
  const sbApt = $("#sb-apt"), sbGuests = $("#sb-guests");
  function fillGuests() {
    const max = state.apt.facts.guests;
    state.guests = Math.min(state.guests, max);
    sbGuests.innerHTML = Array.from({ length: max }, (_, i) => `<option value="${i + 1}">${guestsLabel(i + 1)}</option>`).join("");
    sbGuests.value = state.guests;
  }
  function syncSearchbar() {
    sbApt.value = state.apt.id;
    fillGuests();
    $("#sb-dates-value").textContent = state.in && state.out ? `${fmtShort.format(state.in)} bis ${fmtShort.format(state.out)}` : "Termine wählen";
  }
  function initSearchbar() {
    sbApt.innerHTML = live.map((a) => `<option value="${a.id}">${esc(a.name)} · ab ${money.format(a.price.night)}</option>`).join("");
    syncSearchbar();
    sbApt.addEventListener("change", () => { setApt(live.find((a) => a.id === sbApt.value)); syncSearchbar(); });
    sbGuests.addEventListener("change", () => (state.guests = +sbGuests.value));
    $("#sb-dates").addEventListener("click", () => openBooking());
    $("#searchbar").addEventListener("submit", (e) => { e.preventDefault(); openBooking(); });
  }

  /* ---------- Buchung ---------- */
  const dlg = $("#booking");
  const side = $("#bk-side");
  const months = $("#cal-months");
  const form = $("#pane-2");

  function setApt(a) {
    state.apt = a;
    state.guests = Math.min(state.guests, a.facts.guests);
    if (state.in && !(state.out ? rangeOk(a, state.in, state.out) : isFree(a, state.in))) { state.in = state.out = null; }
    state.hint = "";
  }

  function openBooking(aptId) {
    if (aptId) setApt(live.find((a) => a.id === aptId) || state.apt);
    if (state.step === 3) { state.step = 1; state.in = state.out = null; }
    state.hint = "";
    state.view = monthStart(state.in || nextFree(state.apt) || today);
    renderDialog();
    if (!dlg.open) dlg.showModal();
    document.documentElement.classList.add("is-locked");
    closeMenu();
  }

  function renderDialog() {
    $$("#bk-steps li").forEach((li) => {
      const s = +li.dataset.s;
      li.classList.toggle("is-on", s === state.step);
      li.classList.toggle("is-done", s < state.step);
      if (s === state.step) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });
    $("#pane-1").hidden = state.step !== 1;
    form.hidden = state.step !== 2;
    $(".bk-main").hidden = state.step === 3;
    side.hidden = state.step === 3;
    $("#pane-3").hidden = state.step !== 3;
    if (state.step === 1) { renderTabs(); renderCal(); }
    if (state.step === 3) renderDone(); else renderSide();
    $("#bk-body").scrollTop = 0;
  }

  function renderTabs() {
    $("#bk-apts").innerHTML = live.map((a) => `<button type="button" aria-pressed="${a === state.apt}" data-tab="${a.id}">${esc(a.name)}</button>`).join("");
  }

  function dayHTML(d) {
    const a = state.apt, k = key(d);
    const off = api.down || d < today || d > maxDate;
    const booked = blocked(a).has(k);
    const picking = state.in && !state.out;
    // Beim Wählen der Abreise darf auch der erste belegte Tag gewählt werden
    const asCheckout = picking && d > state.in && d <= limitFor(a, state.in);
    const enabled = !off && (!booked || asCheckout);
    const cls = ["day"];
    if (booked && !asCheckout && !off) cls.push("is-booked");
    if (+d === +today) cls.push("is-today");
    if (state.in && +d === +state.in) cls.push("is-start");
    if (state.out && +d === +state.out) cls.push("is-end");
    if (state.in && state.out && d > state.in && d < state.out) cls.push("is-range");
    const label = fmtLong.format(d) + (off ? ", nicht buchbar" : booked && !asCheckout ? ", belegt" : "");
    return `<button type="button" class="${cls.join(" ")}" data-k="${k}" ${enabled ? "" : "disabled"} aria-label="${label}">${d.getDate()}</button>`;
  }

  function monthHTML(first) {
    const y = first.getFullYear(), m = first.getMonth();
    const lead = (first.getDay() + 6) % 7;
    const count = new Date(y, m + 1, 0).getDate();
    let days = "<span></span>".repeat(lead);
    for (let d = 1; d <= count; d++) days += dayHTML(new Date(y, m, d));
    return `<div class="cal-month"><p class="cal-title title-3">${fmtMonth.format(first)}</p>
      <div class="cal-week" aria-hidden="true">${WEEKDAYS.map((w) => `<span>${w}</span>`).join("")}</div>
      <div class="cal-days">${days}</div></div>`;
  }

  function renderCal(focusKey) {
    const v = state.view;
    months.innerHTML = monthHTML(v) + monthHTML(new Date(v.getFullYear(), v.getMonth() + 1, 1));
    months.classList.toggle("has-range", !!(state.in && state.out));
    $("#cal-prev").disabled = v <= monthStart(today);
    $("#cal-next").disabled = new Date(v.getFullYear(), v.getMonth() + 1, 1) >= monthStart(maxDate);
    if (focusKey) { const el = $(`.day[data-k="${focusKey}"]`, months); if (el && !el.disabled) el.focus(); }
  }

  function pick(d) {
    const a = state.apt;
    const picking = state.in && !state.out;
    if (picking && d > state.in && d <= limitFor(a, state.in)) {
      if (diffDays(state.in, d) < minFor(a, state.in)) {
        state.hint = `Mindestaufenthalt bei dieser Anreise: ${nightsLabel(minFor(a, state.in))}. Wähle eine spätere Abreise.`;
      } else { state.out = d; state.hint = ""; }
    } else {
      state.in = d; state.out = null; state.hint = "";
      if (diffDays(d, limitFor(a, d)) < minFor(a, d)) {
        state.hint = minFor(a, d) > 1 ? `Ab diesem Tag sind keine ${minFor(a, d)} Nächte am Stück frei. Wähle eine andere Anreise.` : "Ab diesem Tag ist nichts mehr frei. Wähle eine andere Anreise.";
      }
    }
    renderCal(key(d));
    renderSide();
  }

  function preview(hoverKey) {
    const picking = state.in && !state.out;
    const inK = state.in ? key(state.in) : "";
    const limK = picking ? key(limitFor(state.apt, state.in)) : "";
    $$(".day", months).forEach((el) => {
      const k = el.dataset.k;
      el.classList.toggle("is-preview", !!(picking && hoverKey && hoverKey <= limK && k > inK && k <= hoverKey));
    });
  }

  function renderSide(focusSel) {
    const a = state.apt;
    const q = state.in && state.out ? quote(a, state.in, state.out) : null;
    // Ein Klick auf Anreise oder Abreise führt direkt zurück in den Kalender
    const box = (label, d) => `<button type="button" class="sum-box" data-edit-dates aria-label="${label} ändern"><span class="caption-4">${label}</span><span class="body-5">${d ? fmtDay.format(d) : "Datum wählen"}</span><i class="ph ph-pencil-simple" aria-hidden="true"></i></button>`;
    const wk = S.weeklyDiscount;
    side.innerHTML = `
      <div class="sum-apt"><img src="${img(a.photos[0].src, 160)}" alt="">
        <div><p class="title-3">${esc(a.name)}</p><p class="caption-2 muted">${a.facts.size} m² · ${a.facts.guestsText ? esc(a.facts.guestsText) : `bis ${guestsLabel(a.facts.guests)}`}</p></div></div>
      <div class="sum-dates">${box("Anreise", state.in)}${box("Abreise", state.out)}</div>
      <div class="sum-guests"><span class="body-5">Gäste</span>
        <div class="stepper">
          <button type="button" class="icon-btn" data-g="-1" aria-label="Ein Gast weniger" ${state.guests <= 1 ? "disabled" : ""}><i class="ph ph-minus" aria-hidden="true"></i></button>
          <output class="body-4" aria-live="polite">${state.guests}</output>
          <button type="button" class="icon-btn" data-g="1" aria-label="Ein Gast mehr" ${state.guests >= a.facts.guests ? "disabled" : ""}><i class="ph ph-plus" aria-hidden="true"></i></button>
        </div></div>
      ${q ? `<div class="sum">
        <div class="sum-row body-6"><span>${nightsLabel(q.n)}</span><span>${money.format(q.sum)}</span></div>
        ${q.discount ? `<div class="sum-row body-6 is-save"><span>Rabatt ab ${wk.nights} Nächten</span><span>minus ${money.format(q.discount)}</span></div>` : ""}
        <div class="sum-row body-6"><span>Endreinigung</span><span>${q.cleaning ? money.format(q.cleaning) : "inklusive"}</span></div>
        <div class="sum-row body-6"><span>Gebühren für die Zahlung</span><span>inklusive</span></div>
        <hr>
        <div class="sum-row is-total"><span class="body-1">Gesamt</span><span class="heading-5">${money.format(q.total)}</span></div>
        ${q.saving ? `<p class="save-note caption-1"><i class="ph ph-tag" aria-hidden="true"></i> Du sparst ${money.format(q.saving)} gegenüber Booking.com, auch mit Genius-Rabatt</p>` : ""}
      </div>` : `<p class="sum-empty body-6">Wähle Anreise und Abreise im Kalender. Du siehst dann sofort den Endpreis.</p>`}
      <p class="sum-hint caption-2" role="alert">${esc(state.hint)}</p>
      <div class="sum-cta">
        <button type="button" class="btn btn-primary btn-lg" id="bk-next" ${q && !api.down ? "" : "disabled"}>${state.step === 1 ? "Weiter zu deinen Daten" : "Zahlungspflichtig buchen"}</button>
        <p class="caption-5">${api.down ? `Die Buchung ist gerade nicht erreichbar. ${esc(contactLine)}` : state.step === 2 ? `Kostenlos stornierbar bis 7 Tage vor der Anreise. Mit der Buchung akzeptierst du unsere <a href="rechtliches.html#bedingungen" target="_blank" rel="noopener">Buchungsbedingungen</a>.` : "Im Preis ist alles enthalten, auch die Gebühren für die Zahlung. Du zahlst sicher mit Karte, Apple Pay, PayPal oder Klarna."}</p>
      </div>`;
    if (focusSel) { const el = $(focusSel, side); if (el && !el.disabled) el.focus(); }
  }

  /* ---------- Formular ---------- */
  const RULES = {
    first: (v) => (v ? "" : "Bitte gib deinen Vornamen ein."),
    last: (v) => (v ? "" : "Bitte gib deinen Nachnamen ein."),
    email: (v) => (!v ? "Bitte gib deine Mailadresse ein." : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? "" : "Diese Mailadresse sieht unvollständig aus."),
    phone: (v) => (!v || /^[+\d][\d\s/()]{5,}$/.test(v) ? "" : "Bitte nur Ziffern, Leerzeichen und ein Plus am Anfang."),
    consent: (_, el) => (el.checked ? "" : "Bitte stimme der Verarbeitung deiner Angaben zu."),
  };
  function validateField(el) {
    const rule = RULES[el.name];
    if (!rule) return true;
    const msg = rule(el.value.trim(), el);
    const wrap = el.closest("label");
    wrap.classList.toggle("is-invalid", !!msg);
    el.setAttribute("aria-invalid", String(!!msg));
    $(".err", wrap).textContent = msg;
    return !msg;
  }
  function validateForm() {
    const bad = [...form.elements].filter((el) => el.name && !validateField(el));
    if (bad[0]) bad[0].focus();
    return !bad.length;
  }

  async function submit() {
    if (submitting || !validateForm()) return;
    submitting = true;
    try { await doSubmit(); } finally { submitting = false; }
  }

  async function doSubmit() {
    const a = state.apt, q = quote(a, state.in, state.out);
    const data = Object.fromEntries(new FormData(form));
    const ref = `${S.brand.name.slice(0, 2).toUpperCase()}${String(today.getFullYear()).slice(2)}${pad(today.getMonth() + 1)}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const payload = {
      ref, apartment: a.name, checkin: key(state.in), checkout: key(state.out), nights: q.n, guests: state.guests,
      total: q.total, currency: S.currency,
      guest: { first: data.first.trim(), last: data.last.trim(), email: data.email.trim(), phone: (data.phone || "").trim(), note: (data.note || "").trim() },
    };
    const btn = $("#bk-next");
    btn.classList.add("is-loading");
    btn.textContent = "Einen Moment …";
    if (api.online) {
      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ apt: a.id, checkin: payload.checkin, checkout: payload.checkout, guests: state.guests, guest: payload.guest, consent: true }),
        });
        const out = await res.json().catch(() => ({}));
        if (res.ok && out.url) {
          try { sessionStorage.setItem("open-checkout", out.id || ""); } catch { /* ohne Speicher geht es auch */ }
          location.href = out.url;
          return;
        }
        if (res.status === 400) {
          state.in = state.out = null; state.step = 1;
          await loadAvailability();
          state.hint = "Diese Termine sind nicht mehr buchbar. Bitte wähle andere.";
          renderDialog();
          return;
        }
        if (res.status === 409) {
          state.in = state.out = null; state.step = 1;
          await loadAvailability();
          state.hint = "Dieser Zeitraum wurde gerade vergeben. Bitte wähle andere Termine.";
          renderDialog();
          return;
        }
        throw new Error(out.error || String(res.status));
      } catch {
        state.hint = `Die Bezahlseite ist gerade nicht erreichbar. Bitte versuche es noch einmal. ${contactLine}`;
        renderSide("#bk-next");
        return;
      }
    }
    try {
      if (S.bookingEndpoint) {
        const res = await fetch(S.bookingEndpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(String(res.status));
      } else {
        await new Promise((r) => setTimeout(r, 700));
        store.add({ apt: a.id, in: payload.checkin, out: payload.checkout });
        a._blocked = null;
      }
    } catch {
      state.hint = `Die Buchung hat nicht geklappt. Bitte versuche es noch einmal. ${contactLine}`;
      renderSide("#bk-next");
      return;
    }
    state.done = { ...payload, from: state.in, to: state.out };
    state.step = 3;
    state.in = state.out = null;
    form.reset();
    renderDialog();
    refreshFree();
    renderPill();
  }

  function renderDone() {
    const d = state.done;
    $("#pane-3").innerHTML = `
      <span class="done-icon"><i class="ph ph-check" aria-hidden="true"></i></span>
      <h3 class="heading-4" tabindex="-1" id="done-title">${d.paid === false ? "Deine Zahlung wird noch verarbeitet" : "Deine Buchung ist bestätigt"}</h3>
      <p class="body-3">${d.paid === false
        ? `Danke, ${esc(d.guest.first)}. Sobald die Zahlung eingegangen ist, ist dein Aufenthalt fest gebucht. Du bekommst die Bestätigung an ${esc(d.guest.email)}.`
        : `Danke, ${esc(d.guest.first)}. Die Zahlung ist eingegangen und dein Aufenthalt ist fest gebucht. Der Beleg geht an ${esc(d.guest.email)}.`}</p>
      <div class="done-card">
        <div><span class="caption-4">Apartment</span><span class="body-4">${esc(d.apartment)}</span></div>
        <div><span class="caption-4">Zeitraum</span><span class="body-4">${fmtShort.format(d.from)} bis ${fmtShort.format(d.to)} · ${nightsLabel(d.nights)}</span></div>
        <div><span class="caption-4">Gesamt</span><span class="body-4">${money.format(d.total)}</span></div>
      </div>
      <p class="caption-2">Vorgangsnummer ${esc(d.ref)}</p>
      ${api.online ? "" : `<div class="note caption-2"><i class="ph ph-info" aria-hidden="true"></i><span>Vorschau: Es wurde nichts bezahlt und nichts verschickt. Die Buchung ist nur in diesem Browser gespeichert und der Zeitraum im Kalender als belegt markiert.</span></div>`}
      <button type="button" class="btn btn-ghost btn-lg" id="bk-finish">Schließen</button>`;
    $("#done-title").focus();
  }

  function initBooking() {
    document.addEventListener("click", (e) => {
      const b = e.target.closest("[data-book]");
      if (b) openBooking(b.dataset.book || undefined);
    });
    $("#bk-close").addEventListener("click", () => dlg.close());
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener("close", () => { document.documentElement.classList.remove("is-locked"); syncSearchbar(); });

    $("#bk-apts").addEventListener("click", (e) => {
      const t = e.target.closest("[data-tab]");
      if (!t) return;
      setApt(live.find((a) => a.id === t.dataset.tab));
      state.view = monthStart(state.in || nextFree(state.apt) || today);
      renderTabs(); renderCal(); renderSide();
      $(`[data-tab="${t.dataset.tab}"]`).focus();
    });

    const shift = (n) => { state.view = new Date(state.view.getFullYear(), state.view.getMonth() + n, 1); renderCal(); };
    $("#cal-prev").addEventListener("click", () => shift(-1));
    $("#cal-next").addEventListener("click", () => shift(1));

    months.addEventListener("click", (e) => { const d = e.target.closest(".day"); if (d && !d.disabled) pick(parse(d.dataset.k)); });
    months.addEventListener("mouseover", (e) => { const d = e.target.closest(".day"); preview(d && !d.disabled ? d.dataset.k : ""); });
    months.addEventListener("focusin", (e) => { const d = e.target.closest(".day"); preview(d ? d.dataset.k : ""); });
    months.addEventListener("mouseleave", () => preview(""));

    side.addEventListener("click", (e) => {
      const g = e.target.closest("[data-g]");
      if (g) {
        state.guests = Math.max(1, Math.min(state.apt.facts.guests, state.guests + +g.dataset.g));
        renderSide(`[data-g="${g.dataset.g}"]`);
        return;
      }
      if (e.target.closest("[data-edit-dates]")) {
        if (state.step !== 1) { state.step = 1; state.hint = ""; renderDialog(); }
        state.view = monthStart(state.in || state.view);
        renderCal();
        $("#bk-body").scrollTop = 0;
        const first = $(".day.is-start", months) || $(".day:not([disabled])", months);
        if (first) first.focus();
        return;
      }
      if (e.target.closest("#bk-next")) {
        if (state.step === 1) {
          if (!rangeOk(state.apt, state.in, state.out)) return;
          state.step = 2; state.hint = "";
          renderDialog();
          form.elements.first.focus();
        } else if (state.step === 2) submit();
      }
    });

    $("#bk-back").addEventListener("click", () => { state.step = 1; state.hint = ""; renderDialog(); });
    form.addEventListener("submit", (e) => { e.preventDefault(); submit(); });
    form.addEventListener("focusout", (e) => { if (e.target.name && (e.target.value || e.target.closest(".is-invalid"))) validateField(e.target); });
    form.addEventListener("change", (e) => { if (e.target.name === "consent") validateField(e.target); });
    $("#pane-3").addEventListener("click", (e) => { if (e.target.closest("#bk-finish")) dlg.close(); });
  }

  /* ---------- Vorschauhinweis ---------- */
  function renderPill() {
    const pill = $("#preview-pill");
    if (!S.preview || api.online) { pill.hidden = true; return; }
    pill.hidden = false;
    pill.innerHTML = `<span class="dot" aria-hidden="true"></span><span>Vorschau · Kalender und Preise noch nicht final</span>${store.get().length ? '<button type="button" id="demo-reset">Testanfragen löschen</button>' : ""}`;
  }
  function initPill() {
    renderPill();
    $("#preview-pill").addEventListener("click", (e) => {
      if (!e.target.closest("#demo-reset")) return;
      store.clear();
      live.forEach((a) => (a._blocked = null));
      refreshFree();
      renderPill();
    });
  }

  /* ---------- Navigation ---------- */
  const toggle = $(".menu-toggle"), menu = $("#menu");
  function closeMenu() {
    if (!menu.classList.contains("is-open")) return;
    menu.classList.remove("is-open");
    menu.setAttribute("aria-hidden", "true");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Menü öffnen");
    if (!dlg.open) document.documentElement.classList.remove("is-locked");
  }
  function initNav() {
    toggle.addEventListener("click", () => {
      if (menu.classList.contains("is-open")) return closeMenu();
      menu.classList.add("is-open");
      menu.setAttribute("aria-hidden", "false");
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Menü schließen");
      document.documentElement.classList.add("is-locked");
    });
    menu.addEventListener("click", (e) => { if (e.target.closest("a")) closeMenu(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });

    if (!("IntersectionObserver" in window)) return;
    const links = $$(".nav-links a");
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((l) => (l.getAttribute("href") === `#${en.target.id}` ? l.setAttribute("aria-current", "true") : l.removeAttribute("aria-current")));
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    $$("main section[id]").forEach((s) => spy.observe(s));
  }

  /* ---------- Leitsatz: Wort für Wort ---------- */
  function initTagline() {
    const el = $("#tagline");
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map((w) => `<span class="w">${esc(w)}</span>`).join(" ");
    const spans = $$(".w", el);
    if (reduced) { spans.forEach((s) => s.classList.add("on")); return; }
    let shown = 0, ticking = false;
    const update = () => {
      ticking = false;
      const r = el.getBoundingClientRect(), vh = window.innerHeight;
      const start = vh * 0.85, end = vh * 0.4;
      const p = Math.max(0, Math.min(1, (start - r.top) / (r.height + start - end)));
      const n = Math.round(p * spans.length);
      for (; shown < n; shown++) spans[shown].classList.add("on");
      if (shown >= spans.length) window.removeEventListener("scroll", onScroll);
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
  }

  /* ---------- Server: Kalender, Preise, Rückkehr von der Bezahlseite ---------- */
  async function loadAvailability() {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 6000);
      const res = await fetch("/api/availability", { signal: ctl.signal, headers: { Accept: "application/json" } });
      clearTimeout(timer);
      if (!(res.headers.get("content-type") || "").includes("json")) {
        // Lokale Vorschau: kein Server vorhanden. Auf der echten Seite gilt das als Störung.
        if (!isLocal) { api.online = true; api.down = true; }
        return;
      }
      api.online = true;
      api.down = !res.ok;
      if (!res.ok) return;
      const data = await res.json();
      const srvToday = parse(data.today);
      if (+srvToday !== +today) { today = srvToday; maxDate = addDays(today, 365); state.view = monthStart(state.in || today); }
      live.forEach((a) => {
        const s = data.apartments[a.id];
        if (!s) return;
        a.booked = s.blocked; a.price = s.price; a.minNights = s.minNights; a.facts.guests = s.maxGuests; a.days = s.days || null; if (s.occupancy) a.occupancy = s.occupancy; a.bookingClean = s.bookingClean || 0; a.directFactor = s.directFactor || 1; a.geniusFactor = s.geniusFactor || 1; a._blocked = null;
      });
    } catch {
      // Nicht erreichbar: lokal bleibt die Vorschau, auf der echten Seite wird die Buchung gesperrt
      if (!isLocal) { api.online = true; api.down = true; }
    } finally {
      if (api.online) {
        if (state.in && !(state.out ? rangeOk(state.apt, state.in, state.out) : isFree(state.apt, state.in))) state.in = state.out = null;
        renderApartments();
        renderReceipt();
        $("#sb-apt").innerHTML = live.map((a) => `<option value="${a.id}">${esc(a.name)} · ab ${money.format(a.price.night)}</option>`).join("");
        syncSearchbar();
        renderPill();
        if (dlg.open && state.step !== 3) renderDialog();
      }
    }
  }

  // Hat der Gast die Bezahlseite verlassen, wird sein reservierter Termin sofort wieder frei
  async function releaseOpenCheckout() {
    let id = "";
    try { id = sessionStorage.getItem("open-checkout") || ""; sessionStorage.removeItem("open-checkout"); } catch { /* kein Speicher */ }
    if (!id) return;
    try {
      await fetch("/api/release", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: id }) });
    } catch { /* läuft sonst nach 30 Minuten von selbst ab */ }
    await loadAvailability();
  }

  async function handleReturn() {
    const q = new URLSearchParams(location.search);
    const status = q.get("buchung");
    if (!status) return;
    history.replaceState(null, "", location.pathname);
    if (status === "abgebrochen") {
      await releaseOpenCheckout();
      openBooking();
      state.hint = "Die Zahlung wurde abgebrochen. Es wurde nichts gebucht und nichts abgebucht. Bitte wähle deine Termine noch einmal.";
      renderSide();
      return;
    }
    try {
      const res = await fetch(`/api/booking?session_id=${encodeURIComponent(q.get("session_id") || "")}`, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(String(res.status));
      const d = await res.json();
      state.done = { paid: d.paid, apartment: d.apartment, nights: d.nights, total: d.total, ref: d.ref, guest: { first: d.first, email: d.email }, from: parse(d.checkin), to: parse(d.checkout) };
      state.step = 3;
      api.online = true;
      renderDialog();
      if (!dlg.open) dlg.showModal();
      document.documentElement.classList.add("is-locked");
    } catch {
      // Bestätigung nicht ladbar: dem Gast trotzdem sagen, woran er ist
      openBooking();
      state.hint = `Wir konnten deine Buchung gerade nicht anzeigen. Wenn die Zahlung durchging, bekommst du den Beleg per Mail. ${contactLine}`;
      renderSide();
    }
  }

  /* ---------- Start ---------- */
  initStatic();
  renderApartments();
  initApartmentEvents();
  initLightbox();
  renderReceipt();
  renderPlaces();
  renderRating();
  renderFaq();
  initSearchbar();
  initBooking();
  initPill();
  initNav();
  initTagline();
  observe();
  loadAvailability();
  handleReturn();
  // Zurück per Browser von der Bezahlseite: Reservierung lösen und den Button wieder freigeben
  window.addEventListener("pageshow", async (e) => {
    if (!e.persisted) return;
    submitting = false;
    await releaseOpenCheckout();
    if (dlg.open && state.step !== 3) renderDialog();
  });
})();
