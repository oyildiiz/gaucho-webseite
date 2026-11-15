#!/usr/bin/env python3
"""Bündelt die Seite nach dist/: Preistabelle in _worker.js einsetzen. Dann: npx wrangler pages deploy dist --project-name gauchohome --branch main"""
import json, os, shutil
root = os.path.dirname(os.path.abspath(__file__)); dist = os.path.join(root, "dist")
shutil.rmtree(dist, ignore_errors=True)
shutil.copytree(root, dist, ignore=shutil.ignore_patterns("dist", ".git", "README.md", "build.py", "daten-preise.json", ".assetsignore", "node_modules"))
w = open(os.path.join(root, "_worker.js")).read().replace("__PREISE__", open(os.path.join(root, "daten-preise.json")).read())
open(os.path.join(dist, "_worker.js"), "w").write(w)
print("dist/ fertig")
