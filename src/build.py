#!/usr/bin/env python3
"""Ensambla index.html a partir de las partes.

Uso:  python3 src/build.py   (desde la raíz del repo)

Las partes se concatenan en orden y __FONT_B64__ se reemplaza por la fuente
Bricolage Grotesque (woff2 en base64) para que el archivo final sea 100%
autocontenido, sin dependencias externas.
"""
import pathlib

SRC = pathlib.Path(__file__).parent
ROOT = SRC.parent

PARTES = ['cc-part1.html', 'cc-part2.js', 'cc-part3a.js', 'cc-part3b.js', 'cc-part3c.js']

font = (SRC / 'brico.b64').read_text().strip()
out = ''.join((SRC / p).read_text() for p in PARTES)
assert '__FONT_B64__' in out, 'falta el marcador de fuente en cc-part1.html'
out = out.replace('__FONT_B64__', font)
(ROOT / 'index.html').write_text(out)
print(f'index.html generado: {len(out):,} bytes')
