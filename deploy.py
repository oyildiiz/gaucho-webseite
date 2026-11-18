#!/usr/bin/env python3
"""Veröffentlicht die Seite auf Cloudflare Pages (Projekt gauchohome).

Hintergrund: Aus der Claude-Umgebung lassen sich keine neuen Dateien in den
Cloudflare-Dateispeicher laden. Deshalb gilt:
- cloudflare-manifest.json listet die Dateien, die dort schon liegen (Fotos, Logo ...).
- Alle Dateien, die neu oder geändert sind, werden in den Server (_worker.js)
  eingebettet und von dort ausgeliefert.
Wer wrangler normal benutzen kann, nimmt stattdessen:
  python3 build.py && npx wrangler pages deploy dist --project-name gauchohome --branch main

Aufruf: python3 deploy.py            (nur bündeln, Ergebnis: dist-worker.js)
        python3 deploy.py --live     (bündeln und veröffentlichen)
"""
import base64, hashlib, json, os, subprocess, sys
root = os.path.dirname(os.path.abspath(__file__))
os.chdir(root)
subprocess.run([sys.executable, "build.py"], check=True, stdout=subprocess.DEVNULL)
manifest = json.load(open("cloudflare-manifest.json"))
TYPES = {".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8",
         ".svg": "image/svg+xml", ".woff2": "font/woff2", ".jpg": "image/jpeg", ".json": "application/json", ".txt": "text/plain; charset=utf-8", ".png": "image/png", ".ico": "image/x-icon", ".xml": "application/xml; charset=utf-8"}
TEXT = {".html", ".css", ".js", ".svg", ".json", ".txt", ".xml"}
# Diese Dateien haben sich seit dem letzten vollständigen Hochladen geändert oder sind neu
CHANGED = {"/index.html", "/rechtliches.html", "/404.html", "/css/styles.css", "/js/app.js", "/js/data.js"}
files = {}
for d, _, names in os.walk("dist"):
    for n in names:
        p = os.path.join(d, n); rel = "/" + os.path.relpath(p, "dist").replace(os.sep, "/")
        if rel == "/_worker.js": continue
        ext = os.path.splitext(n)[1]
        if rel in manifest and rel not in CHANGED: continue
        raw = open(p, "rb").read()
        entry = [raw.decode() if ext in TEXT else base64.b64encode(raw).decode(), TYPES.get(ext, "application/octet-stream"), 0 if ext in TEXT else 1]
        files[rel] = entry
        if ext == ".html":
            files[rel[:-5] if rel != "/index.html" else "/"] = entry
w = open("dist/_worker.js").read()
inject = "\n// Eingebettete Dateien (neu oder geändert), siehe deploy.py\nconst FILES = %s;\n" % json.dumps(files, ensure_ascii=False)
serve = '''    const F = FILES[url.pathname];
    if (F && (req.method === "GET" || req.method === "HEAD")) {
      const body = F[2] ? Uint8Array.from(atob(F[0]), (c) => c.charCodeAt(0)) : F[0];
      return new Response(body, { headers: { "content-type": F[1], "cache-control": F[1] === "font/woff2" ? "public, max-age=31536000, immutable" : F[2] ? "public, max-age=86400" : "public, max-age=0, must-revalidate", "referrer-policy": "strict-origin-when-cross-origin", "x-content-type-options": "nosniff" } });
    }
    if (!url.pathname.startsWith("/api/")) {
      const r = await env.ASSETS.fetch(req);
      if (r.status === 404 && FILES["/404"]) return new Response(FILES["/404"][0], { status: 404, headers: { "content-type": FILES["/404"][1] } });
      return r;
    }'''
marker = '    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(req);'
assert marker in w and "/* ---------- Verteiler ---------- */" in w
w = w.replace("/* ---------- Verteiler ---------- */", inject + "/* ---------- Verteiler ---------- */").replace(marker, serve)
open("dist-worker.js", "w").write(w)
print("dist-worker.js:", len(w) // 1024, "KB,", len(files), "eingebettete Pfade")
if "--live" in sys.argv:
    acc = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "0be5686104bf5698c302ab1c483edd05")
    out = subprocess.run(["curl", "-sS", "-X", "POST", f"https://api.cloudflare.com/client/v4/accounts/{acc}/pages/projects/gauchohome/deployments",
                          "-F", "manifest=<cloudflare-manifest.json", "-F", "branch=main", "-F", "_worker.js=@dist-worker.js;type=application/javascript+module"],
                         capture_output=True, text=True).stdout
    r = json.loads(out); print("live:", r.get("success"), r.get("errors"), (r.get("result") or {}).get("id"))
