/*
  ALLE INHALTE DER WEBSITE AN EINEM ORT
  --------------------------------------
  Hier änderst du Wohnungen, Preise, Fotos, Bewertungen und Fragen.

  Stand der Angaben (aus eurem Booking Eintrag, November 2026):
  - Adresse, Größen, Betten, Ausstattung, Zeiten und Hausregeln: übernommen
  - Preise: online kommen sie täglich vom Server (Smoobu). Regel: Booking.com Preis
    mit 10 % Genius-Rabatt auf die Nächte, davon 5 % weniger. Zahlungsgebühren sind enthalten.
  - Stornoregel: aus euren bisherigen AGB (kostenlos bis 7 Tage vor Anreise)
  - Belegung im Kalender: Beispielwerte, noch nicht mit dem echten Kalender verbunden
  - Fotos: von Booking geladen, auf der Seite per Farbabstimmung leicht beruhigt
*/

// Fotos liegen im Ordner "assets/fotos":
//   assets/fotos/NAME.jpg          große Fassung für die Seite
//   assets/fotos/klein/NAME.jpg    kleine Fassung für Vorschaubilder
//   assets/fotos/original/NAME.jpg unveränderte Datei von Booking
// Eigene Fotos einfach in denselben drei Größen dazulegen.
const BK = (id) => `assets/fotos/${id}.jpg`;
const P = {
  wohnenDach: BK("722243527"),
  schlafenDach: BK("722236631"),
  sofaDach: BK("722236137"),
  bettDach: BK("722237182"),
  tvDach: BK("722235555"),
  bettenDach: BK("722236888"),
  wohnenDach2: BK("722237671"),
  schlafenBalkon: BK("722248981"),
  kueche: BK("722230856"),
  essen: BK("722229064"),
  bett: BK("722231231"),
  bettTv: BK("722231568"),
  bettAussicht: BK("722232784"),
  treppe: BK("722236484"),
  kuecheGross: BK("722243246"),
  essenGross: BK("722243173"),
  treppeGross: BK("722243441"),
};

window.SITE = {
  // true = Hinweis "Vorschau" einblenden und Beispielbelegung im Kalender zeigen.
  // Vor dem Livegang auf false stellen.
  preview: true,

  brand: { name: "Gaucho Home" },

  currency: "EUR",
  locale: "de-AT",

  address: { street: "Rheinstraße 79", city: "6972 Fußach", country: "Österreich" },
  mapUrl: "https://www.openstreetmap.org/search?query=Rheinstra%C3%9Fe%2079%2C%206972%20Fu%C3%9Fach",

  // Kontakt: leer lassen = Platzhalter wird angezeigt
  contact: { email: "info@gaucho.at", phone: "+43 676 915 0009" },

  // Sobald die Seite online ist, kommen Kalender und Preise vom Server
  // (siehe oben in _worker.js) und beim Buchen wird über Stripe bezahlt.
  bookingEndpoint: "",

  // Rabatt ab einer bestimmten Anzahl Nächte, z. B. { nights: 7, percent: 10 }. null = kein Rabatt
  weeklyDiscount: null,

  heroPhoto: { src: P.wohnenDach, alt: "Wohnzimmer unter dem Holzdach mit Sofa und Couchtisch" },
  ctaPhoto: { src: P.schlafenBalkon, alt: "Schlafzimmer mit Balkontür und Blick ins Grüne" },
  placePhoto: { src: P.bettAussicht, alt: "Blick vom Bett durch das Fenster nach draußen" },

  apartments: [
    {
      id: "apartment-fuenf",
      status: "live",
      label: "Wohnung 01",
      name: "Die Maisonette",
      tagline: "Zwei Etagen und viel Platz, zu zweit genauso wie mit der ganzen Familie",
      text: "68 m² auf zwei Etagen mit eigenem Wohnzimmer, Küche mit Esszimmer, Schlafzimmer, Bad und WC. Geschlafen wird im großen Doppelbett, im Etagenbett oder auf dem Schlafsofa, den Kaffee gibt es auf dem Balkon.",
      // Preis je Personenzahl im Verhältnis zu 2 Gästen (Vorschau; online gilt _worker.js)
      occupancy: { 1: 299 / 314, 2: 1, 3: 342 / 314, 4: 356 / 314, 5: 386 / 314 },
      facts: { size: 68, guests: 5, bedrooms: "2 Etagen", baths: "Bad und WC" },
      amenities: [
        ["bed", "Doppelbett, Etagenbett, Schlafsofa"],
        ["couch", "Eigenes Wohnzimmer"],
        ["cooking-pot", "Küche mit Esszimmer und Geschirrspüler"],
        ["sun", "Balkon mit Blick in den Garten"],
        ["washing-machine", "Waschmaschine mit Trockner"],
        ["television-simple", "Flachbild TV mit Streaming"],
        ["wifi-high", "Kostenloses WLAN"],
        ["car", "Kostenloser Parkplatz am Haus"],
      ],
      // compare = Preis pro Nacht auf Booking.com (Stand 12. bis 14. Januar 2027, 2 Gäste)
      // night = 5 % darunter, plus rund 2 % für die Gebühren der Zahlung.
      // Gilt nur für die Vorschau, online zählt _worker.js.
      price: { night: 150, weekend: 150, cleaning: 0, compare: 172 },
      minNights: 1,
      photos: [
        { src: P.wohnenDach, alt: "Wohnzimmer unter dem Holzdach mit Sofa" },
        { src: P.schlafenDach, alt: "Schlafzimmer mit Doppelbett und Etagenbett" },
        { src: P.sofaDach, alt: "Sitzecke mit Sofa und Couchtisch" },
        { src: P.bettDach, alt: "Doppelbett unter der Dachschräge" },
        { src: P.tvDach, alt: "Wohnbereich mit Fernseher" },
        { src: P.bettenDach, alt: "Betten im Schlafzimmer" },
        { src: P.wohnenDach2, alt: "Wohnzimmer mit Sofa und Pflanze" },
        { src: P.kuecheGross, alt: "Küche mit Esstisch" },
        { src: P.essenGross, alt: "Esszimmer mit schwarzen Stühlen" },
        { src: P.treppeGross, alt: "Treppe zwischen den beiden Etagen" },
      ],
      // Echte Belegung: Paare aus Anreise und Abreise, z. B. ["2026-12-24", "2026-12-28"]
      booked: [],
      // Nur für die Vorschau: belegte Zeiträume in Tagen ab heute
      sampleBookedOffsets: [[2, 5], [9, 12], [20, 27], [41, 45]],
    },
    {
      id: "apartment-zwei",
      status: "live",
      label: "Wohnung 02",
      name: "Das Apartment",
      tagline: "Hell, ruhig und mit Balkon",
      text: "39 m² für Paare, Alleinreisende und Geschäftsreisende, gern auch mit Baby: ein großes Doppelbett, Küche mit Esszimmer, Bad mit WC und ein Balkon mit Blick in den Garten und auf die Berge in der Ferne.",
      occupancy: { 1: 262 / 274, 2: 1 },
      facts: { size: 39, guests: 2, guestsText: "2 Gäste, plus Baby", bedrooms: "1 Schlafzimmer", baths: "Bad mit WC" },
      amenities: [
        ["bed", "Großes Doppelbett"],
        ["cooking-pot", "Küche mit Esszimmer und Geschirrspüler"],
        ["coffee", "Kaffeemaschine"],
        ["sun", "Balkon mit Blick in den Garten"],
        ["wifi-high", "Kostenloses WLAN"],
        ["car", "Kostenloser Parkplatz am Haus"],
      ],
      price: { night: 133, weekend: 133, cleaning: 0, compare: 152 },
      minNights: 1,
      photos: [
        { src: P.kueche, alt: "Küche mit grauen Fronten und Esstisch" },
        { src: P.essen, alt: "Essplatz mit schwarzen Stühlen" },
        { src: P.schlafenBalkon, alt: "Schlafzimmer mit Balkontür" },
        { src: P.bett, alt: "Doppelbett mit hellem Kopfteil" },
        { src: P.bettTv, alt: "Schlafzimmer mit Fernseher an der Wand" },
        { src: P.bettAussicht, alt: "Bett mit Blick nach draußen" },
      ],
      booked: [],
      sampleBookedOffsets: [[0, 3], [6, 8], [15, 19], [30, 36]],
    },
    {
      id: "apartment-drei",
      status: "soon",
      label: "Wohnung 03",
      name: "Die Zweizimmerwohnung",
      tagline: "Kommt bald",
      text: "Im Haus entsteht gerade eine Zweizimmerwohnung mit eigenem Schlafzimmer, Wohnzimmer, Küche und Bad mit WC. Schreib uns kurz, dann geben wir dir Bescheid, sobald sie buchbar ist.",
      // Zimmer statt Foto, solange es noch keine Bilder gibt. Mit Fotos: rooms löschen, photos anpassen.
      rooms: [["bed", "Schlafzimmer"], ["couch", "Wohnzimmer"], ["cooking-pot", "Küche"], ["bathtub", "Bad mit WC"]],
      photos: [{ src: P.treppe, alt: "Treppenaufgang im Haus mit Holzstufen" }],
    },
  ],

  // Umgebung
  places: [
    { icon: "fork-knife", name: "Steakhaus Gaucho", dist: "40 m", text: "Unser argentinisches Restaurant gleich nebenan, abends geöffnet." },
    { icon: "bicycle", name: "Rheindamm", dist: "Vor der Haustür", text: "Der Start für Spaziergänge und Radtouren durchs Rheindelta." },
    { icon: "waves", name: "Bodensee und Rohrspitz", dist: "Im Rheindelta", text: "Naturstrandbad, Schilf und weite Wege am Wasser." },
    { icon: "mask-happy", name: "Bregenz", dist: "Rund 8 km", text: "Seebühne, Casino und Altstadt. Dornbirn liegt rund 14 km entfernt." },
    { icon: "boat", name: "Lindau am Bodensee", dist: "Rund 18 km", text: "Die Inselstadt in Deutschland mit Hafen, Leuchtturm und Altstadt." },
    { icon: "mountains", name: "Schweiz", dist: "Wenige Minuten zur Grenze", text: "St. Gallen ist rund 31 km entfernt, das Appenzellerland gleich dahinter." },
  ],

  // Bewertungen: Zahlen von eurem Booking Eintrag, Stand November 2026
  rating: {
    score: "9,0",
    label: "Hervorragend",
    count: 53,
    source: "Booking.com",
    url: "https://www.booking.com/hotel/at/gaucho-home.de.html#tab-reviews",
    asOf: "November 2026",
    // Echte Bewertungen von Booking.com. […] = gekürzt. translated = aus dem Englischen übersetzt.
    quotes: [
      { name: "Robert", country: "Deutschland", who: "Paar", stay: "4 Nächte im August 2025", score: "10", big: true,
        text: "Super freundlich, komplett neu renoviertes Apartment, ideale Homebase um Ausflüge nach Deutschland, Schweiz, Österreich zu machen. Der Ausblick auf die Berge ist auch toll. Keine Parkplatzprobleme, jederzeit über WhatsApp erreichbar […]. Wir kommen definitiv sehr gerne wieder." },
      { name: "Jake", country: "USA", who: "Familie", stay: "1 Nacht im Juni 2026", score: "10", translated: true,
        text: "Schönes neues Apartment. Sehr sauber und einfacher Check-in. Waschmaschine mit Trockner war ein netter Bonus. Wir waren mit Fahrrädern unterwegs und der Gastgeber hat uns eine kleine Garage dafür gegeben. Gut zu erreichen, wenn man den EuroVelo\u00a015 fährt." },
      { name: "Alina", country: "Deutschland", who: "Paar", stay: "1 Nacht im Juli 2026", score: "10",
        text: "Obwohl wir erst recht spät angereist sind, wurden wir herzlich empfangen. […] Unser Zimmer war sehr sauber und liebevoll vorbereitet. Besonders gefreut haben wir uns über das kostenlose Wasser sowie die kleinen Snacks. Am nächsten Morgen wurde uns außerdem ein kostenloser Kaffee im Restaurant angeboten […]." },
      { name: "Evgenia", country: "Deutschland", who: "Paar", stay: "1 Nacht im Mai 2026", score: "10",
        text: "Die Unterkunft ist sehr schön eingerichtet und ruhig, die Betten sind bequem. Die Gastgeber sind sehr nett und das Steakhaus direkt daneben ist sehr zu empfehlen." },
      { name: "Kevin", country: "Großbritannien", who: "Alleinreisend", stay: "1 Nacht im Juni 2026", score: "8,0", translated: true,
        text: "Ruhige Lage mit schönem Blick auf die Berge in der Ferne vom eigenen Balkon. Eigener kostenloser Parkplatz, der sich sicher anfühlte. Das Apartment ist modern und gut ausgestattet, mit Kaffee, Wasser und Kuchen aufs Haus. […] Es ist ein kleines Apartment, aber für ein Paar für ein oder zwei Nächte gut." },
    ],
    categories: [
      ["Gastgeber", "9,7"],
      ["Sauberkeit", "9,2"],
      ["Komfort", "9,1"],
      ["Ausstattung", "9,0"],
      ["Preis und Leistung", "8,9"],
      ["Lage", "8,6"],
    ],
    // Zusammengefasst aus den Bewertungen, keine wörtlichen Zitate
    highlights: [
      "Freundliche, schnell erreichbare Gastgeber",
      "Sauber und modern renoviert",
      "Gut ausgestattete Küche",
      "Genug kostenlose Parkplätze",
      "Balkon mit Blick auf die Berge",
      "Steakhaus direkt nebenan",
    ],
  },

  faq: [
    ["Wie läuft die Buchung ab?", "Du wählst Apartment und Termine, gibst deine Daten ein und zahlst sicher online. Damit ist der Aufenthalt sofort fest gebucht und du bekommst die Bestätigung per Mail."],
    ["Warum ist es direkt günstiger als auf Booking.com?", "Bei einer Direktbuchung verdient keine Plattform mit, und diesen Vorteil geben wir weiter. Im Preis ist alles enthalten: Übernachtung, Endreinigung und die Gebühren für die Zahlung. Es kommt nichts mehr dazu, egal ob du mit Karte, Apple Pay, PayPal oder Klarna zahlst."],
    ["Kommt vor Ort noch etwas dazu?", "Nein. Im Preis ist alles enthalten: Übernachtung, Endreinigung, Bettwäsche und Handtücher, die Gästetaxe und die Gebühren für die Zahlung."],
    ["Wann zahle ich?", "Direkt beim Buchen, mit Karte, Apple Pay, PayPal oder Klarna. Die Zahlung läuft über die gesicherte Bezahlseite unseres Zahlungsanbieters Stripe."],
    ["Kann ich kostenlos stornieren?", "Ja, bis 7 Tage vor der Anreise kostenlos, du bekommst den vollen Betrag zurück. Danach erstatten wir 50 %, bei Nichterscheinen nichts. Stornieren kannst du selbst über den Link in deiner Buchungsbestätigung, das Geld geht automatisch zurück."],
    ["Wann kann ich anreisen und abreisen?", "Anreise ist ab 15 Uhr, Abreise bis 11 Uhr. Sag uns bitte vorab, wann du ungefähr ankommst."],
    ["Gibt es Parkplätze?", "Ja, direkt am Haus und kostenlos. Reservieren musst du nicht."],
    ["Sind Kinder und Haustiere willkommen?", "Kinder jeden Alters sind willkommen. In der kleineren Wohnung, dem Apartment, kann ein Baby zusätzlich mit. Ein Babybett haben wir allerdings nicht. Haustiere können wir leider nicht aufnehmen."],
    ["Darf ich in den Wohnungen rauchen?", "Nein, beide Wohnungen sind Nichtraucherwohnungen. Partys und Feiern sind ebenfalls nicht erlaubt."],
    ["Welche Sprachen sprecht ihr?", "Deutsch, Englisch, Türkisch, Bosnisch und Kroatisch."],
  ],
};
