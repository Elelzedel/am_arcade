import { getAudioContext, getMasterOutput } from '../../games/shared/audio.js';

/**
 * audioReactive.js — one AnalyserNode on the master bus, turned into a handful
 * of smoothed 0..1 numbers that any visual can read every frame.
 *
 *     import { getAudioReactive } from './audioReactive.js';
 *
 *     const audio = getAudioReactive();
 *     audio.update(dt);                       // once per frame
 *     mesh.material.color.setScalar(0.4 + audio.bass * 0.6);
 *
 * API
 *   getAudioReactive(options?)     shared instance (options apply on first call only)
 *   createAudioReactive(options?)  a private instance, if you need your own tuning
 *
 *   .update(dt)   Samples the spectrum and advances the smoothing; `dt` in
 *                 seconds. Safe to call from several modules in the same frame:
 *                 the FFT is read at most once every 2 ms, later callers just
 *                 re-read the cached values. One getByteFrequencyData() over a
 *                 512-bin FFT is a few tens of microseconds.
 *   .level        0..1  overall loudness
 *   .bass         0..1  energy below ~250 Hz
 *   .mid          0..1  energy ~250 Hz .. 2 kHz
 *   .treble       0..1  energy ~2 kHz .. 8 kHz
 *   .beat         0..1  pulse: jumps towards 1 on a bass transient, decays in ~0.15 s
 *   .active       true while the context is running and something is audible
 *   .dispose()    disconnects the tap
 *
 * Every value is exactly 0 when there is no AudioContext, when it is suspended,
 * or when the room is silent, and is never NaN — callers can multiply by them
 * without guarding. Smoothing is framerate independent (exponential decay on
 * dt), with a fast attack and a slower release so visuals snap to hits but
 * settle gently.
 *
 * The analyser is a *tap*: master already reaches the destination, so nothing
 * is routed through this module and audio is unaffected if it fails to attach.
 */

const BANDS = {
    // [lowHz, highHz]
    bass: [40, 250],
    mid: [250, 2000],
    treble: [2000, 8000],
    level: [40, 10000],
};

// Framerate-independent exponential approach: reaches ~63% of the gap in `tau`.
function approach(current, target, tau, dt) {
    return current + (target - current) * (1 - Math.exp(-dt / Math.max(tau, 1e-4)));
}

export class AudioReactive {
    /**
     * @param {object} [options]
     * @param {number} [options.fftSize]      power of two, 256..2048
     * @param {number} [options.minDecibels]  bottom of the byte range
     * @param {number} [options.maxDecibels]  top of the byte range
     * @param {number} [options.gain]         scales the normalised bands before clamping
     */
    constructor({ fftSize = 1024, minDecibels = -74, maxDecibels = -16, gain = 1.25 } = {}) {
        this.level = 0;
        this.bass = 0;
        this.mid = 0;
        this.treble = 0;
        this.beat = 0;
        this.active = false;

        this.options = { fftSize, minDecibels, maxDecibels, gain };
        this.analyser = null;
        this.bins = null;
        this.ranges = null;
        this.failed = false;
        this.lastSample = -1e9;
        this.bassFloor = 0;
        this.beatCooldown = 0;
    }

    // Attached lazily: the AudioContext may not exist when the room is built.
    attach() {
        if (this.analyser || this.failed) return this.analyser;
        const ctx = getAudioContext();
        const master = getMasterOutput();
        if (!ctx || !master) {
            this.failed = true;
            return null;
        }
        const analyser = ctx.createAnalyser();
        analyser.fftSize = this.options.fftSize;
        analyser.minDecibels = this.options.minDecibels;
        analyser.maxDecibels = this.options.maxDecibels;
        // A little smoothing in the node itself; the rest is done on dt below so
        // the look does not change with the frame rate.
        analyser.smoothingTimeConstant = 0.5;
        master.connect(analyser);
        // A node with no path to the destination is not guaranteed to be pulled,
        // so the tap ends in a muted sink. It adds nothing audible.
        const sink = ctx.createGain();
        sink.gain.value = 0;
        analyser.connect(sink);
        sink.connect(ctx.destination);

        this.ctx = ctx;
        this.master = master;
        this.sink = sink;
        this.analyser = analyser;
        this.bins = new Uint8Array(analyser.frequencyBinCount);

        const hzPerBin = ctx.sampleRate / analyser.fftSize;
        this.ranges = {};
        for (const [name, [low, high]] of Object.entries(BANDS)) {
            const from = Math.max(1, Math.floor(low / hzPerBin));
            const to = Math.min(this.bins.length - 1, Math.ceil(high / hzPerBin));
            this.ranges[name] = [from, Math.max(from, to)];
        }
        return analyser;
    }

    bandAverage(name) {
        const [from, to] = this.ranges[name];
        let sum = 0;
        for (let i = from; i <= to; i++) sum += this.bins[i];
        return sum / ((to - from + 1) * 255);
    }

    /** @param {number} dt seconds since the previous frame */
    update(dt = 1 / 60) {
        if (!Number.isFinite(dt) || dt <= 0) dt = 1 / 60;
        dt = Math.min(dt, 0.1);

        const analyser = this.attach();
        if (!analyser || this.ctx.state !== 'running') {
            this.silence(dt);
            return;
        }

        // Several modules read this each frame; only the first one pays for it.
        const now = performance.now();
        if (now - this.lastSample < 2) return;
        this.lastSample = now;

        analyser.getByteFrequencyData(this.bins);
        const g = this.options.gain;
        const rawBass = Math.min(1, this.bandAverage('bass') * g);
        const rawMid = Math.min(1, this.bandAverage('mid') * g);
        const rawTreble = Math.min(1, this.bandAverage('treble') * g);
        const rawLevel = Math.min(1, this.bandAverage('level') * g);

        // Fast attack, slow release: hits read as hits, tails fade out smoothly.
        const ride = (current, target) => approach(current, target, target > current ? 0.035 : 0.16, dt);
        this.level = ride(this.level, rawLevel);
        this.bass = ride(this.bass, rawBass);
        this.mid = ride(this.mid, rawMid);
        this.treble = ride(this.treble, rawTreble);

        // Beat = bass jumping clear of its own running average.
        this.bassFloor = approach(this.bassFloor, rawBass, rawBass > this.bassFloor ? 0.25 : 0.6, dt);
        this.beatCooldown -= dt;
        if (this.beatCooldown <= 0 && rawBass > this.bassFloor * 1.3 + 0.05) {
            this.beat = 1;
            this.beatCooldown = 0.11;
        } else {
            this.beat = approach(this.beat, 0, 0.09, dt);
        }

        this.active = rawLevel > 0.01;
        this.sanitize();
    }

    // No context, suspended, or torn down: glide everything to a hard zero.
    silence(dt) {
        this.level = approach(this.level, 0, 0.2, dt);
        this.bass = approach(this.bass, 0, 0.2, dt);
        this.mid = approach(this.mid, 0, 0.2, dt);
        this.treble = approach(this.treble, 0, 0.2, dt);
        this.beat = approach(this.beat, 0, 0.09, dt);
        this.active = false;
        this.sanitize();
    }

    sanitize() {
        for (const key of ['level', 'bass', 'mid', 'treble', 'beat']) {
            const v = this[key];
            this[key] = Number.isFinite(v) ? (v < 1e-4 ? 0 : Math.min(1, v)) : 0;
        }
    }

    dispose() {
        try {
            if (this.analyser && this.master) this.master.disconnect(this.analyser);
            if (this.sink) this.sink.disconnect();
        } catch (err) {
            // Already gone; nothing to clean up.
        }
        this.analyser = null;
        this.bins = null;
        this.failed = true;
        this.level = 0;
        this.bass = 0;
        this.mid = 0;
        this.treble = 0;
        this.beat = 0;
        this.active = false;
    }
}

export function createAudioReactive(options) {
    return new AudioReactive(options);
}

let shared = null;

/** The instance the room, the neon and the jukebox all read from. */
export function getAudioReactive(options) {
    if (!shared) shared = new AudioReactive(options);
    return shared;
}
