"""Build the original vector icon family. Python 3 standard library only.
Raster exports are made separately with rsvg-convert / ImageMagick.
"""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
PINK, CYAN, INK = '#ff2bd6', '#00e5ff', '#090617'

def save(path, text):
    (ROOT / path).write_text(text + '\n')

def svg(body, box='0 0 24 24', extra=''):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{box}" {extra}>{body}</svg>'

icons = {
 'play': '<path d="m8 4 12 8-12 8Z"/>',
 'pause': '<path d="M7 5h3v14H7zM14 5h3v14h-3z"/>',
 'resume': '<path d="M5 4v16m5-15 10 7-10 7Z"/>',
 'restart': '<path d="M4 10a8 8 0 1 1 1.8 7M4 4v6h6"/>',
 'exit': '<path d="M10 4H4v16h6m5-12 4 4-4 4m-7-4h12"/>',
 'home': '<path d="m3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9"/>',
 'menu': '<path d="M4 6h16M4 12h12M4 18h16"/>',
 'close': '<path d="m6 6 12 12M18 6 6 18"/>',
 'arrow-left': '<path d="m10 5-7 7 7 7M3 12h18"/>',
 'arrow-right': '<path d="m14 5 7 7-7 7M3 12h18"/>',
 'arrow-up': '<path d="m5 10 7-7 7 7M12 3v18"/>',
 'arrow-down': '<path d="m5 14 7 7 7-7M12 3v18"/>',
 'fullscreen': '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
 'volume-on': '<path d="M3 9h4l5-5v16l-5-5H3zM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
 'volume-off': '<path d="M3 9h4l5-5v16l-5-5H3zm13 0 5 6m0-6-5 6"/>',
 'music': '<path d="M9 17V5l11-2v12M9 9l11-2"/><ellipse cx="6" cy="18" rx="3" ry="3"/><ellipse cx="17" cy="16" rx="3" ry="3"/>',
 'settings': '<path d="M4 6h4m4 0h8M4 12h10m4 0h2M4 18h2m4 0h10M8 3v6m8 0v6M8 15v6"/>',
 'keyboard': '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.1M10 9h.1M14 9h.1M18 9h.1M6 12h.1M10 12h.1M14 12h.1M18 12h.1M7 15h10"/>',
 'mouse': '<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 2v7M6 10h12"/>',
 'move': '<path d="M12 3v18M3 12h18m-12-6 3-3 3 3m-6 12 3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3"/>',
 'look': '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
 'run': '<circle cx="15" cy="4" r="2"/><path d="m5 9 5-2 4 4 5 1m-8-3-3 6 5 2-1 5m-4-7-3 5H2"/>',
 'interact': '<path d="M8 13V5a2 2 0 0 1 4 0v6l5 1a3 3 0 0 1 3 3l-1 5H9l-5-6a2 2 0 0 1 3-2l1 1Z"/>',
 'joystick': '<circle cx="10" cy="5" r="3"/><path d="M10 8v7M5 13l-3 7h20l-3-7h-5"/><circle cx="17" cy="17" r=".7"/>',
 'cabinet': '<path d="M6 2h12l2 3-1 9 2 4-2 4H5l-2-4 2-4-1-9Zm1 4h10v7H7zM5 17h14m-9 2h4"/>',
 'trophy': '<path d="M7 3h10v6a5 5 0 0 1-10 0Zm0 2H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 2v5m-4 2h8m-6-3h4"/>',
 'leaderboard': '<path d="M3 13h6v8H3zM9 8h6v13H9zM15 11h6v10h-6zM12 2v2m-2-1h4"/>',
 'medal': '<circle cx="12" cy="9" r="6"/><path d="m7 13-2 8 7-3 7 3-2-8m-5-7v6M10 8l2-2 2 2"/>',
 'star': '<path d="m12 2 3 6.5 7 1-5 5 1 7-6-3.5L6 21l1-6.5-5-5 7-1Z"/>',
 'heart': '<path d="M12 21 3.5 12.5a5.7 5.7 0 0 1 8.5-7.6 5.7 5.7 0 0 1 8.5 7.6Z"/>',
 'shield': '<path d="m12 2 8 3v6c0 5-8 11-8 11S4 16 4 11V5Zm-4 9 3 3 5-6"/>',
 'bolt': '<path d="M14 2 4 14h7l-1 8L20 9h-7Z"/>',
 'gem': '<path d="m7 3-5 6 10 13L22 9l-5-6ZM2 9h20M7 3l5 19L17 3"/>',
 'coin': '<circle cx="12" cy="12" r="9"/><path d="m12 6 4 6-4 6-4-6Z"/>',
 'target': '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
 'timer': '<circle cx="12" cy="14" r="8"/><path d="M12 14V9m-3-7h6m-3 0v4m6 1 2-2"/>',
 'players': '<circle cx="9" cy="7" r="4"/><path d="M2 21v-3a7 7 0 0 1 14 0v3m0-18a4 4 0 0 1 0 8m3 3a6 6 0 0 1 3 5v2"/>',
 'info': '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
 'check': '<path d="m4 12 5 5L20 6"/>',
 'lock': '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2"/>',
}
group_attrs = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"'
for name, body in icons.items():
    save(f'ui/{name}.svg', svg(f'<g {group_attrs}>{body}</g>'))
save('ui/sprite.svg', '<svg xmlns="http://www.w3.org/2000/svg">' + ''.join(f'<symbol id="am-{name}" viewBox="0 0 24 24"><g {group_attrs}>{body}</g></symbol>' for name,body in icons.items()) + '</svg>')

# Signature A: broad beams, open counter, separate energy bar.
mark = '<path fill="{cyan}" d="M128 38h24l76 160h-37L140 88l-52 110H51Z"/><path fill="{pink}" d="m119 145-15 30h72l-14-30Z"/>'
save('brand/mark.svg', svg(mark.format(cyan=CYAN,pink=PINK), '0 0 280 240'))
save('brand/mark-mono.svg', svg(mark.format(cyan='currentColor',pink='currentColor'), '0 0 280 240'))
tile_bg = f'<rect width="256" height="256" rx="54" fill="{INK}"/>'
tile_mark = '<path fill="#00e5ff" d="M115 48h26l77 160h-40L128 97 77 208H37Z"/><path fill="#ff2bd6" d="m109 155-14 30h66l-14-30Z"/>'
save('brand/app-icon.svg', svg(tile_bg+tile_mark,'0 0 256 256'))
save('favicon/favicon.svg', svg(tile_bg+tile_mark,'0 0 256 256'))
save('favicon/safari-pinned-tab.svg', svg('<path d="M115 48h26l77 160h-40L128 97 77 208H37Zm-6 107-14 30h66l-14-30Z"/>','0 0 256 256'))
save('brand/app-icon-maskable.svg', svg(f'<path fill="{INK}" d="M0 0h256v256H0z"/><g transform="translate(38.4 38.4) scale(.7)">{tile_mark}</g>','0 0 256 256'))

# Hand-drawn geometric wordmark; every letter is a path, no font dependency.
letters = {
 'A':'M0 64 22 0h20l22 64H48l-4-13H20l-4 13Zm25-27h14l-7-23Z',
 'M':'M0 64V0h17l18 29L53 0h17v64H54V26L35 54 16 26v38Z',
 'R':'M0 64V0h43l13 13v21l-11 10 16 20H41L26 45H16v19Zm16-34h20l4-4v-7l-4-4H16Z',
 'C':'M56 0v16H20l-4 4v24l4 4h36v16H12L0 52V12L12 0Z',
 'D':'M0 0h42l16 16v32L42 64H0Zm16 16v32h19l7-7V23l-7-7Z',
 'E':'M0 0h54v16H16v9h32v14H16v9h38v16H0Z',
}
def word(text, x, y, scale, color):
    parts=[]
    for c in text:
        if c==' ': x+=28*scale; continue
        parts.append(f'<path fill="{color}" fill-rule="evenodd" transform="translate({x} {y}) scale({scale})" d="{letters[c]}"/>')
        x+=(82 if c=='M' else 72)*scale
    return ''.join(parts)
for variant,fg in [('dark','#f4efff'),('light','#171027'),('mono','currentColor')]:
    colored_mark=mark.format(cyan=CYAN if variant!='mono' else fg,pink=PINK if variant!='mono' else fg)
    save(f'brand/wordmark-{variant}.svg',svg(f'<g transform="translate(0 0) scale(.7)">{colored_mark}</g>'+word('AM',215,24,.65,fg)+word('ARCADE',215,84,1,fg),'0 0 655 168'))

game_shapes={
 'tank-artillery': ('#ff2bd6','<path d="M4 14h16l2 3-2 4H4l-2-4Zm3-5h8l3 5H5Zm7 0 6-5 2 2-6 5M6 17h12"/>'),
 'neon-racer': ('#00e5ff','<path d="m12 2 10 18-10-4-10 4Zm0 0v14M7 21l1-3m9 3-1-3"/>'),
 'star-swarm': ('#ff3b3b','<path d="m4 3 4 5h8l4-5 2 9-4 6v4l-5-5h-2l-5 5v-4l-4-6ZM7 11l3 2m7-2-3 2"/>'),
 'brick-blitz': ('#39ff14','<path d="M3 3h8v4H3zM13 3h8v4h-8zM3 9h8v4H3zM5 20h14M15 17l3-3"/><circle cx="19" cy="11" r="2"/>'),
 'neon-snake': ('#ffb000','<path d="M4 19h12a4 4 0 0 0 0-8H8a4 4 0 0 1 0-8h11v5H8m8 8H4v6"/><path d="M16 5.5h.1"/>'),
}
for name,(color,body) in game_shapes.items():
    save(f'games/{name}-glyph.svg',svg(f'<g {group_attrs}>{body}</g>'))
    badge=f'<path d="M24 8h80l16 16v80l-16 16H24L8 104V24Z" fill="{INK}" stroke="{color}" stroke-width="2"/>'
    badge+=f'<path d="M32 16h64M32 112h64" stroke="{color}" stroke-opacity=".3"/>'
    badge+=f'<g transform="translate(28 28) scale(3)" {group_attrs} color="{color}">{body}</g>'
    save(f'games/{name}-badge.svg',svg(badge,'0 0 128 128'))

save('tokens.css', ':root {\n  --am-ink: #090617;\n  --am-panel: #161027;\n  --am-cyan: #00e5ff;\n  --am-pink: #ff2bd6;\n  --am-ivory: #ffe066;\n  --am-text: #f4efff;\n  --am-muted: #b4a8cc;\n}\n.am-icon { width: 1.5em; height: 1.5em; display: inline-block; flex: none; vertical-align: -.25em; }')
save('source/catalog.json',json.dumps({'ui':list(icons),'games':{k:v[0] for k,v in game_shapes.items()}},indent=2))
print(f'Built {len(icons)} UI icons, sprite, 10 game vectors, 9 brand/favicon SVGs.')
