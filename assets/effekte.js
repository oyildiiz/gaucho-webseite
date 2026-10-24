// Bewegung & Tiefe: Fortschrittslinie, Parallax, 3D-Neigung, Staffelung. Ohne Bibliotheken.
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var fein = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var raf = window.requestAnimationFrame.bind(window);

  // Staffelung der Karten und Elemente nebeneinander
  document.querySelectorAll('.cuts').forEach(function (c) { Array.prototype.forEach.call(c.children, function (k, i) { k.style.setProperty('--i', i); }); });
  document.querySelectorAll('.drei, .saeulen, .karte-raster').forEach(function (g) { Array.prototype.forEach.call(g.children, function (k, i) { if (k.classList.contains('einblenden')) k.style.setProperty('--verz', (i * .14) + 's'); }); });

  // Fortschrittslinie, Kopf ein-/ausblenden, Parallax beim Scrollen
  var linie = document.createElement('div'); linie.className = 'fortschritt'; linie.setAttribute('aria-hidden', 'true'); document.body.appendChild(linie);
  var kopf = document.getElementById('kopf'), letzte = window.scrollY, wartet = false;
  var para = Array.prototype.slice.call(document.querySelectorAll('.cut figure, .produkt-bild'));
  function frame() {
    wartet = false;
    var y = window.scrollY, h = document.documentElement.scrollHeight - window.innerHeight;
    linie.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, y / h) : 0) + ')';
    if (kopf && !kopf.classList.contains('offen')) kopf.classList.toggle('weg', y > 240 && y > letzte + 4 ? true : (y < letzte - 4 ? false : kopf.classList.contains('weg')));
    letzte = y;
    var vh = window.innerHeight;
    para.forEach(function (f) {
      var r = f.getBoundingClientRect(); if (r.bottom < -50 || r.top > vh + 50) return;
      var p = (r.top + r.height / 2 - vh / 2) / vh; // -1 … 1
      var img = f.querySelector('img'); if (img) img.style.setProperty('--ver', (p * -22).toFixed(1) + 'px');
    });
    var hb = document.querySelector('.hero-bild'); if (hb && !hb.classList.contains('bewegt') && y < vh) hb.style.transform = 'translate3d(0,' + (y * .18).toFixed(1) + 'px,0)';
  }
  function anfrage() { if (!wartet) { wartet = true; raf(frame); } }
  window.addEventListener('scroll', anfrage, { passive: true }); window.addEventListener('resize', anfrage); frame();

  if (!fein) return;

  // Hero: Licht und Bild folgen sanft der Maus
  var hero = document.querySelector('.hero'), hb = document.querySelector('.hero-bild');
  if (hero && hb) {
    hero.addEventListener('mousemove', function (e) {
      var r = hero.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      hero.style.setProperty('--mx', (x * 100) + '%'); hero.style.setProperty('--my', (y * 100) + '%');
      hb.classList.add('bewegt'); hb.style.setProperty('--px', ((x - .5) * -18) + 'px'); hb.style.setProperty('--py', ((y - .5) * -14) + 'px');
    });
  }

  // 3D-Neigung mit Glanzlicht
  document.querySelectorAll('.cut, .produkt-bild:not(.ohne)').forEach(function (k) {
    var ziel = k.classList.contains('cut') ? k : k, glanz = document.createElement('span'); glanz.className = 'glanz'; glanz.setAttribute('aria-hidden', 'true');
    (k.classList.contains('cut') ? k.querySelector('figure') : k).appendChild(glanz);
    k.classList.add('kippen');
    k.addEventListener('mousemove', function (e) {
      var r = k.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      k.classList.add('aktiv');
      k.style.transform = 'perspective(900px) rotateY(' + ((x - .5) * 12).toFixed(2) + 'deg) rotateX(' + ((.5 - y) * 10).toFixed(2) + 'deg) translateZ(8px)';
      glanz.style.setProperty('--gx', (x * 100) + '%'); glanz.style.setProperty('--gy', (y * 100) + '%');
    });
    k.addEventListener('mouseleave', function () { k.classList.remove('aktiv'); k.style.transform = ''; });
  });
})();
