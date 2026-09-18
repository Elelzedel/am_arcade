import { ChipTune, noteToFreq } from '../../../shared/audio.js';

// Original driving loop in A minor: Am - F - C - G.
const CHORDS = [
    ['A', 'C', 'E'],
    ['F', 'A', 'C'],
    ['C', 'E', 'G'],
    ['G', 'B', 'D'],
];

function bassTrack() {
    const shape = [1, 0, 1, 2, 0, 1, 2, 0, 1, 0, 1, 2, 0, 2, 1, 2];
    const notes = [];
    for (const [root] of CHORDS) {
        for (const k of shape) notes.push(k === 0 ? null : `${root}${k === 1 ? 2 : 3}`);
    }
    return notes;
}

function arpTrack() {
    const order = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 2, 3, 2];
    const notes = [];
    for (const chord of CHORDS) {
        const tones = [`${chord[0]}4`, `${chord[1]}4`, `${chord[2]}4`, `${chord[0]}5`];
        for (let i = 0; i < 16; i++) notes.push(i % 2 === 0 ? tones[order[i]] : null);
    }
    return notes;
}

const _ = null;
const LEAD = [
    'E5', _, _, _, 'A5', _, 'G5', _, 'E5', _, 'D5', _, 'E5', _, _, _,
    'C5', _, _, _, 'F5', _, 'E5', _, 'C5', _, 'A4', _, 'C5', _, 'D5', _,
    'E5', _, _, _, 'G5', _, _, _, 'C6', _, 'B5', _, 'G5', _, 'E5', _,
    'D5', _, 'G5', _, 'B5', _, _, _, 'A5', _, 'G5', _, 'D5', _, 'B4', _,
];
const LEAD_B = [
    'A5', _, 'C6', _, 'B5', _, 'A5', _, 'E5', _, _, _, 'A5', _, 'B5', _,
    'C6', _, _, _, 'A5', _, 'F5', _, 'A5', _, 'C6', _, 'D6', _, 'C6', _,
    'E6', _, _, _, 'D6', _, 'C6', _, 'G5', _, _, _, 'E5', _, 'G5', _,
    'B5', _, _, _, 'A5', _, 'G5', _, 'D5', _, 'G5', _, 'B5', _, 'D6', _,
];

const KICK = [];
for (let i = 0; i < 16; i++) KICK.push(i % 4 === 0 ? 'A1' : null);

export function createMusic(sounds) {
    const bass = bassTrack();
    const arp = arpTrack();
    return new ChipTune(sounds, {
        bpm: 142,
        tracks: [
            { notes: [...bass, ...bass], type: 'square', volume: 0.045, length: 0.6 },
            { notes: [...arp, ...arp], type: 'square', volume: 0.022, length: 0.5 },
            { notes: [...LEAD, ...LEAD_B], type: 'triangle', volume: 0.075, length: 1.7 },
            { notes: KICK, type: 'sine', volume: 0.12, length: 0.45 },
        ],
    });
}

// Game-specific sound effects built on the shared synth.
export class Sfx {
    constructor(sounds) {
        this.sounds = sounds;
        this.last = {};
    }

    gate(name, gap) {
        const ctx = this.sounds.ctx;
        if (!ctx || !this.sounds.ready) return false;
        const now = ctx.currentTime;
        if (this.last[name] !== undefined && now - this.last[name] < gap) return false;
        this.last[name] = now;
        return true;
    }

    orb(chain) {
        if (!this.gate('orb', 0.03)) return;
        const base = 900 * Math.pow(2, Math.min(chain, 12) / 12);
        this.sounds.tone({ freq: base, freqEnd: base * 1.5, duration: 0.07, type: 'square', volume: 0.09 });
        this.sounds.tone({ freq: base * 2, duration: 0.05, type: 'sine', volume: 0.06, delay: 0.04 });
    }

    nearMiss() {
        if (!this.gate('near', 0.1)) return;
        this.sounds.noise({ duration: 0.25, volume: 0.25, filterFreq: 600, filterEnd: 5000, type: 'bandpass' });
        this.sounds.tone({ freq: noteToFreq('E6'), duration: 0.06, type: 'square', volume: 0.08, delay: 0.05 });
        this.sounds.tone({ freq: noteToFreq('B6'), duration: 0.1, type: 'square', volume: 0.08, delay: 0.11 });
    }

    scrape() {
        if (!this.gate('scrape', 0.09)) return;
        this.sounds.noise({ duration: 0.1, volume: 0.18, filterFreq: 3500, type: 'highpass' });
        this.sounds.tone({ freq: 90 + Math.random() * 40, duration: 0.08, type: 'sawtooth', volume: 0.06 });
    }

    boost() {
        if (!this.gate('boost', 0.25)) return;
        this.sounds.noise({ duration: 0.5, volume: 0.25, filterFreq: 300, filterEnd: 3000, type: 'bandpass' });
        this.sounds.tone({ freq: 120, freqEnd: 480, duration: 0.4, type: 'sawtooth', volume: 0.08 });
    }

    empty() {
        if (!this.gate('empty', 0.3)) return;
        this.sounds.tone({ freq: 200, freqEnd: 120, duration: 0.12, type: 'square', volume: 0.08 });
    }

    hit() {
        this.sounds.play('explosion');
        this.sounds.play('hit');
    }

    shieldUp() {
        this.sounds.play('powerup');
        this.sounds.tone({ freq: noteToFreq('A5'), duration: 0.12, type: 'triangle', volume: 0.15, delay: 0.25 });
        this.sounds.tone({ freq: noteToFreq('E6'), duration: 0.2, type: 'triangle', volume: 0.15, delay: 0.35 });
    }

    sector() {
        ['A4', 'C5', 'E5', 'A5', 'E5', 'A5'].forEach((n, i) =>
            this.sounds.tone({ freq: noteToFreq(n), duration: 0.12, type: 'square', volume: 0.12, delay: i * 0.07 }));
        this.sounds.noise({ duration: 0.8, volume: 0.15, filterFreq: 400, filterEnd: 6000, type: 'bandpass' });
    }

    warning() {
        if (!this.gate('warn', 0.2)) return;
        this.sounds.tone({ freq: 1400, duration: 0.05, type: 'square', volume: 0.07 });
        this.sounds.tone({ freq: 1400, duration: 0.05, type: 'square', volume: 0.07, delay: 0.1 });
    }

    crash() {
        this.sounds.play('bigExplosion');
    }
}
