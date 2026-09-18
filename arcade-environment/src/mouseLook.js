// Mouse look input.
//
// Pointer-lock deltas are gathered between frames and handed to the player
// once per tick, so the camera turns by however far the mouse actually moved
// no matter how the browser batches its events. This module also owns the
// player's mouse speed setting and watches for browsers that report nonsense
// (some Linux builds send a window-position offset in every event, which
// spins you around at the slightest touch).

const STORAGE_KEY = 'am-arcade.mouseSpeed';
const SPEED_STEPS = [0.25, 0.35, 0.5, 0.7, 0.85, 1, 1.2, 1.45, 1.75, 2.1, 2.5, 3];
const DEFAULT_STEP = SPEED_STEPS.indexOf(1);
export const BASE_SENSITIVITY = 0.0022; // radians per pixel at 100%

// A violent flick peaks around 30k px/s for a few tens of milliseconds.
// Input that stays above this for a quarter of a second is the browser, not
// the hand.
const BOGUS_RATE = 40000;
const BOGUS_WINDOW = 0.25;
const BOGUS_MIN_SPAN = 0.15;
// Chrome can deliver one stale, enormous delta right after the lock engages.
const SETTLE_FRAMES = 3;
const RECENT_COUNT = 6;

function loadStep() {
    try {
        const saved = Number(localStorage.getItem(STORAGE_KEY));
        const index = SPEED_STEPS.indexOf(saved);
        return index >= 0 ? index : DEFAULT_STEP;
    } catch {
        return DEFAULT_STEP;
    }
}

export default class MouseLook {
    constructor() {
        this.step = loadStep();
        this.dx = 0;
        this.dy = 0;
        this.settle = 0;
        this.samples = [];   // { t, px } within the detector window
        this.recent = [];    // last few raw deltas, for the overlay
        this.peakRate = 0;
        this.rate = 0;
        this.eventsPerSecond = 0;
        this.bogus = false;
        this.onBogus = null;
    }

    get speed() {
        return SPEED_STEPS[this.step];
    }

    // direction: +1 faster, -1 slower. Returns the new multiplier.
    adjust(direction) {
        this.step = Math.min(SPEED_STEPS.length - 1, Math.max(0, this.step + Math.sign(direction)));
        try {
            localStorage.setItem(STORAGE_KEY, String(this.speed));
        } catch {
            // Private mode or storage disabled: the setting just doesn't persist.
        }
        return this.speed;
    }

    // Pointer lock (re)engaged: nothing before this moment should turn the camera.
    reset() {
        this.dx = 0;
        this.dy = 0;
        this.settle = SETTLE_FRAMES;
        this.samples.length = 0;
        this.bogus = false;
    }

    // Deltas that arrived while the camera wasn't ours to turn.
    discard() {
        this.dx = 0;
        this.dy = 0;
    }

    push(mx, my) {
        if (!Number.isFinite(mx) || !Number.isFinite(my)) return;
        const t = performance.now() / 1000;
        this.dx += mx;
        this.dy += my;
        this.recent.push([mx, my]);
        if (this.recent.length > RECENT_COUNT) this.recent.shift();
        this.track(t, Math.abs(mx) + Math.abs(my));
    }

    // Returns the turn for this frame in radians (yaw, pitch), sensitivity applied.
    consume() {
        const dx = this.dx;
        const dy = this.dy;
        this.dx = 0;
        this.dy = 0;
        if (this.settle > 0) {
            this.settle--;
            return { yaw: 0, pitch: 0 };
        }
        const k = BASE_SENSITIVITY * this.speed;
        return { yaw: dx * k, pitch: dy * k };
    }

    track(t, px) {
        const samples = this.samples;
        samples.push({ t, px });
        while (samples.length && t - samples[0].t > BOGUS_WINDOW) samples.shift();
        let total = 0;
        for (const s of samples) total += s.px;
        const span = t - samples[0].t;
        this.rate = total / BOGUS_WINDOW;
        this.eventsPerSecond = samples.length / BOGUS_WINDOW;
        if (this.rate > this.peakRate) this.peakRate = this.rate;
        if (!this.bogus && span >= BOGUS_MIN_SPAN && this.rate > BOGUS_RATE) {
            this.bogus = true;
            if (this.onBogus) this.onBogus(this.rate);
        }
    }
}
