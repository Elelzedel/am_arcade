import { getAudioContext, getMasterOutput, noteToFreq } from '../../../games/shared/audio.js';

/**
 * The jukebox's record collection: four small lo-fi pieces for 2 AM, played
 * live by a handful of synth voices (felt keys, a warm pad, round bass, brushed
 * drums) through tape saturation, a room reverb and a bed of vinyl crackle.
 */

const CHORDS = {
    Fmaj7: ['F3', 'A3', 'C4', 'E4'], Em7: ['E3', 'G3', 'B3', 'D4'], Dm7: ['D3', 'F3', 'A3', 'C4'], Cmaj7: ['C3', 'E3', 'G3', 'B3'],
    Am9: ['A2', 'C4', 'E4', 'G4', 'B4'], G6: ['G2', 'B3', 'D4', 'E4'], Bbmaj7: ['Bb2', 'D4', 'F4', 'A4'], C: ['C3', 'E3', 'G3', 'C4'],
    G7: ['G2', 'B3', 'D4', 'F4'], A7: ['A2', 'C#4', 'E4', 'G4'], Am: ['A2', 'C4', 'E4', 'A4'], F: ['F2', 'A3', 'C4', 'F4'], G: ['G2', 'B3', 'D4', 'G4'],
    Ebmaj7: ['Eb3', 'G3', 'Bb3', 'D4'], Cm7: ['C3', 'Eb3', 'G3', 'Bb3'], Abmaj7: ['Ab2', 'C4', 'Eb4', 'G4'], Bb7: ['Bb2', 'D4', 'F4', 'Ab4'],
};

const seq = (s) => s.trim().split(/\s+/).map((n) => (n === '.' ? null : n));

export const TRACKS = [
    {
        title: 'Night Shift', artist: 'the Tokens', color: '#ff4fa8', bpm: 82, swing: 0.16,
        chords: ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7'],
        melody: seq(`
            . . A4 . C5 . . E5   . . D5 . C5 . A4 .
            . . G4 . B4 . . D5   . . C5 . B4 . G4 .
            . . F4 . A4 . C5 .   E5 . . . D5 . C5 .
            . . E4 . G4 . B4 .   . . G4 . . . . .`),
        drums: { kick: [0, 7, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
    },
    {
        title: 'Quarter Moon', artist: 'Pixel Ghosts', color: '#48f0ff', bpm: 92, swing: 0.12,
        chords: ['Am9', 'Fmaj7', 'C', 'G6'],
        melody: seq(`
            E5 . . . . . D5 .   C5 . . . A4 . . .
            . . C5 . D5 . E5 .   . . . . C5 . . .
            G5 . . . E5 . . .   D5 . C5 . . . . .
            . . B4 . D5 . . .   . . . . . . . .`),
        drums: { kick: [0, 8, 11], snare: [4, 12], hat: [2, 6, 10, 14] },
    },
    {
        title: 'Last Bus Home', artist: 'Modem Dreams', color: '#ffb347', bpm: 70, swing: 0.2,
        chords: ['Ebmaj7', 'Cm7', 'Abmaj7', 'Bb7'],
        melody: seq(`
            G4 . . Bb4 . . D5 .   . . C5 . . . . .
            . . Eb5 . . . D5 .   C5 . . . G4 . . .
            . . C5 . Eb5 . . .   G5 . . . F5 . Eb5 .
            D5 . . . . . F5 .   . . . . . . . .`),
        drums: { kick: [0, 9], snare: [8], hat: [0, 4, 8, 12, 14] },
    },
    {
        title: 'Continue?', artist: 'Vector Patrol', color: '#8dff5c', bpm: 112, swing: 0.08,
        chords: ['Am', 'F', 'C', 'G'],
        melody: seq(`
            A4 C5 E5 . A5 . E5 .   C5 . E5 . G5 . E5 .
            F4 A4 C5 . F5 . C5 .   A4 . C5 . E5 . D5 .
            C5 E5 G5 . C6 . G5 .   E5 . G5 . A5 . G5 .
            G4 B4 D5 . G5 . D5 .   B4 . D5 . . . . .`),
        drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14, 15] },
    },
];

function makeImpulse(ctx, seconds = 2.4, decay = 2.8) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
}

function makeNoise(ctx, seconds = 2) {
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
}

function tapeCurve() {
    const n = 1024;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1;
        curve[i] = Math.tanh(x * 1.6) / Math.tanh(1.6);
    }
    return curve;
}

export class Jukebox {
    constructor() {
        this.ctx = null;
        this.index = 0;
        this.playing = false;
        this.step = 0;
        this.bar = 0;
        this.beatTimes = [];
        this.listeners = new Set();
    }

    ensure() {
        if (this.ctx) return true;
        const ctx = getAudioContext();
        if (!ctx) return false;
        this.ctx = ctx;
        this.noise = makeNoise(ctx);
        // chain: voices -> bus -> tape -> tone -> duck -> out; bus -> reverb -> tone
        this.bus = ctx.createGain();
        this.bus.gain.value = 0.9;
        const tape = ctx.createWaveShaper();
        tape.curve = tapeCurve();
        this.tone = ctx.createBiquadFilter();
        this.tone.type = 'lowpass';
        this.tone.frequency.value = 5200;
        this.tone.Q.value = 0.3;
        this.duck = ctx.createGain();
        this.duck.gain.value = 1;
        this.out = ctx.createGain();
        this.out.gain.value = 0.0;
        this.bus.connect(tape);
        tape.connect(this.tone);
        const verb = ctx.createConvolver();
        verb.buffer = makeImpulse(ctx);
        const send = ctx.createGain();
        send.gain.value = 0.32;
        this.bus.connect(send);
        send.connect(verb);
        verb.connect(this.tone);
        this.tone.connect(this.duck);
        this.duck.connect(this.out);
        this.out.connect(getMasterOutput());

        // vinyl bed: filtered hiss plus the odd crackle
        const hiss = ctx.createBufferSource();
        hiss.buffer = this.noise;
        hiss.loop = true;
        const hissFilter = ctx.createBiquadFilter();
        hissFilter.type = 'bandpass';
        hissFilter.frequency.value = 3200;
        hissFilter.Q.value = 0.6;
        this.hissGain = ctx.createGain();
        this.hissGain.gain.value = 0;
        hiss.connect(hissFilter);
        hissFilter.connect(this.hissGain);
        this.hissGain.connect(this.tone);
        hiss.start();
        return true;
    }

    get track() {
        return TRACKS[this.index];
    }

    onChange(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    play(index = this.index) {
        if (!this.ensure()) return;
        this.index = (index + TRACKS.length) % TRACKS.length;
        const now = this.ctx.currentTime;
        this.out.gain.cancelScheduledValues(now);
        this.out.gain.setTargetAtTime(0.62, now, 0.4);
        this.hissGain.gain.setTargetAtTime(0.012, now, 0.5);
        this.step = 0;
        this.bar = 0;
        this.nextTime = now + 0.12;
        if (!this.playing) {
            this.playing = true;
            this.timer = setInterval(() => this.schedule(), 40);
        }
        for (const fn of this.listeners) fn(this.track, true);
    }

    next() {
        // a needle drop between records
        this.scratch();
        this.play(this.index + 1);
    }

    stop() {
        if (!this.ctx) return;
        this.playing = false;
        clearInterval(this.timer);
        this.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
        this.hissGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
        for (const fn of this.listeners) fn(this.track, false);
    }

    // 0..1: how present the music is (ducked while a game is being played)
    setDuck(amount) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        this.duck.gain.setTargetAtTime(1 - amount * 0.8, now, 0.3);
        this.tone.frequency.setTargetAtTime(5200 - amount * 4200, now, 0.3);
    }

    scratch() {
        if (!this.ensure()) return;
        const ctx = this.ctx;
        const t = ctx.currentTime;
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        src.playbackRate.setValueAtTime(0.6, t);
        src.playbackRate.linearRampToValueAtTime(2.2, t + 0.08);
        src.playbackRate.linearRampToValueAtTime(0.4, t + 0.22);
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 1800;
        f.Q.value = 2;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0, t);
        g.gain.linearRampToValueAtTime(0.25, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        src.connect(f);
        f.connect(g);
        g.connect(getMasterOutput());
        src.start(t);
        src.stop(t + 0.3);
    }

    // ---- sequencing ---------------------------------------------------------

    schedule() {
        const ctx = this.ctx;
        if (!this.playing || ctx.state !== 'running') {
            this.nextTime = ctx.currentTime + 0.05;
            return;
        }
        const tr = this.track;
        const stepDur = 60 / tr.bpm / 4;
        if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.02;
        while (this.nextTime < ctx.currentTime + 0.15) {
            const s = this.step % 16;
            const swing = s % 2 === 1 ? tr.swing * stepDur : 0;
            const t = this.nextTime + swing;
            const chord = CHORDS[tr.chords[this.bar % tr.chords.length]];
            const barDur = stepDur * 16;

            if (s === 0) {
                this.pad(chord, t, barDur * 1.02);
                this.bass(chord[0], t, stepDur * 5);
                this.beatTimes.push(t);
            }
            if (s === 8 || s === 11) this.bass(s === 11 ? chord[2] : chord[0], t, stepDur * 2.5, 0.7);
            // felt keys: a lazy broken chord
            if ([0, 3, 6, 10, 13].includes(s)) {
                const n = chord[1 + ([0, 3, 6, 10, 13].indexOf(s) % (chord.length - 1))];
                this.keys(n, t, 1.4, s === 0 ? 0.12 : 0.07);
            }
            const mel = tr.melody[(this.bar % 4) * 16 + s];
            if (mel) this.lead(mel, t, stepDur * 3);
            if (tr.drums.kick.includes(s)) { this.kick(t); if (s !== 0) this.beatTimes.push(t); }
            if (tr.drums.snare.includes(s)) this.snare(t);
            if (tr.drums.hat.includes(s)) this.hat(t, s % 4 === 2 ? 0.05 : 0.03);
            if (Math.random() < 0.05) this.crackle(t + Math.random() * stepDur);

            this.step++;
            if (this.step % 16 === 0) this.bar++;
            this.nextTime += stepDur;
        }
        const now = ctx.currentTime;
        this.beatTimes = this.beatTimes.filter((bt) => bt > now - 1);
    }

    // seconds since the most recent beat that has actually sounded
    sinceBeat() {
        if (!this.ctx || !this.playing) return Infinity;
        const now = this.ctx.currentTime;
        let best = Infinity;
        for (const t of this.beatTimes) if (t <= now) best = Math.min(best, now - t);
        return best;
    }

    env(g, t, attack, peak, release) {
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
    }

    osc(type, freq, t, dur, dest, detune = 0) {
        const o = this.ctx.createOscillator();
        o.type = type;
        o.frequency.value = freq;
        o.detune.value = detune;
        o.connect(dest);
        o.start(t);
        o.stop(t + dur + 0.1);
        return o;
    }

    pad(chord, t, dur) {
        const ctx = this.ctx;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(500, t);
        f.frequency.linearRampToValueAtTime(1100, t + dur * 0.5);
        f.frequency.linearRampToValueAtTime(600, t + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.045, t + 0.6);
        g.gain.setValueAtTime(0.045, t + dur - 0.4);
        g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6);
        f.connect(g);
        g.connect(this.bus);
        for (const n of chord.slice(1)) {
            const hz = noteToFreq(n);
            this.osc('sawtooth', hz, t, dur + 0.7, f, -7);
            this.osc('sawtooth', hz, t, dur + 0.7, f, 7);
        }
    }

    bass(note, t, dur, level = 1) {
        const g = this.ctx.createGain();
        this.env(g, t, 0.01, 0.2 * level, dur);
        g.connect(this.bus);
        const hz = noteToFreq(note) / (noteToFreq(note) > 140 ? 2 : 1);
        this.osc('triangle', hz, t, dur, g);
        this.osc('sine', hz / 2, t, dur, g);
    }

    keys(note, t, dur, level) {
        const g = this.ctx.createGain();
        this.env(g, t, 0.005, level, dur);
        g.connect(this.bus);
        const hz = noteToFreq(note);
        this.osc('sine', hz, t, dur, g);
        const g2 = this.ctx.createGain();
        this.env(g2, t, 0.002, level * 0.35, 0.25);
        g2.connect(this.bus);
        this.osc('triangle', hz * 2, t, 0.3, g2);
    }

    lead(note, t, dur) {
        const ctx = this.ctx;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 1900;
        const g = ctx.createGain();
        this.env(g, t, 0.02, 0.05, dur * 1.8);
        f.connect(g);
        g.connect(this.bus);
        const o = this.osc('square', noteToFreq(note), t, dur * 2, f);
        const lfo = ctx.createOscillator();
        const depth = ctx.createGain();
        lfo.frequency.value = 5.2;
        depth.gain.value = 6;
        lfo.connect(depth);
        depth.connect(o.detune);
        lfo.start(t);
        lfo.stop(t + dur * 2 + 0.1);
    }

    noiseHit(t, { type, freq, q = 1, level, decay }) {
        const ctx = this.ctx;
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        const f = ctx.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        f.Q.value = q;
        const g = ctx.createGain();
        this.env(g, t, 0.001, level, decay);
        src.connect(f);
        f.connect(g);
        g.connect(this.bus);
        src.start(t, Math.random() * 1.5);
        src.stop(t + decay + 0.05);
    }

    kick(t) {
        const ctx = this.ctx;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.setValueAtTime(110, t);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
        this.env(g, t, 0.002, 0.34, 0.26);
        o.connect(g);
        g.connect(this.bus);
        o.start(t);
        o.stop(t + 0.35);
    }

    snare(t) {
        this.noiseHit(t, { type: 'bandpass', freq: 1700, q: 0.7, level: 0.1, decay: 0.2 });
        const g = this.ctx.createGain();
        this.env(g, t, 0.001, 0.05, 0.08);
        g.connect(this.bus);
        this.osc('triangle', 190, t, 0.1, g);
    }

    hat(t, level) {
        this.noiseHit(t, { type: 'highpass', freq: 7000, q: 0.5, level, decay: 0.045 });
    }

    crackle(t) {
        this.noiseHit(t, { type: 'highpass', freq: 2500, q: 0.8, level: 0.03 + Math.random() * 0.04, decay: 0.008 });
    }
}

export const jukebox = new Jukebox();
