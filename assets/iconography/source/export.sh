#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
for size in 16 32 48; do
  rsvg-convert -w "$size" -h "$size" favicon/favicon.svg -o "favicon/favicon-${size}.png"
done
magick favicon/favicon-16.png favicon/favicon-32.png favicon/favicon-48.png favicon/favicon.ico
for size in 192 512 1024; do
  rsvg-convert -w "$size" -h "$size" brand/app-icon.svg -o "brand/app-icon-${size}.png"
done
rsvg-convert -w 180 -h 180 --background-color '#090617' brand/app-icon.svg -o favicon/apple-touch-icon.png
rsvg-convert -w 512 -h 512 brand/app-icon-maskable.svg -o brand/app-icon-maskable-512.png
for src in artwork/*-master.png; do
  name="${src%-master.png}"
  for size in 256 512; do
    magick "$src" -resize "${size}x${size}" "${name}-${size}.png"
    magick "$src" -resize "${size}x${size}" -quality 90 "${name}-${size}.webp"
  done
done
for src in games/*-badge.svg; do
  rsvg-convert -w 256 -h 256 "$src" -o "${src%.svg}-256.png"
done
