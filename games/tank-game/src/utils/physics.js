// Shared ballistics so the real shells, the aiming guide and the CPU's
// "what if" simulations all agree exactly.

export const GRAVITY = 400; // px/s^2
export const POWER_TO_SPEED = 7.2; // power 100 -> 720 px/s
export const WIND_ACCEL = 9; // px/s^2 per unit of wind
export const MIN_POWER = 10;
export const MAX_POWER = 100;
export const SIM_STEP = 1 / 60;
export const DEG = Math.PI / 180;

export const WEAPONS = [
    { id: 'shell', name: 'SHELL', radius: 26, damage: 38, color: '#ffffff', ammo: Infinity, shots: 1 },
    { id: 'triple', name: 'TRIPLE', radius: 20, damage: 22, color: '#5cf2ff', ammo: 2, shots: 3, spread: 5 },
    { id: 'mega', name: 'MEGA BOMB', radius: 58, damage: 65, color: '#ffd23f', ammo: 1, shots: 1 },
];

// Launch velocity for an absolute angle (0 = right, 90 = up, 180 = left).
export function launchVelocity(angle, power) {
    const speed = power * POWER_TO_SPEED;
    return { vx: Math.cos(angle * DEG) * speed, vy: -Math.sin(angle * DEG) * speed };
}

// Advance a body {x, y, vx, vy} by dt with gravity and wind.
export function integrate(body, dt, wind) {
    body.vx += wind * WIND_ACCEL * dt;
    body.vy += GRAVITY * dt;
    body.x += body.vx * dt;
    body.y += body.vy * dt;
}

// Blast damage with linear falloff from the centre to the edge of the blast.
export function blastDamage(weapon, distance, hitRadius) {
    const reach = weapon.radius + hitRadius;
    if (distance >= reach) return 0;
    const t = Math.max(0, (distance - hitRadius * 0.5) / (reach - hitRadius * 0.5));
    return Math.max(1, Math.round(weapon.damage * (1 - t * t * 0.85)));
}

export function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
}

export function randRange(lo, hi) {
    return lo + Math.random() * (hi - lo);
}

export function gaussian() {
    // Roughly normal, sd 1, bounded to +-3.
    return (Math.random() + Math.random() + Math.random() - 1.5) * 2;
}
