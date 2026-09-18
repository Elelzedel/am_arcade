// Shared tuning constants for Neon Racer.
//
// World layout: the ship sits at z = 0 and flies towards -z. Everything on the
// track is stored by its track distance `s`; it is drawn at z = distance - s.

export const TUNNEL_RADIUS = 10;
export const SHIP_RADIUS = 0.7;          // collision radius in the cross-section
export const WALL_LIMIT = TUNNEL_RADIUS - 1.15; // ship centre can't go further out
export const SPAWN_AHEAD = 340;          // how far ahead patterns are generated
export const VIEW_FAR = 420;
export const SECTOR_LENGTH = 1000;

export const NEAR_MISS_DIST = 1.3;       // clearance below this = near miss
export const INVULN_TIME = 1.6;
export const MAX_SHIELDS = 3;

export const BASE_MULT_SPEED = 55;       // speed that equals a x1.0 multiplier

export function sectorSpeed(sector) {
    return Math.min(140, 55 + 7 * (sector - 1));
}

export function lateralSpeed(sector) {
    return Math.min(22, 15 + 0.6 * (sector - 1));
}

// 0 at sector 1, 1 at sector 11+.
export function difficulty(sector) {
    return Math.min(1, (sector - 1) / 10);
}

export function sectorAt(s) {
    return Math.floor(Math.max(0, s) / SECTOR_LENGTH) + 1;
}

// Tunnel colour themes, one per sector (cycled).
// wall/ring: tunnel neon, hazard: obstacle rims (contrasting), fog: haze colour.
export const THEMES = [
    { name: 'CYAN DRIVE', wall: 0x00e5ff, hazard: 0xff2bd6, fog: 0x00060c, css: '#00e5ff' },
    { name: 'MAGENTA RUN', wall: 0xff2bd6, hazard: 0x00ffa2, fog: 0x0a0010, css: '#ff2bd6' },
    { name: 'TOXIC LANE', wall: 0x39ff14, hazard: 0xff3b3b, fog: 0x010a00, css: '#39ff14' },
    { name: 'SOLAR WIND', wall: 0xffa31a, hazard: 0x2b8cff, fog: 0x0c0500, css: '#ffa31a' },
    { name: 'ULTRAVIOLET', wall: 0x9d4dff, hazard: 0xffe600, fog: 0x06000e, css: '#9d4dff' },
    { name: 'RED SHIFT', wall: 0xff3355, hazard: 0x00e5ff, fog: 0x0c0003, css: '#ff3355' },
    { name: 'GOLD RUSH', wall: 0xffe066, hazard: 0xff2bd6, fog: 0x0a0800, css: '#ffe066' },
    { name: 'ICE CORE', wall: 0xaaddff, hazard: 0xff6a00, fog: 0x02060c, css: '#aaddff' },
];

export function themeFor(sector) {
    return THEMES[(sector - 1) % THEMES.length];
}

export const ORB_COLOR = 0xffe066;
export const SHIELD_COLOR = 0x39ff88;
export const ROCK_COLOR = 0xff7a1a;
