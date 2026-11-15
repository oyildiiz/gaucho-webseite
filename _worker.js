/*
  GAUCHO HOME – Server (Cloudflare Pages, _worker.js)
  ---------------------------------------------------
  Aufgaben:
  - /api/availability  Kalender und Tagespreise aus Smoobu (inkl. Booking.com und Airbnb)
  - /api/checkout      Preis hier auf dem Server berechnen, Stripe-Bezahlseite öffnen,
                       Termin 30 Minuten reservieren
  - /api/release       Reservierung lösen, wenn der Gast die Bezahlseite verlässt
  - /api/booking       Nach der Zahlung: Buchung in Smoobu eintragen, Mails an Gast und an uns

  PREISREGEL
  Smoobu liefert den Preis pro Nacht, den Booking.com ohne Rabatt zeigt.
  Booking.com mit Genius = Nächte minus 10 %, Endreinigung ohne Rabatt.
  Unser Preis = 5 % unter dem Genius-Preis. Zahlungsgebühren sind darin enthalten.
  Ändern: GENIUS_FACTOR und DIRECT_FACTOR unten.

  Geheimnisse (Cloudflare → Pages → gauchohome → Einstellungen → Variablen):
  STRIPE_SECRET_KEY, SMOOBU_API_KEY, RESEND_API_KEY
  Optional: MAIL_TO (Standard info@gaucho.at), MAIL_FROM,
            SMOOBU_ID_FUENF / SMOOBU_ID_ZWEI (Smoobu-Nummer der Wohnung, sonst automatisch)
*/

const GENIUS_FACTOR = 0.9;   // Booking.com Genius-Rabatt: 10 %
const DIRECT_FACTOR = 0.95;  // wir: 5 % unter dem Genius-Preis
const HOLD_MINUTES = 30;
const DAYS_AHEAD = 365;
const MAIL_TO_DEFAULT = "info@gaucho.at";
const PHONE = "+43 676 915 0009";

const APARTMENTS = {
  "apartment-fuenf": {
    name: "Die Maisonette", maxGuests: 5, bookingClean: 30, minNights: 1,
    occupancy: { 1: 299 / 314, 2: 1, 3: 342 / 314, 4: 356 / 314, 5: 386 / 314 },
    env: "SMOOBU_ID_FUENF",
  },
  "apartment-zwei": {
    name: "Das Apartment", maxGuests: 2, bookingClean: 30, minNights: 1,
    occupancy: { 1: 262 / 274, 2: 1 },
    env: "SMOOBU_ID_ZWEI",
  },
};

/* ---------- Hilfen ---------- */
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const addDays = (d, n) => new Date(d.getTime() + n * 864e5);
const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && ymd(parse(s)) === s;
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const euro = (n) => new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" }).format(n);
function todayVienna() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return parse(p);
}

/* ---------- Smoobu ---------- */
async function smoobu(env, path, init = {}) {
  const res = await fetch(`https://login.smoobu.com/api/${path}`, {
    ...init,
    headers: { "Api-Key": env.SMOOBU_API_KEY, "Cache-Control": "no-cache", "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Smoobu ${path.split("?")[0]} ${res.status} ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

// Smoobu-Nummern unserer Wohnungen: aus den Variablen oder automatisch über die Gästezahl
let idCache = null;
async function smoobuIds(env) {
  if (idCache) return idCache;
  const ids = {};
  for (const [k, a] of Object.entries(APARTMENTS)) if (env[a.env]) ids[k] = String(env[a.env]);
  if (Object.keys(ids).length < Object.keys(APARTMENTS).length) {
    const list = (await smoobu(env, "apartments")).apartments || [];
    const details = await Promise.all(list.map((x) => smoobu(env, `apartments/${x.id}`).then((d) => ({ id: String(x.id), name: x.name, max: d?.rooms?.maxOccupancy || 0 }))));
    for (const [k, a] of Object.entries(APARTMENTS)) {
      if (ids[k]) continue;
      const hits = details.filter((d) => (a.maxGuests >= 3 ? d.max >= 3 : d.max > 0 && d.max <= 2) && !Object.values(ids).includes(d.id));
      if (hits.length !== 1) throw new Error(`Smoobu-Wohnung für ${k} nicht eindeutig: ${JSON.stringify(details)}`);
      ids[k] = hits[0].id;
    }
  }
  return (idCache = ids);
}

// Preise, Mindestaufenthalt und belegte Tage je Wohnung
async function loadCalendar(env) {
  const ids = await smoobuIds(env);
  const start = todayVienna(), end = addDays(start, DAYS_AHEAD);
  const q = Object.values(ids).map((id) => `apartments[]=${id}`).join("&");
  const [rates, reservations] = await Promise.all([
    smoobu(env, `rates?${q}&start_date=${ymd(start)}&end_date=${ymd(end)}`),
    loadReservations(env, start, end),
  ]);
  const out = {};
  for (const [k, id] of Object.entries(ids)) {
    const r = rates?.data?.[id] || {};
    const days = {}, blocked = new Set();
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const x = r[ymd(d)];
      if (!x) continue;
      days[ymd(d)] = [x.price != null ? Number(x.price) : null, Number(x.min_length_of_stay) || 1];
      if (x.available === 0 || x.available === "0" || x.available === false) blocked.add(ymd(d));
    }
    for (const b of reservations) {
      if (String(b?.apartment?.id) !== id) continue;
      if (String(b.type || "").includes("cancel")) continue;
      for (let d = parse(b.arrival); d < parse(b.departure); d = addDays(d, 1)) blocked.add(ymd(d));
    }
    out[k] = { days, blocked };
  }
  return out;
}

async function loadReservations(env, start, end) {
  const all = [];
  for (let page = 1; page <= 20; page++) {
    const r = await smoobu(env, `reservations?from=${ymd(addDays(start, -30))}&to=${ymd(end)}&pageSize=100&page=${page}&excludeBlocked=false`);
    all.push(...(r.bookings || []));
    if (!r.page_count || page >= r.page_count) break;
  }
  return all;
}

/* ---------- Stripe ---------- */
function form(obj, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") form(v, key, out); else out.append(key, String(v));
  }
  return out;
}
async function stripe(env, path, params, method) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: method || (params ? "POST" : "GET"),
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params ? form(params) : undefined,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Stripe ${path.split("?")[0]} ${res.status} ${body?.error?.message || ""}`);
  return body;
}

// Laufende Bezahlungen (offen) und bezahlte, noch nicht eingetragene Buchungen halten den Termin fest
async function stripeHolds(env) {
  const since = Math.floor(Date.now() / 1000) - 3 * 86400;
  const r = await stripe(env, `checkout/sessions?limit=100&created[gte]=${since}&expand[]=data.payment_intent`);
  return (r.data || []).filter((s) => s.metadata?.site === "gauchohome" && (
    s.status === "open" || (s.status === "complete" && !s.payment_intent?.metadata?.smoobu)
  ));
}

/* ---------- Preis ---------- */
function quote(aptKey, cal, checkin, checkout, guests) {
  const a = APARTMENTS[aptKey];
  const f = a.occupancy[guests];
  if (!f) return null;
  let nights = 0, sum = 0;
  for (let d = parse(checkin); d < parse(checkout); d = addDays(d, 1)) {
    const x = cal.days[ymd(d)];
    if (!x || !x[0]) return null;
    nights++; sum += x[0];
  }
  const genius = (sum * GENIUS_FACTOR + a.bookingClean) * f;
  return { nights, compare: Math.round(genius), total: Math.round(genius * DIRECT_FACTOR) };
}

function rangeFree(cal, holds, aptKey, checkin, checkout, exceptSession) {
  for (let d = parse(checkin); d < parse(checkout); d = addDays(d, 1)) if (cal.blocked.has(ymd(d))) return false;
  for (const s of holds) {
    if (s.id === exceptSession || s.metadata.apt !== aptKey) continue;
    if (s.metadata.checkin < checkout && checkin < s.metadata.checkout) return false;
  }
  return true;
}

function toRanges(set) {
  const days = [...set].sort(), out = [];
  for (const d of days) {
    const last = out[out.length - 1];
    if (last && last[1] === d) last[1] = ymd(addDays(parse(d), 1));
    else out.push([d, ymd(addDays(parse(d), 1))]);
  }
  return out;
}

/* ---------- Endpunkte ---------- */
async function availability(env, ctx) {
  const [cal, holds] = await Promise.all([loadCalendar(env), stripeHolds(env)]);
  ctx.waitUntil(fulfillPending(env, holds).catch((e) => console.error(e)));
  const today = todayVienna(), apartments = {};
  for (const [k, a] of Object.entries(APARTMENTS)) {
    const c = cal[k];
    if (!c) continue;
    const blocked = new Set(c.blocked);
    for (const s of holds) if (s.metadata.apt === k) for (let d = parse(s.metadata.checkin); d < parse(s.metadata.checkout); d = addDays(d, 1)) blocked.add(ymd(d));
    // "ab"-Preis: günstigste freie Nacht in den nächsten 60 Tagen, 2 Gäste
    let best = null;
    for (let d = today; d < addDays(today, 60); d = addDays(d, 1)) {
      if (blocked.has(ymd(d))) continue;
      const q = quote(k, c, ymd(d), ymd(addDays(d, 1)), Math.min(2, a.maxGuests));
      if (q && (!best || q.total < best.total)) best = q;
    }
    apartments[k] = {
      blocked: toRanges(blocked), days: c.days,
      price: { night: best ? best.total : 0, weekend: best ? best.total : 0, cleaning: 0, compare: best ? best.compare : 0 },
      minNights: a.minNights, maxGuests: a.maxGuests, occupancy: a.occupancy,
      bookingClean: a.bookingClean, geniusFactor: GENIUS_FACTOR, directFactor: DIRECT_FACTOR,
    };
  }
  return json({ today: ymd(today), apartments });
}

async function checkout(req, env) {
  const b = await req.json().catch(() => null);
  const a = b && APARTMENTS[b.apt];
  const g = b?.guest || {};
  const guests = Number(b?.guests);
  const email = String(g.email || "").trim();
  if (!a || !isDate(b.checkin) || !isDate(b.checkout) || b.checkin >= b.checkout || !b.consent
    || !Number.isInteger(guests) || guests < 1 || guests > a.maxGuests
    || !String(g.first || "").trim() || !String(g.last || "").trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ error: "Ungültige Angaben" }, 400);
  }
  const today = todayVienna();
  if (parse(b.checkin) < today || parse(b.checkout) > addDays(today, DAYS_AHEAD)) return json({ error: "Zeitraum nicht buchbar" }, 400);

  const [cal, holds] = await Promise.all([loadCalendar(env), stripeHolds(env)]);
  const c = cal[b.apt];
  const q = c && quote(b.apt, c, b.checkin, b.checkout, guests);
  const minN = c?.days?.[b.checkin]?.[1] || a.minNights;
  if (!q || q.nights < minN) return json({ error: "Zeitraum nicht buchbar" }, 400);
  if (!rangeFree(c, holds, b.apt, b.checkin, b.checkout)) return json({ error: "Zeitraum vergeben" }, 409);

  const origin = new URL(req.url).origin;
  const ref = `GH${b.checkin.slice(2, 4)}${b.checkin.slice(5, 7)}${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
  const clip = (s, n) => String(s || "").trim().slice(0, n);
  const meta = {
    site: "gauchohome", ref, apt: b.apt, checkin: b.checkin, checkout: b.checkout, guests: String(guests),
    nights: String(q.nights), total: String(q.total), compare: String(q.compare),
    first: clip(g.first, 80), last: clip(g.last, 80), email: clip(email, 200), phone: clip(g.phone, 40), note: clip(g.note, 480),
  };
  const fmt = (s) => parse(s).toLocaleDateString("de-AT", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const s = await stripe(env, "checkout/sessions", {
    mode: "payment",
    locale: "de",
    customer_email: email,
    client_reference_id: ref,
    expires_at: Math.floor(Date.now() / 1000) + HOLD_MINUTES * 60 + 60,
    success_url: `${origin}/?buchung=bezahlt&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?buchung=abgebrochen`,
    line_items: { 0: { quantity: 1, price_data: { currency: "eur", unit_amount: q.total * 100, product_data: {
      name: `${a.name} · ${fmt(b.checkin)} bis ${fmt(b.checkout)}`,
      description: `${q.nights === 1 ? "1 Nacht" : `${q.nights} Nächte`}, ${guests === 1 ? "1 Gast" : `${guests} Gäste`}, Endreinigung inklusive`,
    } } } },
    metadata: meta,
    payment_intent_data: { description: `Gaucho Home ${ref}`, metadata: meta },
  });
  return json({ id: s.id, url: s.url });
}

async function release(req, env) {
  const b = await req.json().catch(() => null);
  const id = String(b?.session_id || "");
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) return json({ error: "Ungültig" }, 400);
  const s = await stripe(env, `checkout/sessions/${id}`).catch(() => null);
  if (s?.status === "open" && s.metadata?.site === "gauchohome") await stripe(env, `checkout/sessions/${id}/expire`, {}).catch(() => null);
  return json({ ok: true });
}

async function booking(req, env) {
  const id = new URL(req.url).searchParams.get("session_id") || "";
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) return json({ error: "Ungültig" }, 400);
  const s = await stripe(env, `checkout/sessions/${id}?expand[]=payment_intent`).catch(() => null);
  if (!s || s.metadata?.site !== "gauchohome") return json({ error: "Nicht gefunden" }, 404);
  const paid = s.payment_status === "paid";
  if (paid) await fulfill(env, s).catch((e) => console.error(e));
  const m = s.metadata;
  return json({
    paid, apartment: APARTMENTS[m.apt]?.name || "", nights: Number(m.nights), total: Number(m.total), ref: m.ref,
    first: m.first, email: m.email, checkin: m.checkin, checkout: m.checkout,
  });
}

/* ---------- Nach der Zahlung: Smoobu und Mails ---------- */
// Nur Buchungen, deren Gast nicht auf die Seite zurückgekommen ist (älter als die Reservierungszeit),
// damit die Rückkehr des Gastes und diese Nachlese nicht gleichzeitig eintragen
async function fulfillPending(env, holds) {
  const cutoff = Math.floor(Date.now() / 1000) - (HOLD_MINUTES + 5) * 60;
  for (const s of holds) if (s.status === "complete" && s.payment_status === "paid" && s.created < cutoff) await fulfill(env, s);
}

async function fulfill(env, s) {
  const pi = typeof s.payment_intent === "string" ? await stripe(env, `payment_intents/${s.payment_intent}`) : s.payment_intent;
  if (!pi || pi.metadata?.smoobu) return; // schon erledigt
  // Sperre gegen doppeltes Eintragen (zwei Aufrufe gleichzeitig)
  const lock = await stripe(env, `payment_intents/${pi.id}`, { metadata: { smoobu: "pending" } });
  if (!lock) return;
  const m = s.metadata, a = APARTMENTS[m.apt];
  let smoobuId = "", problem = "";
  try {
    const ids = await smoobuIds(env);
    const r = await smoobu(env, "reservations", {
      method: "POST",
      body: JSON.stringify({
        arrivalDate: m.checkin, departureDate: m.checkout, apartmentId: Number(ids[m.apt]), channelId: 70,
        firstName: m.first, lastName: m.last, email: m.email, phone: m.phone, adults: Number(m.guests), children: 0,
        price: Number(m.total), priceStatus: 1, language: "de",
        notice: `Direktbuchung Website ${m.ref}, bezahlt über Stripe (${pi.id}).${m.note ? ` Nachricht: ${m.note}` : ""}`,
      }),
    });
    smoobuId = String(r.id || "ok");
  } catch (e) {
    problem = String(e.message || e);
    smoobuId = "fehler";
  }
  await stripe(env, `payment_intents/${pi.id}`, { metadata: { smoobu: smoobuId } });
  await sendMails(env, m, a, problem).catch((e) => console.error(e));
}

async function mailFrom(env) {
  if (env.MAIL_FROM) return env.MAIL_FROM;
  const r = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` } }).then((x) => x.json()).catch(() => ({}));
  const d = (r.data || []).find((x) => x.status === "verified");
  return d ? `Gaucho Home <buchung@${d.name}>` : "Gaucho Home <onboarding@resend.dev>";
}

async function sendMails(env, m, a, problem) {
  const from = await mailFrom(env);
  const to = env.MAIL_TO || MAIL_TO_DEFAULT;
  const fmt = (s) => parse(s).toLocaleDateString("de-AT", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const rows = [
    ["Vorgangsnummer", m.ref], ["Apartment", a.name], ["Anreise", fmt(m.checkin)], ["Abreise", fmt(m.checkout)],
    ["Nächte", m.nights], ["Gäste", m.guests], ["Bezahlt", euro(Number(m.total))],
  ];
  const table = `<table style="border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#666">${esc(k)}</td><td style="padding:4px 0"><b>${esc(v)}</b></td></tr>`).join("")}</table>`;
  const send = (body) => fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, ...body }),
  });
  await send({
    to: [m.email], reply_to: to, subject: `Deine Buchung bei Gaucho Home (${m.ref})`,
    html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#222">
      <p>Hallo ${esc(m.first)},</p>
      <p>danke für deine Buchung. Die Zahlung ist eingegangen, dein Aufenthalt ist fest gebucht.</p>
      ${table}
      <p>Adresse: Rheinstraße 79, 6972 Fußach, Österreich.<br>Ein paar Tage vor der Anreise schicken wir dir alles Wichtige zum Ankommen.</p>
      <p>Fragen? Antworte einfach auf diese Mail oder ruf uns an: ${PHONE}</p>
      <p>Bis bald<br>Gaucho Home</p></div>`,
  });
  await send({
    to: [to], reply_to: m.email, subject: `${problem ? "BITTE PRÜFEN: " : ""}Neue Direktbuchung ${a.name}, ${m.checkin} bis ${m.checkout}`,
    html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5">
      ${problem ? `<p style="color:#b00"><b>Die Buchung konnte nicht automatisch in Smoobu eingetragen werden. Bitte den Zeitraum sofort von Hand sperren.</b><br>${esc(problem)}</p>` : "<p>Die Buchung ist bezahlt und in Smoobu eingetragen.</p>"}
      ${table}
      <p>Gast: ${esc(m.first)} ${esc(m.last)}, ${esc(m.email)}, ${esc(m.phone || "keine Telefonnummer")}</p>
      ${m.note ? `<p>Nachricht: ${esc(m.note)}</p>` : ""}</div>`,
  });
}

/* ---------- Verteiler ---------- */
export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(req);
    try {
      if (url.pathname === "/api/availability" && req.method === "GET") return await availability(env, ctx);
      if (url.pathname === "/api/checkout" && req.method === "POST") return await checkout(req, env);
      if (url.pathname === "/api/release" && req.method === "POST") return await release(req, env);
      if (url.pathname === "/api/booking" && req.method === "GET") return await booking(req, env);
      return json({ error: "Nicht gefunden" }, 404);
    } catch (e) {
      console.error(e);
      return json({ error: "Serverfehler" }, 500);
    }
  },
};
