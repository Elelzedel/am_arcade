import { getAudioContext, getMasterOutput, resumeAudio } from '../../../games/shared/audio.js';

/**
 * Everything that isn't music: the rain on the street, the hum of the room,
 * and the small sounds that answer the visitor's hand. All synthesized.
 */
class Sfx {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.lastHover = 0;
    }

    ensure() {
        if (this.ctx) return true;
        const ctx = getAudioContext();
        if (!ctx) return false;
        this.ctx = ctx;
        const len = ctx.sampleRate * 3;
        this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        // pinkish noise (Paul Kellet's filter) sounds like rain, not static
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < len; i++) {
            const w = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
            b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
            d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
            b6 = w * 0.115926;
        }
        this.out = ctx.createGain();
        this.out.connect(getMasterOutput());
        this.ambience = ctx.createGain();
        this.ambience.gain.value = 0;
        this.ambience.connect(this.out);
        return true;
    }

    start() {
        resumeAudio();
        if (!this.ensure() || this.started) return;
        this.started = true;
        const ctx = this.ctx;
        // rain: two layers, a soft wash and a brighter patter
        const wash = this.loop(this.noise, 1);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1400;
        const washGain = ctx.createGain();
        washGain.gain.value = 0.55;
        wash.connect(lp).connect(washGain).connect(this.ambience);
        const patter = this.loop(this.noise, 1.37);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 4200;
        bp.Q.value = 0.7;
        const patterGain = ctx.createGain();
        patterGain.gain.value = 0.22;
        patter.connect(bp).connect(patterGain).connect(this.ambience);
        // mains hum from the signs
        const hum = ctx.createOscillator();
        hum.type = 'sawtooth';
        hum.frequency.value = 60;
        const humF = ctx.createBiquadFilter();
        humF.type = 'lowpass';
        humF.frequency.value = 240;
        const humG = ctx.createGain();
        humG.gain.value = 0.018;
        hum.connect(humF).connect(humG).connect(this.ambience);
        hum.start();
        this.ambience.gain.setTargetAtTime(0.5, ctx.currentTime, 1.5);
        // the odd heavy drip off the sign
        const drip = () => {
            if (!this.muted) this.drip();
            this.dripTimer = setTimeout(drip, 900 + Math.random() * 2600);
        };
        drip();
    }

    loop(buffer, rate) {
        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        src.playbackRate.value = rate;
        src.start();
        return src;
    }

    // 0 = standing in the street, 1 = nose to a screen
    setFocus(amount) {
        if (!this.ctx) return;
        this.ambience.gain.setTargetAtTime(0.5 - amount * 0.35, this.ctx.currentTime, 0.4);
    }

    setMuted(muted) {
        this.muted = muted;
    }

    env(g, t, a, peak, r) {
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + a);
        g.gain.exponentialRampToValueAtTime(0.0001, t + a + r);
    }

    tone(freq, { type = 'sine', t = 0, a = 0.005, peak = 0.1, r = 0.12, to = null, dest = null } = {}) {
        if (!this.ensure()) return;
        const ctx = this.ctx;
        const time = ctx.currentTime + t;
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(freq, time);
        if (to) o.frequency.exponentialRampToValueAtTime(to, time + a + r);
        const g = ctx.createGain();
        this.env(g, time, a, peak, r);
        o.connect(g).connect(dest || this.out);
        o.start(time);
        o.stop(time + a + r + 0.05);
    }

    noiseBurst({ t = 0, type = 'bandpass', freq = 1000, to = null, q = 1, peak = 0.1, a = 0.005, r = 0.2 } = {}) {
        if (!this.ensure()) return;
        const ctx = this.ctx;
        const time = ctx.currentTime + t;
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        const f = ctx.createBiquadFilter();
        f.type = type;
        f.frequency.setValueAtTime(freq, time);
        if (to) f.frequency.exponentialRampToValueAtTime(to, time + a + r);
        f.Q.value = q;
        const g = ctx.createGain();
        this.env(g, time, a, peak, r);
        src.connect(f).connect(g).connect(this.out);
        src.start(time, Math.random() * 2);
        src.stop(time + a + r + 0.05);
    }

    // ---- the vocabulary ------------------------------------------------------

    hover() {
        const now = performance.now();
        if (now - this.lastHover < 60) return;
        this.lastHover = now;
        this.tone(1760, { peak: 0.025, r: 0.05 });
        this.tone(2640, { t: 0.02, peak: 0.015, r: 0.05 });
    }

    click() {
        this.tone(880, { type: 'triangle', peak: 0.06, r: 0.06 });
        this.tone(1320, { type: 'triangle', t: 0.05, peak: 0.05, r: 0.1 });
    }

    back() {
        this.tone(1100, { type: 'triangle', peak: 0.05, r: 0.06 });
        this.tone(740, { type: 'triangle', t: 0.05, peak: 0.05, r: 0.1 });
    }

    whoosh(up = true) {
        this.noiseBurst({ type: 'bandpass', freq: up ? 300 : 2400, to: up ? 2600 : 300, q: 0.9, peak: 0.07, a: 0.35, r: 0.6 });
    }

    coin() {
        this.tone(988, { type: 'square', peak: 0.05, r: 0.08 });
        this.tone(1319, { type: 'square', t: 0.08, peak: 0.05, r: 0.35 });
    }

    // neon catching: a tick and a short buzz
    ignite(t = 0) {
        this.noiseBurst({ t, type: 'highpass', freq: 3000, peak: 0.03, r: 0.02 });
        this.tone(120, { type: 'sawtooth', t, peak: 0.012, a: 0.01, r: 0.25 });
    }

    // the breaker: a heavy clunk
    breaker() {
        this.tone(90, { type: 'sine', peak: 0.3, r: 0.25, to: 50 });
        this.noiseBurst({ type: 'lowpass', freq: 700, peak: 0.25, r: 0.12 });
    }

    meow(pets = 1) {
        if (!this.ensure()) return;
        const ctx = this.ctx;
        const t = ctx.currentTime;
        const trill = pets > 2;
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        const base = trill ? 520 : 560;
        o.frequency.setValueAtTime(base, t);
        o.frequency.linearRampToValueAtTime(base * 1.45, t + 0.12);
        o.frequency.linearRampToValueAtTime(base * 0.85, t + 0.42);
        const f1 = ctx.createBiquadFilter();
        f1.type = 'bandpass';
        f1.Q.value = 5;
        f1.frequency.setValueAtTime(900, t);
        f1.frequency.linearRampToValueAtTime(1700, t + 0.15);
        f1.frequency.linearRampToValueAtTime(800, t + 0.45);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.18, t + 0.05);
        g.gain.setValueAtTime(0.18, t + 0.3);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        // a purr-ish tremolo when it's a trill
        if (trill) {
            const lfo = ctx.createOscillator();
            const depth = ctx.createGain();
            lfo.frequency.value = 26;
            depth.gain.value = 0.09;
            lfo.connect(depth).connect(g.gain);
            lfo.start(t);
            lfo.stop(t + 0.55);
        }
        o.connect(f1).connect(g).connect(this.out);
        o.start(t);
        o.stop(t + 0.55);
    }

    clunk() {
        this.tone(70, { peak: 0.35, r: 0.3, to: 40 });
        this.noiseBurst({ type: 'lowpass', freq: 500, peak: 0.2, r: 0.18 });
        // the can rattles into the tray
        for (let i = 0; i < 3; i++) this.tone(1800 + i * 300, { type: 'triangle', t: 0.2 + i * 0.07, peak: 0.03, r: 0.05 });
    }

    rocket() {
        this.noiseBurst({ type: 'lowpass', freq: 200, to: 1400, peak: 0.12, a: 0.6, r: 1.2 });
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, { type: 'square', t: i * 0.12, peak: 0.035, r: 0.1 }));
    }

    rustle() {
        this.noiseBurst({ type: 'bandpass', freq: 2500, q: 0.6, peak: 0.08, a: 0.02, r: 0.3 });
        this.noiseBurst({ t: 0.15, type: 'bandpass', freq: 1800, q: 0.6, peak: 0.06, a: 0.02, r: 0.25 });
    }

    squeak() {
        this.tone(2200, { type: 'sine', peak: 0.05, a: 0.01, r: 0.08, to: 3000 });
        this.tone(2600, { type: 'sine', t: 0.12, peak: 0.04, a: 0.01, r: 0.08, to: 3400 });
    }

    // tyres hissing through the wet, rising and falling as it passes
    carPass(seconds) {
        if (!this.ensure() || this.muted) return;
        const ctx = this.ctx;
        const t = ctx.currentTime;
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        src.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.Q.value = 0.8;
        f.frequency.setValueAtTime(700, t);
        f.frequency.linearRampToValueAtTime(1500, t + seconds * 0.5);
        f.frequency.linearRampToValueAtTime(600, t + seconds);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.09, t + seconds * 0.5);
        g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
        const pan = ctx.createStereoPanner();
        pan.pan.setValueAtTime(-0.9, t);
        pan.pan.linearRampToValueAtTime(0.9, t + seconds);
        src.connect(f).connect(g).connect(pan).connect(this.out);
        src.start(t);
        src.stop(t + seconds + 0.1);
        // and a soft engine burble underneath
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(48, t);
        o.frequency.linearRampToValueAtTime(58, t + seconds * 0.5);
        o.frequency.linearRampToValueAtTime(44, t + seconds);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 180;
        const eg = ctx.createGain();
        eg.gain.setValueAtTime(0.0001, t);
        eg.gain.exponentialRampToValueAtTime(0.05, t + seconds * 0.5);
        eg.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
        o.connect(lp).connect(eg).connect(pan);
        o.start(t);
        o.stop(t + seconds + 0.1);
    }

    // a footstep: a soft thud, splashier out in the wet
    step(intensity = 0.5, inside = false) {
        if (!this.ctx || this.muted) return;
        const level = 0.035 + intensity * 0.04;
        this.tone(inside ? 95 : 120, { peak: level, a: 0.004, r: 0.07, to: 60 });
        this.noiseBurst(inside
            ? { type: 'lowpass', freq: 900, peak: level * 0.8, a: 0.003, r: 0.06 }
            : { type: 'bandpass', freq: 2600, q: 0.8, peak: level * 1.2, a: 0.004, r: 0.12 });
    }

    // a toy's springy hop
    boing() {
        this.tone(320, { type: 'sine', peak: 0.07, a: 0.005, r: 0.22, to: 760 });
        this.tone(640, { type: 'triangle', t: 0.02, peak: 0.02, a: 0.005, r: 0.18, to: 1200 });
    }

    // over the edge: a slide-whistle fall, a panicked honk, and far, far below, a bonk
    fall() {
        if (!this.ensure() || this.muted) return;
        this.tone(1400, { type: 'sine', t: 0.35, a: 0.05, peak: 0.05, r: 1.6, to: 180 });
        this.tone(1410, { type: 'triangle', t: 0.35, a: 0.05, peak: 0.02, r: 1.6, to: 182 });
        for (const [f, t] of [[392, 0.1], [370, 0.28]]) this.tone(f, { type: 'square', t, peak: 0.03, a: 0.01, r: 0.14 });
        this.tone(90, { type: 'sine', t: 2.4, peak: 0.05, a: 0.005, r: 0.3, to: 45 });
        this.noiseBurst({ t: 2.4, type: 'lowpass', freq: 400, peak: 0.04, r: 0.25 });
    }

    honk() {
        for (const [f, t] of [[392, 0], [494, 0], [392, 0.22], [494, 0.22]]) this.tone(f, { type: 'square', t, peak: 0.035, a: 0.01, r: 0.16 });
    }

    drip() {
        this.tone(1200 + Math.random() * 900, { type: 'sine', peak: 0.012, a: 0.002, r: 0.06, to: 500 });
    }
}

export const sfx = new Sfx();
