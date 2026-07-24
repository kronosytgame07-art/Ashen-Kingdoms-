# Générer les icônes PWA PNG

Les sources SVG sont dans `assets/icon-192.svg` et `assets/icon-512.svg`.
Convertissez-les en PNG avec l’une de ces méthodes :

## Option 1 — Inkscape (recommandé)
```bash
inkscape assets/icon-192.svg --export-type=png --export-filename=assets/icon-192.png -w 192 -h 192
inkscape assets/icon-512.svg --export-type=png --export-filename=assets/icon-512.png -w 512 -h 512
```

## Option 2 — ImageMagick
```bash
convert -background none assets/icon-192.svg -resize 192x192 assets/icon-192.png
convert -background none assets/icon-512.svg -resize 512x512 assets/icon-512.png
```

## Option 3 — Node.js (sharp)
```js
const sharp = require('sharp');
await sharp('assets/icon-192.svg').resize(192,192).toFile('assets/icon-192.png');
await sharp('assets/icon-512.svg').resize(512,512).toFile('assets/icon-512.png');
```

> Les PNG générés doivent être commités dans `assets/` pour que la PWA soit
> installable sur iOS (Safari exige des PNG pour les icônes Apple touch).
