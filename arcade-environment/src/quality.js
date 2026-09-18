/**
 * Quality tiers and the governor that picks one at runtime.
 *
 * The arcade is fill-rate bound: nineteen point lights on every lit pixel,
 * additive light beams, bloom, a second scene render for the aisle mirror and
 * the CRT shader. Each tier scales those levers so the room looks as good as
 * the machine can afford while staying at the display's frame rate.
 *
 *   const quality = createQuality({ onChange });
 *   quality.tier        // the current tier name
 *   quality.settings    // the knobs for that tier (see TIERS)
 *   quality.sample(dt, phase)  // every frame; phase gates when the governor may act
 *   quality.set(name)   // force a tier (also used by ?quality=)
 *
 * The starting tier comes from device heuristics (and the tier the governor
 * settled on last visit, if any). From there it steps down as soon as the
 * frame rate is clearly under 60 and, more cautiously, steps back up when the
 * frame rate has been pinned to the display for a while. A step up that has
 * to be undone locks that tier out for progressively longer.
 */

export const TIERS = {
    potato: {
        rank: 0,
        pixelRatio: 0.5, maxPixels: 0.7e6,
        msaa: 0,
        bloom: 0,               // bloom scale, 0 = off
        reflection: 0,          // mirror texture scale, 0 = off
        reflectionEvery: 3,     // re-render the mirror every n frames
        lights: 0,              // keep lights with priority <= this
        beams: 'none',          // ceiling light shafts: 'none' | 'all'
        haze: false,
        motes: 0.3,
        crtDetail: 0,           // 0 = single tap, 1 = aberration + halo + grille
        screenRate: 0.35,       // attract-mode screen refresh rate multiplier
        screenBudget: 1,        // attract screens uploaded per frame
        mipmaps: false,
    },
    low: {
        rank: 1,
        pixelRatio: 0.75, maxPixels: 1.2e6,
        msaa: 0,
        bloom: 0.25,
        reflection: 0,
        reflectionEvery: 3,
        lights: 0,
        beams: 'none',
        haze: false,
        motes: 0.5,
        crtDetail: 0,
        screenRate: 0.6,
        screenBudget: 2,
        mipmaps: true,
    },
    medium: {
        rank: 2,
        pixelRatio: 1.0, maxPixels: 2.2e6,
        msaa: 2,
        bloom: 0.25,
        reflection: 0.6,
        reflectionEvery: 2,
        lights: 1,
        beams: 'all',
        haze: true,
        motes: 1,
        crtDetail: 1,
        screenRate: 1,
        screenBudget: 3,
        mipmaps: true,
    },
    high: {
        rank: 3,
        pixelRatio: 1.5, maxPixels: 3.2e6,
        msaa: 4,
        bloom: 0.5,
        reflection: 1,
        reflectionEvery: 2,
        lights: 2,
        beams: 'all',
        haze: true,
        motes: 1,
        crtDetail: 1,
        screenRate: 1,
        screenBudget: 4,
        mipmaps: true,
    },
    ultra: {
        rank: 4,
        pixelRatio: 2, maxPixels: 9e6,
        msaa: 4,
        bloom: 0.5,
        reflection: 1.5,
        reflectionEvery: 1,
        lights: 2,
        beams: 'all',
        haze: true,
        motes: 1,
        crtDetail: 1,
        screenRate: 1,
        screenBudget: 6,
        mipmaps: true,
    },
};

export const TIER_ORDER = ['potato', 'low', 'medium', 'high', 'ultra'];

const STORAGE_KEY = 'am-arcade:quality';
const TARGET_MS = 1000 / 60;      // never settle for less than this
const WINDOW = 90;                // frames per verdict
const SETTLE_SECONDS = 2.5;       // ignore frames after any change
const STEP_UP_SECONDS = 12;       // pinned to the display for this long before trying more
const REGRET_SECONDS = 20;        // a step down this soon after a step up counts as a failed try

// Refresh rates we might be vsync-locked to, as frame periods in ms.
const REFRESH_PERIODS = [240, 165, 144, 120, 100, 90, 75, 60, 50, 30].map((hz) => 1000 / hz);

function readStored() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw && TIERS[raw] ? raw : null;
    } catch {
        return null;
    }
}

function store(tier) {
    try {
        localStorage.setItem(STORAGE_KEY, tier);
    } catch {
        // Private mode; nothing to do.
    }
}

/**
 * A first guess from what the browser tells us. Deliberately conservative
 * for anything that smells like an integrated GPU or a phone: the governor
 * will step up if the machine turns out to be better than it looks.
 */
export function guessTier(renderer) {
    const ua = navigator.userAgent || '';
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
        || (matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches);
    const cores = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory || 8;

    let gpu = '';
    try {
        const gl = renderer.getContext();
        const info = gl.getExtension('WEBGL_debug_renderer_info');
        gpu = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    } catch {
        gpu = '';
    }
    const g = gpu.toLowerCase();
    const software = /swiftshader|llvmpipe|softpipe|software|mesa offscreen|basic render/.test(g);
    const integrated = /intel|iris|uhd|hd graphics|apple m1|apple gpu|mali|adreno|powervr|videocore|vega [0-9]\b|radeon\(tm\) graphics/.test(g)
        && !/arc\s*a\d/.test(g);
    const discrete = /nvidia|geforce|rtx|gtx|quadro|radeon rx|radeon pro|arc\s*a\d|apple m[2-9] (pro|max|ultra)/.test(g);

    let tier;
    if (software) tier = 'potato';
    else if (mobile) tier = 'low';
    else if (discrete) tier = 'high';
    else if (integrated) tier = 'medium';
    else tier = 'medium';

    if (tier !== 'potato' && (cores <= 2 || memory <= 2)) tier = 'low';
    return { tier, gpu, mobile, software };
}

export function createQuality({ renderer, onChange, override = null }) {
    const guess = guessTier(renderer);
    const stored = readStored();
    let tier = override && TIERS[override] ? override : (stored || guess.tier);
    // A stored tier only says what worked last time on this browser; never
    // start above what the heuristics allow plus one step, in case the GPU changed.
    if (!override && stored && TIERS[stored].rank > TIERS[guess.tier].rank + 1) tier = guess.tier;
    const locked = !!override;

    const samples = new Float32Array(WINDOW);
    let count = 0;
    let settle = SETTLE_SECONDS;
    let steady = 0;               // seconds pinned to the display at this tier
    let sinceUp = Infinity;       // seconds since the last step up
    let minPeriod = Infinity;     // best frame time ever seen; hints at the refresh rate
    const lockout = {};           // tier -> seconds left before it may be tried again
    const failures = {};          // tier -> how many times a step up to it was undone
    let lastLog = '';

    function apply(next, reason) {
        if (next === tier) return;
        const from = tier;
        tier = next;
        count = 0;
        settle = SETTLE_SECONDS;
        steady = 0;
        store(tier);
        const msg = `AM Arcade: quality ${from} -> ${tier} (${reason})`;
        if (msg !== lastLog) console.info(msg);
        lastLog = msg;
        if (onChange) onChange(TIERS[tier], tier, from);
    }

    function stepDown(reason) {
        const idx = TIER_ORDER.indexOf(tier);
        if (idx === 0) return;
        if (sinceUp < REGRET_SECONDS) {
            // We just tried this tier and it didn't hold: back off for longer each time.
            failures[tier] = (failures[tier] || 0) + 1;
            lockout[tier] = 45 * Math.pow(2, Math.min(4, failures[tier] - 1));
        }
        apply(TIER_ORDER[idx - 1], reason);
    }

    function stepUp() {
        const idx = TIER_ORDER.indexOf(tier);
        if (idx >= TIER_ORDER.length - 1) return;
        const next = TIER_ORDER[idx + 1];
        if (lockout[next] > 0) return;
        sinceUp = 0;
        apply(next, 'headroom');
    }

    // The display's frame period: the closest known refresh rate to the fastest
    // frame we've ever managed, or the 60 Hz target if we've never got there.
    function refreshPeriod() {
        let best = TARGET_MS;
        let bestErr = Infinity;
        for (const p of REFRESH_PERIODS) {
            const err = Math.abs(p - minPeriod);
            if (err < bestErr) {
                bestErr = err;
                best = p;
            }
        }
        return Math.min(TARGET_MS, best);
    }

    /**
     * @param {number} dt      seconds since the last frame
     * @param {string} phase   'idle' (don't judge), 'down' (may only step down) or 'full'
     */
    function sample(dt, phase) {
        if (locked) return;
        for (const key of Object.keys(lockout)) lockout[key] = Math.max(0, lockout[key] - dt);
        sinceUp += dt;
        if (phase === 'idle' || document.hidden || !(dt > 0)) {
            count = 0;
            return;
        }
        if (settle > 0) {
            settle -= dt;
            return;
        }
        const ms = dt * 1000;
        if (ms < minPeriod && ms > 2) minPeriod = ms;
        samples[count++] = ms;
        if (count < WINDOW) return;
        count = 0;

        const sorted = Array.from(samples).sort((a, b) => a - b);
        const median = sorted[WINDOW >> 1];
        const p90 = sorted[Math.floor(WINDOW * 0.9)];
        const period = refreshPeriod();

        // Too slow: clearly under 60 for most of the window, or stuttering often.
        if (median > TARGET_MS * 1.15 || p90 > TARGET_MS * 1.8) {
            steady = 0;
            stepDown(`${(1000 / median).toFixed(0)} fps`);
            return;
        }

        // Pinned to the display: median within 5% of the refresh period and
        // hardly any late frames. Only then do we consider spending more.
        const pinned = median <= period * 1.05 && p90 <= period * 1.35;
        if (phase === 'full' && pinned) {
            steady += (WINDOW * median) / 1000;
            if (steady >= STEP_UP_SECONDS) {
                steady = 0;
                stepUp();
            }
        } else {
            steady = 0;
        }
    }

    return {
        get tier() { return tier; },
        get settings() { return TIERS[tier]; },
        get locked() { return locked; },
        guess,
        sample,
        set(name, reason = 'manual') {
            if (TIERS[name]) apply(name, reason);
        },
        // For the debug overlay.
        get status() {
            return `${tier}${locked ? ' (locked)' : ''}  guess ${guess.tier}  refresh ~${(1000 / refreshPeriod()).toFixed(0)}Hz  gpu ${guess.gpu.slice(0, 48)}`;
        },
    };
}

/**
 * Pixel ratio for a tier: the device ratio, capped, and further limited so the
 * frame never exceeds the tier's pixel budget on huge or high-density screens.
 */
export function pixelRatioFor(settings, width, height) {
    const dpr = window.devicePixelRatio || 1;
    const capped = Math.min(dpr, settings.pixelRatio);
    const budget = Math.sqrt(settings.maxPixels / Math.max(1, width * height));
    return Math.max(0.4, Math.min(capped, budget));
}
