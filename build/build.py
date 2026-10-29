#!/usr/bin/env python3
"""Erzeugt die statische Webseite des Argentinischen Steakhauses GAUCHO nach public/."""
import hashlib
import html
import json
import os
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public"
DATEN = ROOT / "daten"

FIRMA = {
    "name": "Argentinisches Steakhaus GAUCHO",
    "kurz": "GAUCHO",
    "inhaber": "Beytullah Yildiz",
    "strasse": "Rheinstraße 89",
    "ort": "6972 Fußach",
    "region": "Vorarlberg, Österreich",
    "tel": "+43 676 9181402",
    "tel_link": "+436769181402",
    "mobil": "+43 5578 73027",
    "mobil_link": "+43557873027",
    "mail": "info@gaucho.at",
    "maps": "https://www.google.com/maps/search/?api=1&query=Argentinisches+Steakhaus+Gaucho+Rheinstra%C3%9Fe+89+6972+Fu%C3%9Fach",
}
ZEITEN = [
    ("Dienstag – Freitag", "17:00 – 22:30"),
    ("Samstag, Sonntag & Feiertage", "11:00 – 14:00 · 17:00 – 22:30"),
    ("Montag", "Ruhetag"),
]
# Standard: die eigenen Funktionen unter /api. Mit der Umgebungsvariable GAUCHO_BACKEND=n8n läuft es wieder über n8n
if os.environ.get("GAUCHO_BACKEND") == "n8n":
    BESTELL_WEBHOOK = "https://oyildiz.app.n8n.cloud/webhook/gaucho-bestellung"
    RESERVIER_WEBHOOK = "https://oyildiz.app.n8n.cloud/webhook/gaucho-reservierung"
else:
    BESTELL_WEBHOOK = "/api/bestellung"
    RESERVIER_WEBHOOK = "/api/reservierung"

SEITE = os.environ.get("GAUCHO_URL", "https://gaucho-webseite.plain-union-1195.workers.dev")  # später: https://gaucho.at

MENU = [
    ("index.html", "Start"),
    ("speisekarte.html", "Speisekarte"),
    ("reservieren.html", "Reservieren"),
    ("fleisch.html", "Fleisch-Shop"),
    ("kontakt.html", "Kontakt & Anfahrt"),
]

e = html.escape


def version(datei):
    return hashlib.md5((ROOT / "assets" / datei).read_bytes()).hexdigest()[:8]


def euro(x):
    return "€ " + f"{x:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def bild(name, alt, groesse="(min-width: 900px) 40vw, 100vw", lazy=True, klasse=""):
    return (f'<img src="assets/bilder/{name}-900.webp" srcset="assets/bilder/{name}-600.webp 600w, assets/bilder/{name}-900.webp 900w" '
            f'sizes="{groesse}" width="900" height="1200" alt="{e(alt)}"{" loading=\"lazy\"" if lazy else " fetchpriority=\"high\""}'
            f'{f" class=\"{klasse}\"" if klasse else ""}>')


def _webp_groesse(pfad):
    """Breite und Höhe einer WebP-Datei, ohne Zusatzpakete."""
    import struct
    d = pfad.read_bytes()[:40]
    if d[12:16] == b"VP8 ":
        w, h = struct.unpack("<HH", d[26:30]); return w & 0x3FFF, h & 0x3FFF
    if d[12:16] == b"VP8L":
        v = struct.unpack("<I", d[21:25])[0]; return (v & 0x3FFF) + 1, ((v >> 14) & 0x3FFF) + 1
    return int.from_bytes(d[24:27], "little") + 1, int.from_bytes(d[27:30], "little") + 1


def foto(name, alt, groesse="(min-width: 900px) 46vw, 100vw", lazy=True, klasse=""):
    """Foto mit allen vorhandenen Größen (600/900/1400 px breit)."""
    breiten = [b for b in (600, 900, 1400) if (ROOT / "assets" / "bilder" / f"{name}-{b}.webp").exists()]
    w, h = _webp_groesse(ROOT / "assets" / "bilder" / f"{name}-{breiten[-1]}.webp")
    srcset = ", ".join(f"assets/bilder/{name}-{b}.webp {b}w" for b in breiten)
    return (f'<img src="assets/bilder/{name}-{breiten[-1] if breiten[-1] <= 900 else 900}.webp" srcset="{srcset}" sizes="{groesse}" '
            f'width="{w}" height="{h}" alt="{e(alt)}"{" loading=\"lazy\"" if lazy else ""}{f" class=\"{klasse}\"" if klasse else ""}>')


def zeiten_liste(klasse="zeiten"):
    zeilen = "".join(f"<div><dt>{e(t)}</dt><dd>{e(z)}</dd></div>" for t, z in ZEITEN)
    return f'<dl class="{klasse}">{zeilen}</dl>'


def layout(datei, titel, beschreibung, inhalt, aktiv="", body_klasse=""):
    nav = "".join(
        f'<li><a href="{h}"{" aria-current=\"page\"" if h == aktiv else ""}>{e(t)}</a></li>' for h, t in MENU
    )
    return f"""<!doctype html>
<html lang="de-AT">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(titel)}</title>
<meta name="description" content="{e(beschreibung)}">
<meta name="theme-color" content="#0f0c0b">
<meta property="og:title" content="{e(titel)}">
<meta property="og:description" content="{e(beschreibung)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="de_AT">
<meta property="og:site_name" content="Argentinisches Steakhaus GAUCHO">
<meta property="og:image" content="{SEITE}/assets/vorschau.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Der Gastraum des Argentinischen Steakhauses GAUCHO in Fußach am Bodensee">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="{SEITE}/assets/vorschau.jpg">
<link rel="icon" type="image/png" href="assets/favicon.png?v={version('favicon.png')}">
<link rel="apple-touch-icon" href="assets/apple-touch-icon.png?v={version('apple-touch-icon.png')}">
<link rel="preload" href="assets/fonts/CormorantGaramond-500.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="assets/fonts.css?v={version('fonts.css')}">
<link rel="stylesheet" href="assets/style.css?v={version('style.css')}">
<link rel="stylesheet" href="assets/effekte.css?v={version('effekte.css')}">
</head>
<body class="{body_klasse}">
<a class="skip" href="#inhalt">Zum Inhalt</a>
<header class="kopf" id="kopf">
 <div class="wrap kopf-in">
  <a class="marke" href="index.html" aria-label="{e(FIRMA['name'])} – Startseite"><img src="assets/logo-hell.svg?v={version('logo-hell.svg')}" alt="{e(FIRMA['name'])}" width="200" height="100"></a>
  <nav class="nav" id="nav" aria-label="Hauptnavigation"><ul>{nav}</ul></nav>
  <div class="kopf-aktionen">
   <a class="korb-knopf" href="fleisch.html#korb" aria-label="Warenkorb"><svg viewBox="0 0 24 24" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 3.5h2.4l2.3 11.2a1.6 1.6 0 0 0 1.6 1.3h8.8a1.6 1.6 0 0 0 1.6-1.2l1.6-7.3H6"/><circle cx="9.5" cy="19.8" r="1.2"/><circle cx="17" cy="19.8" r="1.2"/></svg><span class="korb-zahl" data-korb-zahl hidden>0</span></a>
   <a class="btn btn-klein nur-desktop" href="reservieren.html">Tisch reservieren</a>
   <button class="burger" id="burger" aria-expanded="false" aria-controls="nav" aria-label="Menü öffnen"><span></span></button>
  </div>
 </div>
</header>
<main id="inhalt">
{inhalt}
</main>
<footer class="fuss">
 <div class="wrap fuss-raster">
  <div class="fuss-marke">
   <img src="assets/logo-hell.svg?v={version('logo-hell.svg')}" alt="{e(FIRMA['name'])}" width="220" height="110" loading="lazy">
   <p>Familienbetrieb seit 2008. Original argentinische Küche und rohes Premium-Fleisch zum Mitnehmen, mitten in Fußach am Bodensee.</p>
  </div>
  <div><h2 class="fuss-titel">Besuchen</h2><p>{e(FIRMA['strasse'])}<br>{e(FIRMA['ort'])}<br>{e(FIRMA['region'])}</p><p><a href="{FIRMA['maps']}" target="_blank" rel="noopener">Route planen</a></p></div>
  <div><h2 class="fuss-titel">Kontakt</h2><p><a href="tel:{FIRMA['tel_link']}">{e(FIRMA['tel'])}</a><br><a href="tel:{FIRMA['mobil_link']}">{e(FIRMA['mobil'])}</a><br><a href="mailto:{FIRMA['mail']}">{e(FIRMA['mail'])}</a></p></div>
  <div><h2 class="fuss-titel">Öffnungszeiten</h2>{zeiten_liste('zeiten zeiten-klein')}</div>
 </div>
 <div class="wrap fuss-unten">
  <span>© {e(FIRMA['name'])}</span>
  <nav aria-label="Rechtliches"><a href="impressum.html">Impressum</a><a href="datenschutz.html">Datenschutz</a><a href="agb.html">AGB Fleisch-Shop</a></nav>
 </div>
</footer>
<script src="assets/site.js?v={version('site.js')}" defer></script>
<script src="assets/effekte.js?v={version('effekte.js')}" defer></script>
</body>
</html>
"""


def seitenkopf(eyebrow, titel, text="", extra=""):
    return f"""<section class="seitenkopf">
 <div class="wrap">
  <p class="eyebrow">{e(eyebrow)}</p>
  <h1>{titel}</h1>
  {f'<p class="lead">{e(text)}</p>' if text else ''}
  {extra}
 </div>
</section>"""


# ---------------------------------------------------------------- Seiten

def seite_start(produkte):
    karten = ""
    for p in [x for x in produkte if x["bild"]][:4]:
        v = min((v for v in p["varianten"] if v["preis_kg"]), key=lambda v: v["preis_kg"])
        karten += f"""<a class="cut" href="fleisch.html#{p['id']}">
   <figure>{bild(p['bild'], f"{p['name']} ({p['untertitel']}), argentinisches Premium-Fleisch vom GAUCHO", '(min-width: 900px) 22vw, 50vw')}</figure>
   <span class="cut-name">{e(p['name'])}</span><span class="cut-sub">{e(p['untertitel'])}</span>
   <span class="cut-preis">ab {euro(v['preis_kg'])} / kg</span>
  </a>"""
    ab_preis = min(v["preis_kg"] for p in produkte for v in p["varianten"] if v.get("preis_kg"))
    inhalt = f"""
<section class="hero">
 <div class="hero-bild">{foto('lokal-abend', 'Der Gastraum des Gaucho am Abend: gedeckte Tische, warmes Licht und ein Panoramabild von Buenos Aires', '(min-width: 900px) 50vw, 100vw', lazy=False)}</div>
 <div class="wrap hero-in">
  <p class="eyebrow">Fußach am Bodensee · Vorarlberg</p>
  <h1>Argentinische Steaks. <em>Direkt am Bodensee.</em></h1>
  <p class="lead">Saftig vom Grill, genau so, wie Sie es mögen. Und neu bei uns: <strong>rohes Premium-Fleisch zum Mitnehmen</strong>. Online bestellen, frisch zuschneiden lassen und bei uns abholen.</p>
  <div class="aktionen">
   <a class="btn" href="reservieren.html">Tisch reservieren</a>
   <a class="btn btn-hohl" href="fleisch.html">Rohes Fleisch bestellen</a>
  </div>
 </div>
 <div class="hero-leiste"><div class="wrap">{zeiten_liste('zeiten zeiten-leiste')}</div></div>
</section>

<div class="laufband" aria-hidden="true"><div class="laufband-spur"><span>Rohes Fleisch zum Mitnehmen</span><span>Online bestellen</span><span>Abholbereit in 15 Minuten</span><span>Premium aus Argentinien</span><span>Zahlung bei Abholung</span><span>Rohes Fleisch zum Mitnehmen</span><span>Online bestellen</span><span>Abholbereit in 15 Minuten</span><span>Premium aus Argentinien</span><span>Zahlung bei Abholung</span></div></div>

<section class="abschnitt shop-werbung">
 <div class="wrap shop-werbung-in">
  <div class="shop-werbung-text einblenden">
   <p class="eyebrow">Neu bei uns · Fleisch-Shop</p>
   <h2>Rohes Premium-Fleisch.<br><em>Online bestellen. Zum Mitnehmen.</em></h2>
   <p class="lead">Lomo, Bife Ancho, Bife, Churrasco und Lammkrone, <strong>roh und frisch zugeschnitten</strong>, für Ihren eigenen Grill zu Hause. Das ist kein fertiges Gericht, sondern Fleisch in Restaurantqualität zum Selbstzubereiten.</p>
   <ul class="schritte-kurz">
    <li><b>1</b> Cut und Menge wählen</li>
    <li><b>2</b> Abholzeit aussuchen, schon 15 Minuten später möglich</li>
    <li><b>3</b> Bei uns abholen und vor Ort bezahlen</li>
   </ul>
   <div class="aktionen"><a class="btn btn-gross" href="fleisch.html">Jetzt Fleisch bestellen</a><span class="ab-preis">ab {euro(ab_preis)} pro kg</span></div>
   <p class="klein">Hinweis: Im Fleisch-Shop verkaufen wir ausschließlich <strong>rohes, unzubereitetes Fleisch</strong>. Gegrillte Gerichte gibt es im Restaurant.</p>
  </div>
  <div class="shop-werbung-bilder einblenden" aria-hidden="false">
   <figure class="bild-gross">{foto('roh-vakuum', 'Frisch zugeschnittenes, vakuumiertes rohes Rindfleisch zum Mitnehmen', '(min-width: 900px) 30vw, 80vw')}</figure>
   <figure class="bild-klein">{foto('roh-ribeye', 'Rohes, fein marmoriertes Entrecôte auf einer Schieferplatte', '(min-width: 900px) 20vw, 50vw')}</figure>
  </div>
 </div>
</section>

<section class="abschnitt">
 <div class="wrap zwei willkommen">
  <div class="einblenden">
   <p class="eyebrow">Bienvenidos</p>
   <h2>Willkommen im <em>Gaucho</em></h2>
   <figure class="foto-rahmen willkommen-bild">{foto('lokal-bar', 'Blick in den Gastraum des Gaucho mit der Bar im Hintergrund', '(min-width: 900px) 40vw, 100vw')}</figure>
  </div>
  <div class="einblenden text">
   <p class="lead">Lassen Sie sich mit original argentinischer Küche verwöhnen.</p>
   <p>In unserem gemütlichen Restaurant in Fußach grillen wir saftige Steaks, so wie Sie sie gern haben. Unsere Köche arbeiten mit guten Produkten und frischen Zutaten und kochen neben den Steaks auch andere argentinische Spezialitäten.</p>
   <p>Fußach liegt direkt am Bodensee, gleich neben Gaißau, Höchst und Lustenau. Bregenz, Hard, Dornbirn, die Schweiz und Deutschland sind nur ein paar Minuten entfernt.</p>
   <p>Das Gaucho gibt es <strong>seit 2008</strong>. In Vorarlberg ist es über die Jahre zu einer beliebten Adresse für Steaks und argentinische Küche geworden. Wir sind ein <strong>Familienbetrieb</strong> und möchten, dass Sie sich bei uns wie zu Hause fühlen.</p>
   <ul class="fakten"><li><b>2008</b><span>gegründet</span></li><li><b>Familie</b><span>geführter Betrieb</span></li><li><b>Fußach</b><span>am Bodensee</span></li></ul>
   <p class="signatur">Wir freuen uns auf Sie! Ihr Team vom Gaucho</p>
  </div>
 </div>
</section>

<section class="abschnitt dunkler">
 <div class="wrap">
  <div class="abschnitt-kopf einblenden">
   <div><p class="eyebrow">Neu · Rohes Fleisch zum Mitnehmen</p><h2>Premium-Fleisch aus <em>Argentinien</em></h2></div>
   <p>Die Cuts, die bei uns auf den Grill kommen, gibt es auch roh für zu Hause. Wir schneiden sie frisch für Sie zu. Sie bestellen online, suchen sich eine Abholzeit aus, holen das Fleisch bei uns ab und zahlen vor Ort. Gegrillt wird dann bei Ihnen daheim.</p>
  </div>
  <div class="cuts einblenden">{karten}</div>
  <div class="mitte einblenden"><a class="btn" href="fleisch.html">Zum Fleisch-Shop</a></div>
 </div>
</section>

<section class="abschnitt">
 <div class="wrap drei saeulen">
  <div class="einblenden"><span class="nr">I</span><h3>Vom Grill</h3><p>Lomo, Bife Ancho, Bife und Churrasco, in der Größe, die Sie möchten, und auf den Punkt gegrillt.</p></div>
  <div class="einblenden"><span class="nr">II</span><h3>Argentinische Küche</h3><p>Von Provoletta und Gambas al Ajillo bis zu Panqueques con Dulce de Leche.</p></div>
  <div class="einblenden"><span class="nr">III</span><h3>Argentinische Weine</h3><p>Malbec, Cabernet Sauvignon und Syrah aus Argentinien passen sehr gut zu einem Steak.</p></div>
 </div>
 <div class="wrap mitte einblenden"><a class="btn btn-hohl" href="speisekarte.html">Speisekarte ansehen</a></div>
</section>

<section class="abschnitt band">
 <div class="wrap band-in einblenden">
  <img class="band-stier" src="assets/stier-hell.svg?v={version('stier-hell.svg')}" alt="" width="180" height="202" loading="lazy">
  <div><h2>Ihr Tisch im <em>Gaucho</em></h2><p>Reservieren Sie online oder rufen Sie uns kurz an. Wir bestätigen Ihre Reservierung per E-Mail.</p></div>
  <div class="aktionen"><a class="btn" href="reservieren.html">Online reservieren</a><a class="btn btn-hohl" href="tel:{FIRMA['tel_link']}">{e(FIRMA['tel'])}</a></div>
 </div>
</section>"""
    return layout("index.html", "Argentinisches Steakhaus GAUCHO – Steaks in Fußach am Bodensee",
                  "Argentinisches Steakhaus GAUCHO in Fußach, Vorarlberg: saftige Steaks vom Grill, original argentinische Küche und rohes Premium-Fleisch zum Mitnehmen. Online bestellen und abholen.",
                  inhalt, "index.html", "start")


def speise_block(k):
    zeilen = ""
    for g in k["gerichte"]:
        name, beschr = g[0], g[1]
        extra = f'<span class="groessen">{e(g[2])}</span>' if len(g) > 2 else ""
        al = k.get("allergene", {}).get(name, "")
        name_html = e(name) + (f' <span class="allergene">({e(al)})</span>' if al else "")
        zeilen += f'<li><span class="gericht">{name_html}</span>{f"<span class=\"beschr\">{e(beschr)}</span>" if beschr else ""}{extra}</li>'
    klasse = "karte-block" + (" kompakt" if k.get("kompakt") else "") + (" grill" if k.get("grill") else "")
    bildhtml = f'<figure class="foto-rahmen block-bild">{foto(k["bild"][0], k["bild"][1], "(min-width: 900px) 40vw, 100vw")}</figure>' if k.get("bild") else ""
    hinweis = f'<p class="block-hinweis">{e(k["hinweis"])}</p>' if k.get("hinweis") else ""
    return f'<section class="{klasse} einblenden"><h3>{e(k["titel"])}<small>{e(k["untertitel"])}</small></h3><ul>{zeilen}</ul>{hinweis}{bildhtml}</section>'


ALLERGENE = [
    ("A", "Gluten (glutenhaltiges Getreide wie Weizen, Roggen, Gerste, Hafer)"), ("B", "Krebstiere"), ("C", "Eier"), ("D", "Fisch"),
    ("E", "Erdnüsse"), ("F", "Soja"), ("G", "Milch (einschließlich Laktose)"), ("H", "Schalenfrüchte (Nüsse)"),
    ("L", "Sellerie"), ("M", "Senf"), ("N", "Sesam"), ("O", "Sulfite (Schwefeldioxid)"), ("P", "Lupinen"), ("R", "Weichtiere"),
]


def allergene_block():
    zeilen = "".join(f'<li><b>{c}</b><span>{e(n)}</span></li>' for c, n in ALLERGENE)
    return f'''<section class="abschnitt allergene-abschnitt" id="allergene"><div class="wrap">
 <div class="einblenden"><p class="eyebrow">Wichtig für Ihre Gesundheit</p><h2>Die 14 <em>Allergene</em></h2>
 <p>Die Buchstaben in Klammern hinter den Gerichten zeigen, welche Allergene enthalten sind. Fragen dazu beantwortet Ihnen gerne unser Service.</p></div>
 <ul class="allergen-liste einblenden">{zeilen}</ul>
 <p class="klein">Eine Nennung erfolgt, wenn die Stoffe oder daraus hergestellte Erzeugnisse als Zutat im fertigen Gericht enthalten sind. Trotz sorgfältiger Zubereitung können Spuren anderer Stoffe enthalten sein, die in der Küche verwendet werden. Alle Angaben ohne Gewähr.</p>
</div></section>'''


def seite_speisekarte(karte):
    essen = "".join(speise_block(k) for k in karte["essen"])
    trinken = "".join(speise_block(k) for k in karte["trinken"])
    hintergrund = f'<div class="seiten-hintergrund" aria-hidden="true">{foto("grill-gemischt", "", "100vw", lazy=False)}</div>'
    unten = f'<div class="seiten-hintergrund unten" aria-hidden="true">{foto("grill-roh-feuer", "", "100vw")}</div>'
    inhalt = hintergrund + seitenkopf("La Carta", "Speisekarte", "Original argentinische Küche: vom Grill, aus der Küche und aus dem Weinkeller.") + f"""
<nav class="tabs wrap" aria-label="Speisekarte"><a href="#essen">Essen</a><a href="#trinken">Trinken</a></nav>
<section class="abschnitt karte" id="essen"><div class="wrap"><h2 class="karte-titel">Comida <em>· Essen</em></h2><p class="pro-person">Alle Portionen und Preise sind pro Person gerechnet.</p><div class="karte-raster">{essen}</div></div></section>
<section class="abschnitt karte dunkler" id="trinken"><div class="wrap"><h2 class="karte-titel">Bebidas <em>· Trinken</em></h2><div class="karte-raster">{trinken}</div></div></section>
{allergene_block()}
<section class="abschnitt"><div class="wrap mitte"><p class="hinweis">Aktuelle Preise erhalten Sie im Restaurant. Die Portionen und die Preise sind immer pro Person gerechnet. Fragen zu Allergenen beantwortet Ihnen gerne unser Service.</p><div class="aktionen zentriert"><a class="btn" href="reservieren.html">Tisch reservieren</a><a class="btn btn-hohl" href="fleisch.html">Fleisch zum Mitnehmen</a></div></div></section>""" + unten
    return layout("speisekarte.html", "Speisekarte – Argentinisches Steakhaus GAUCHO",
                  "Speisekarte des Argentinischen Steakhauses GAUCHO in Fußach: Steaks vom Grill, Grill- und Lammspezialitäten, argentinische Weine.",
                  inhalt, "speisekarte.html")


def seite_fleisch(daten):
    produkte = daten["produkte"]
    karten = ""
    for p in produkte:
        figur = (f'<figure class="produkt-bild">{bild(p["bild"], f"{p["name"]} ({p["untertitel"]}) vom GAUCHO", "(min-width: 900px) 34vw, 100vw")}</figure>'
                 if p["bild"] else f'<figure class="produkt-bild ohne"><img src="assets/stier-hell.svg?v={version("stier-hell.svg")}" alt="" width="180" height="202"><span>{e(p["name"])}</span></figure>')
        varianten = ""
        for i, v in enumerate(p["varianten"]):
            preis = f"{euro(v['preis_kg'])} <small>/ kg</small>" if v["preis_kg"] else "Preis auf Anfrage"
            varianten += f"""<label class="variante"><input type="radio" name="v-{p['id']}" value="{v['id']}" {'checked' if i == 0 else ''}>
       <span class="v-kopf"><span class="v-name">{e(v['name'])}</span><span class="v-preis">{preis}</span></span><span class="v-info">{e(v['info'])}</span></label>"""
        ausverkauft = "" if p["verfuegbar"] else '<span class="schild">Derzeit ausverkauft</span>'
        karten += f"""<article class="produkt einblenden" id="{p['id']}" data-produkt="{p['id']}">
  {figur}
  <div class="produkt-text">
   <p class="eyebrow">{e(p['herkunft'])}</p>
   <h2>{e(p['name'])} <em>{e(p['untertitel'])}</em></h2>
   {ausverkauft}
   <p>{e(p['text'])}</p>
   <fieldset class="varianten"><legend class="sr-only">Zuschnitt wählen</legend>{varianten}</fieldset>
   <div class="menge" data-menge></div>
   <div class="produkt-fuss"><span class="richtpreis" data-richtpreis></span><button class="btn" type="button" data-in-korb {'disabled' if not p['verfuegbar'] else ''}>In den Warenkorb</button></div>
  </div>
 </article>"""
    produkt_json = json.dumps(daten, ensure_ascii=False).replace("</", "<\\/")
    inhalt = seitenkopf("Carnicería · Rohes Fleisch zum Mitnehmen", "Premium-Fleisch <em>aus Argentinien</em>",
                        "Bestellen Sie die Cuts aus unserer Küche roh für Ihren eigenen Grill. Wir schneiden frisch für Sie zu, Sie holen zur gewünschten Zeit bei uns ab und bezahlen vor Ort.", extra='<p class="roh-hinweis"><strong>BITTE BEACHTEN:</strong> Im Fleisch-Shop verkaufen wir <strong>rohes, unzubereitetes Fleisch</strong> zum Mitnehmen und Selbstgrillen, keine fertigen Speisen. Möchten Sie unsere Steaks frisch vom Grill genießen, <a href="reservieren.html">reservieren Sie gerne einen Tisch</a>.</p>') + f"""
<section class="abschnitt shop-ablauf"><div class="wrap drei">
 <div><span class="nr">1</span><h3>Auswählen</h3><p>Cut, Zuschnitt und Menge wählen.</p></div>
 <div><span class="nr">2</span><h3>Abholzeit wählen</h3><p>Dienstag bis Freitag von 15 bis 21 Uhr, am Wochenende von 12 bis 14 Uhr und von 16 bis 21 Uhr. Auch kurzfristig möglich: schon 15 Minuten nach der Bestellung ist alles abholbereit.</p></div>
 <div><span class="nr">3</span><h3>Abholen & bezahlen</h3><p>Bar oder mit Karte bei Abholung im Gaucho.</p></div>
</div>
</section>
<section class="abschnitt produkte"><div class="wrap">{karten}
 <p class="hinweis">{e(daten['hinweis'])}</p>
</div></section>

<section class="abschnitt dunkler kasse" id="korb"><div class="wrap kasse-raster">
 <div class="korb">
  <h2>Ihr Warenkorb</h2>
  <div class="korb-liste" data-korb-liste><p class="leer">Ihr Warenkorb ist noch leer.</p></div>
  <div class="korb-summe" data-korb-summe hidden><span>Richtpreis gesamt</span><strong data-summe>–</strong></div>
  <p class="klein">Rohes Fleisch zum Selbstzubereiten, nicht gegart. Der Preis ist ein Richtpreis inklusive MwSt. Abgerechnet wird nach dem tatsächlichen Gewicht beim Zuschnitt.</p>
 </div>
 <form class="bestellung" id="bestellung" data-ziel="{BESTELL_WEBHOOK}" novalidate>
  <h2>Abholung & Kontakt</h2>
  <div class="felder">
   <div class="feld"><label for="b-datum">Abholtag *</label><input id="b-datum" name="datum" type="date" required></div>
   <div class="feld"><label for="b-zeit">Uhrzeit *</label><select id="b-zeit" name="zeit" required></select></div>
   <div class="feld"><label for="b-name">Name *</label><input id="b-name" name="name" autocomplete="name" required></div>
   <div class="feld"><label for="b-email">E-Mail *</label><input id="b-email" name="email" type="email" autocomplete="email" required></div>
   <div class="feld"><label for="b-tel">Telefon *</label><input id="b-tel" name="tel" type="tel" autocomplete="tel" required></div>
   <div class="feld voll"><label for="b-msg">Wünsche (optional)</label><textarea id="b-msg" name="msg" rows="3"></textarea></div>
  </div>
  <p class="zahlung-info"><strong>Bezahlung:</strong> Sie zahlen bei der Abholung im Gaucho, bar oder mit Karte.</p>
  <div class="hp" aria-hidden="true"><label for="b-website">Webseite</label><input id="b-website" name="website" tabindex="-1" autocomplete="off"></div>
  <label class="check"><input type="checkbox" id="b-ok" required> <span>Ich akzeptiere die <a href="agb.html">AGB</a> und bin einverstanden, dass meine Angaben zur Abwicklung der Bestellung verwendet werden (<a href="datenschutz.html">Datenschutz</a>). *</span></label>
  <button class="btn btn-voll" type="submit" data-bestellen>Verbindlich bestellen</button>
  <p class="form-status" role="status" aria-live="polite"></p>
 </form>
</div></section>
<script id="produktdaten" type="application/json">{produkt_json}</script>"""
    return layout("fleisch.html", "Fleisch-Shop – argentinisches Premium-Fleisch zum Mitnehmen | GAUCHO",
                  "Argentinisches Premium-Fleisch vom Steakhaus GAUCHO online bestellen und in Fußach abholen: Lomo, Bife Ancho, Rumpsteak, Churrasco und Lammkrone.",
                  inhalt, "fleisch.html", "shop")


def seite_kontakt():
    inhalt = seitenkopf("Contacto", "Kontakt <em>&amp; Anfahrt</em>",
                        "Wir sind in Fußach, im Dreiländereck am Bodensee, und freuen uns auf Ihren Besuch.") + f"""
<div class="wrap seitenbild einblenden">
 <figure class="foto-rahmen aussen-bild">{foto('aussen-eingang', 'Das Restaurant Gaucho in Fußach: Eingang mit Schild und Terrasse im Abendlicht', '(min-width: 1200px) 1100px, 100vw', lazy=False)}</figure>
</div>

<section class="abschnitt"><div class="wrap zwei kontakt">
 <div class="einblenden">
  <h2>{e(FIRMA['name'])}</h2>
  <address>{e(FIRMA['strasse'])}<br>{e(FIRMA['ort'])}<br>{e(FIRMA['region'])}</address>
  <dl class="kontaktliste">
   <div><dt>Telefon</dt><dd><a href="tel:{FIRMA['tel_link']}">{e(FIRMA['tel'])}</a></dd></div>
   <div><dt>Festnetz</dt><dd><a href="tel:{FIRMA['mobil_link']}">{e(FIRMA['mobil'])}</a></dd></div>
   <div><dt>E-Mail</dt><dd><a href="mailto:{FIRMA['mail']}">{e(FIRMA['mail'])}</a></dd></div>
  </dl>
  <p>Fußach liegt direkt am Bodensee und grenzt an Gaißau, Höchst und Lustenau. Bregenz, Hard, Dornbirn, die Schweiz und Deutschland sind nur wenige Minuten entfernt.</p>
  <a class="btn btn-hohl" href="{FIRMA['maps']}" target="_blank" rel="noopener">Route in Google Maps</a>
 </div>
 <div class="einblenden"><h2>Öffnungszeiten</h2>{zeiten_liste()}<p class="hinweis links">Damit Sie den vollen Genuss haben, sind wir ein Nichtraucherrestaurant.</p></div>
</div></section>

<section class="abschnitt dunkler"><div class="wrap mitte einblenden">
 <p class="eyebrow zentriert">Reservar</p><h2>Einen <em>Tisch</em> bei uns?</h2>
 <p class="lead" style="margin-inline:auto">Reservieren Sie bequem online oder rufen Sie uns an.</p>
 <div class="aktionen zentriert"><a class="btn" href="reservieren.html">Tisch reservieren</a><a class="btn btn-hohl" href="tel:{FIRMA['tel_link']}">{e(FIRMA['tel'])}</a></div>
</div></section>"""
    return layout("kontakt.html", "Kontakt & Anfahrt – Argentinisches Steakhaus GAUCHO",
                  "Argentinisches Steakhaus GAUCHO, Rheinstraße 89, 6972 Fußach: Öffnungszeiten, Anfahrt und Telefon.",
                  inhalt, "kontakt.html")


def seite_reservieren():
    inhalt = seitenkopf("Reservar", "Tisch <em>reservieren</em>",
                        "Sichern Sie sich Ihren Platz im Gaucho. Die Anfrage dauert nur eine Minute, wir bestätigen per E-Mail.") + f"""
<section class="abschnitt dunkler"><div class="wrap zwei">
 <div class="einblenden"><p class="eyebrow">Reservar</p><h2>Ihre <em>Anfrage</em></h2>
  <p>Schicken Sie uns Ihre Reservierungsanfrage, wir bestätigen sie Ihnen per E-Mail. Ist zu Ihrem Wunschtermin kein Tisch mehr frei, melden wir uns telefonisch bei Ihnen.</p>
  <p>Kurzfristig oder für größere Gruppen? Rufen Sie uns an: <a href="tel:{FIRMA['tel_link']}">{e(FIRMA['tel'])}</a></p>
 </div>
 <form class="reservierung einblenden" id="reservierung" data-ziel="{RESERVIER_WEBHOOK}" novalidate>
  <div class="felder">
   <div class="feld"><label for="r-datum">Datum *</label><input id="r-datum" name="datum" type="date" required></div>
   <div class="feld"><label for="r-zeit">Uhrzeit *</label><select id="r-zeit" name="zeit" required></select></div>
   <div class="feld"><label for="r-personen">Personen *</label><input id="r-personen" name="personen" type="number" min="1" max="200" inputmode="numeric" placeholder="z. B. 4" required></div>
   <div class="feld"><label for="r-name">Name *</label><input id="r-name" name="name" autocomplete="name" required></div>
   <div class="feld"><label for="r-email">E-Mail *</label><input id="r-email" name="email" type="email" autocomplete="email" required></div>
   <div class="feld"><label for="r-tel">Telefon *</label><input id="r-tel" name="tel" type="tel" autocomplete="tel" required></div>
   <div class="feld voll"><label for="r-msg">Bemerkung (optional)</label><textarea id="r-msg" name="msg" rows="3"></textarea></div>
  </div>
  <div class="hp" aria-hidden="true"><label for="r-website">Webseite</label><input id="r-website" name="website" tabindex="-1" autocomplete="off"></div>
  <label class="check"><input type="checkbox" id="r-ok" required> <span>Ich bin einverstanden, dass meine Angaben zur Bearbeitung der Reservierung verwendet werden (<a href="datenschutz.html">Datenschutz</a>). *</span></label>
  <button class="btn btn-voll" type="submit">Reservierung anfragen</button>
  <p class="form-status" role="status" aria-live="polite"></p>
 </form>
</div></section>
<div class="wrap seitenbild einblenden"><figure class="foto-rahmen">{foto('lokal-bar', 'Blick in den Gastraum des Gaucho mit der Bar im Hintergrund', '(min-width: 1200px) 1100px, 100vw')}</figure></div>
<section class="abschnitt"><div class="wrap zwei">
 <div class="einblenden"><h2>Öffnungszeiten</h2>{zeiten_liste()}<p class="hinweis links">Montag ist unser Ruhetag. Silvester sind wir immer für Sie da.</p></div>
 <div class="einblenden"><h2>So finden Sie uns</h2><address>{e(FIRMA['strasse'])}<br>{e(FIRMA['ort'])}<br>{e(FIRMA['region'])}</address><p><a class="btn btn-hohl" href="{FIRMA['maps']}" target="_blank" rel="noopener">Route in Google Maps</a></p><p class="klein">Wir sind ein Nichtraucherrestaurant.</p></div>
</div></section>"""
    return layout("reservieren.html", "Tisch reservieren – Argentinisches Steakhaus GAUCHO in Fußach",
                  "Tisch im Argentinischen Steakhaus GAUCHO in Fußach am Bodensee online reservieren. Steaks vom Grill und original argentinische Küche.",
                  inhalt, "reservieren.html")


def rechtsseite(datei, titel, html_inhalt, beschreibung):
    inhalt = seitenkopf("Rechtliches", titel) + f'<section class="abschnitt"><div class="wrap recht">{html_inhalt}</div></section>'
    return layout(datei, f"{titel} – Argentinisches Steakhaus GAUCHO", beschreibung, inhalt)


def main():
    produkte = json.loads((DATEN / "produkte.json").read_text(encoding="utf-8"))
    karte = json.loads((DATEN / "speisekarte.json").read_text(encoding="utf-8"))
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    shutil.copytree(ROOT / "assets", OUT / "assets")
    (OUT / "daten").mkdir()
    shutil.copy(DATEN / "produkte.json", OUT / "daten" / "produkte.json")
    seiten = {
        "index.html": seite_start(produkte["produkte"]),
        "speisekarte.html": seite_speisekarte(karte),
        "fleisch.html": seite_fleisch(produkte),
        "reservieren.html": seite_reservieren(),
        "kontakt.html": seite_kontakt(),
        "impressum.html": rechtsseite("impressum.html", "Impressum", (DATEN / "impressum.html.inhalt").read_text(encoding="utf-8"), "Impressum des Argentinischen Steakhauses GAUCHO."),
        "datenschutz.html": rechtsseite("datenschutz.html", "Datenschutz", (DATEN / "datenschutz.html.inhalt").read_text(encoding="utf-8"), "Datenschutzerklärung des Argentinischen Steakhauses GAUCHO."),
        "agb.html": rechtsseite("agb.html", "AGB Fleisch-Shop", (DATEN / "agb.html.inhalt").read_text(encoding="utf-8"), "Allgemeine Geschäftsbedingungen für Bestellungen im Fleisch-Shop des GAUCHO."),
    }
    for name, inhalt in seiten.items():
        (OUT / name).write_text(inhalt, encoding="utf-8")
    # Kopfzeilen für Cloudflare Pages (bei Netlify steht dasselbe in netlify.toml)
    (OUT / "_headers").write_text("""/*.html
  Cache-Control: max-age=0, must-revalidate
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
/assets/*
  Cache-Control: max-age=0, must-revalidate
/assets/fonts/*
  Cache-Control: public, max-age=31536000, immutable
  Access-Control-Allow-Origin: *
/daten/*
  Cache-Control: max-age=0, must-revalidate
  Access-Control-Allow-Origin: *
""", encoding="utf-8")
    (OUT / "404.html").write_text(layout("404.html", "Seite nicht gefunden – GAUCHO", "Seite nicht gefunden.",
                                         seitenkopf("404", "Diese Seite gibt es nicht", "Vielleicht finden Sie, was Sie suchen, auf der Startseite.") +
                                         '<section class="abschnitt"><div class="wrap mitte"><a class="btn" href="index.html">Zur Startseite</a></div></section>'), encoding="utf-8")
    print(f"{len(seiten) + 1} Seiten nach {OUT} geschrieben")


if __name__ == "__main__":
    main()
