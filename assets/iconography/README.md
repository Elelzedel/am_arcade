# AM Arcade iconography · v1

A complete standalone asset collection in the game's existing blacklight palette. Nothing is connected to the live application yet.

**Start with [the visual catalog](index.html)** (open in a browser) or [the collection image](preview/collection.png).

## Included

| Folder | Contents | Best use |
| --- | --- | --- |
| `artwork/` | Six original transparent 1254 × 1254 PNG masters, plus 256/512 PNG and WebP exports | Intro, game selection, larger promotional elements |
| `brand/` | Signature A, monochrome A, three outlined wordmarks, SVG app icon, 192/512/1024 PNG app icons, maskable 512 PNG | Identity, headers, app installation |
| `favicon/` | SVG favicon, 16/32/48 PNGs, multi-resolution ICO, 180 PNG Apple touch icon, monochrome pinned-tab SVG | Browser tabs, bookmarks, home screens |
| `games/` | Five colored vector badges, five monochrome glyphs, 256 PNG badges | Menus, machine labels, compact game references |
| `ui/` | 40 standalone SVG icons and one external SVG sprite | Controls, navigation, status, scores |
| `source/` | Editable vector builder, export commands, catalog, image prompts, preview builder and verifier | Reproduction and extensions |
| `preview/` | Desktop and mobile catalog screenshots, light UI screenshot, verification report | Review and handoff |

The signature is a cyan open A with a separate magenta energy bar. Its shape echoes the cabinet's CRT emblem. Wordmarks are original outlined vector lettering and need no font installation. `wordmark-dark.svg` has pale lettering for dark surfaces; `wordmark-light.svg` has dark lettering for pale surfaces; `wordmark-mono.svg` inherits the surrounding text color when inlined.

## Color and size

- Brand: cyan `#00e5ff`, pink `#ff2bd6`, midnight `#090617`, ivory `#ffe066`.
- Cabinet accents match existing game metadata: Tank Artillery pink, Neon Racer cyan, Star Swarm red `#ff3b3b`, Brick Blitz green `#39ff14`, Neon Snake amber `#ffb000`.
- Use dimensional artwork at 96 CSS pixels and above. All six masters and their derivatives contain real alpha transparency. The lighting is designed for dark surfaces. Preserve the square canvas and use `object-fit: contain`; don't crop tightly around the silhouette.
- Use game glyphs at 24–48 pixels and badges at 48 pixels and above.
- UI icons use a 24-unit viewBox, a 1.8-unit stroke, and rounded caps/joins. Default size: 24 pixels. Do not apply neon blur to small control icons.
- The favicon is deliberately simplified for 16–48 pixels. Apple touch and maskable PNGs have opaque backgrounds. The maskable mark fits inside the central safe circle.

## Integration examples

These examples assume you copy this folder to your deployed `/assets/iconography/` directory. The current webpack configuration does not automatically publish this folder. Add your preferred static-copy step when integrating, or import specific files through supported asset rules; direct SVG imports would need an appropriate webpack asset rule.

### Browser identity

```html
<link rel="icon" href="/assets/iconography/favicon/favicon.ico" sizes="16x16 32x32 48x48">
<link rel="icon" type="image/svg+xml" href="/assets/iconography/favicon/favicon.svg">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/iconography/favicon/apple-touch-icon.png">
<link rel="mask-icon" href="/assets/iconography/favicon/safari-pinned-tab.svg" color="#00e5ff">
<meta name="theme-color" content="#090617">
```

`manifest.example.webmanifest` provides icon declarations if you later add a web app manifest. Review its name, URLs and display mode before linking it. Icons alone do not add offline functionality or touch controls.

### Interface icons

```html
<button type="button" aria-label="Pause game" style="color: #00e5ff">
  <svg width="24" height="24" aria-hidden="true" focusable="false">
    <use href="/assets/iconography/ui/sprite.svg#am-pause"></use>
  </svg>
</button>
```

Every sprite ID is `am-` followed by the standalone filename without `.svg`, such as `am-trophy` or `am-volume-off`. Serve the external sprite from the same origin. `currentColor` works with inline SVG and sprite `<use>`; a standalone SVG loaded as `<img>` does not inherit the parent CSS color. Inline the glyph to recolor it, or use a CSS mask. For decorative icons use `aria-hidden="true"`; icon-only buttons need a useful accessible label on the button. Accompany status colors with an icon or text.

### Dimensional artwork

```html
<picture>
  <source type="image/webp" srcset="/assets/iconography/artwork/neon-racer-256.webp 1x, /assets/iconography/artwork/neon-racer-512.webp 2x">
  <img src="/assets/iconography/artwork/neon-racer-256.png"
       srcset="/assets/iconography/artwork/neon-racer-512.png 2x"
       width="256" height="256" alt="Neon Racer spacecraft">
</picture>
```

Tank Artillery's asset slug is `tank-artillery`; the existing code/page slug is `tank-game`. Other game slugs match directly.

## Rebuild

Run from the repository root:

```sh
python assets/iconography/source/build.py
bash assets/iconography/source/export.sh
python assets/iconography/source/preview.py
node assets/iconography/source/verify.mjs
```

Vector generation and preview generation need Python 3 only. Raster export needs `rsvg-convert` and ImageMagick. Preview verification uses this repository's `puppeteer-core` dependency and `/usr/bin/chromium`. Generated PNG masters are preserved; rebuilding does not regenerate AI artwork.

The six dimensional originals were created with the built-in image generation tool. Exact prompts are preserved in `source/prompts.json`. PNG/WebP resizing preserves alpha; the vector family was authored directly as SVG, with no third-party icon library. `asset-manifest.json` inventories deliverable files and hashes. Browser verification checks image loading, icon filtering, the light-surface toggle, and horizontal overflow at desktop/mobile widths; no application code was modified.
