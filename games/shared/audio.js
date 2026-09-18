// Tiny WebAudio synth shared by the arcade and every game. Everything is
// generated at runtime, so there are no audio assets to ship.

let context = null;
let master = null;

export function getAudioContext() {
    if (!context) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        context = new Ctx();
        master = context.createGain();
        master.gain.value = 0.8;
        master.connect(context.destination);
    }
    return context;
}

export function getMasterOutput() {
    getAudioContext();
    return master;
}

// Browsers keep the context suspended until a user gesture.
export function resumeAudio() {
    const ctx = getAudioContext();
    if (ctx && ctx.state !== 'running') ctx.resume();
}

export function setMasterVolume(value) {
    getAudioContext();
    if (master) master.gain.value = value;
}

let noiseBuffer = null;
function getNoiseBuffer(ctx) {
    if (!noiseBuffer) {
        noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
}

const NOTE_OFFSETS = { c: -9, d: -7, e: -5, f: -4, g: -2, a: 0, b: 2 };

// "A4", "C#5", "Eb3" -> Hz. Numbers pass through untouched.
export function noteToFreq(note) {
    if (typeof note === 'number') return note;
    const m = /^([a-gA-G])([#b]?)(-?\d)$/.exec(note);
    if (!m) return 0;
    let semis = NOTE_OFFSETS[m[1].toLowerCase()] + (parseInt(m[3], 10) - 4) * 12;
    if (m[2] === '#') semis++;
    if (m[2] === 'b') semis--;
    return 440 * Math.pow(2, semis / 12);
}

const PRESETS = {
    coin: (s) => {
        s.tone({ freq: 988, duration: 0.08, type: 'square', volume: 0.25 });
        s.tone({ freq: 1319, duration: 0.35, type: 'square', volume: 0.25, delay: 0.08 });
    },
    start: (s) => {
        ['C5', 'E5', 'G5', 'C6'].forEach((n, i) =>
            s.tone({ freq: noteToFreq(n), duration: 0.1, type: 'square', volume: 0.2, delay: i * 0.08 }));
    },
    select: (s) => s.tone({ freq: 660, duration: 0.06, type: 'square', volume: 0.18 }),
    blip: (s) => s.tone({ freq: 880, duration: 0.04, type: 'square', volume: 0.12 }),
    shoot: (s) => s.tone({ freq: 900, freqEnd: 200, duration: 0.12, type: 'square', volume: 0.15 }),
    laser: (s) => s.tone({ freq: 1600, freqEnd: 300, duration: 0.15, type: 'sawtooth', volume: 0.12 }),
    hit: (s) => {
        s.tone({ freq: 220, freqEnd: 80, duration: 0.12, type: 'square', volume: 0.25 });
        s.noise({ duration: 0.1, volume: 0.2, filterFreq: 3000 });
    },
    explosion: (s) => {
        s.noise({ duration: 0.5, volume: 0.45, filterFreq: 2400, filterEnd: 150 });
        s.tone({ freq: 140, freqEnd: 40, duration: 0.4, type: 'sine', volume: 0.4 });
    },
    bigExplosion: (s) => {
        s.noise({ duration: 1.2, volume: 0.6, filterFreq: 1800, filterEnd: 60 });
        s.tone({ freq: 90, freqEnd: 25, duration: 1.0, type: 'sine', volume: 0.6 });
    },
    powerup: (s) => s.tone({ freq: 400, freqEnd: 1600, duration: 0.3, type: 'square', volume: 0.18 }),
    bounce: (s) => s.tone({ freq: 520, duration: 0.05, type: 'square', volume: 0.15 }),
    thud: (s) => s.tone({ freq: 160, freqEnd: 60, duration: 0.12, type: 'triangle', volume: 0.35 }),
    jump: (s) => s.tone({ freq: 300, freqEnd: 700, duration: 0.15, type: 'square', volume: 0.15 }),
    extraLife: (s) => {
        ['E6', 'G6', 'E7', 'C7', 'D7', 'G7'].forEach((n, i) =>
            s.tone({ freq: noteToFreq(n), duration: 0.09, type: 'square', volume: 0.15, delay: i * 0.07 }));
    },
    gameOver: (s) => {
        ['G4', 'E4', 'C4', 'G3'].forEach((n, i) =>
            s.tone({ freq: noteToFreq(n), duration: 0.28, type: 'triangle', volume: 0.3, delay: i * 0.22 }));
    },
    victory: (s) => {
        ['C5', 'C5', 'C5', 'C5', 'Ab4', 'Bb4', 'C5', 'Bb4', 'C5'].forEach((n, i) => {
            const times = [0, 0.12, 0.24, 0.36, 0.6, 0.84, 1.08, 1.26, 1.38];
            s.tone({ freq: noteToFreq(n), duration: i === 8 ? 0.6 : 0.11, type: 'square', volume: 0.18, delay: times[i] });
        });
    },
};

// A per-game sound bank. Each game gets its own output gain so the host can
// fade a cabinet in and out (e.g. quiet attract mode, full volume when played).
export class SoundBank {
    constructor() {
        this.ctx = getAudioContext();
        this.output = null;
        if (this.ctx) {
            this.output = this.ctx.createGain();
            this.output.connect(master);
        }
        this.lastPlayed = {};
    }

    setVolume(value, rampSeconds = 0.15) {
        if (!this.output) return;
        // The arcade calls this every frame; skip redundant automation events.
        if (this.targetVolume !== undefined && Math.abs(value - this.targetVolume) < 0.002) return;
        this.targetVolume = value;
        const now = this.ctx.currentTime;
        this.output.gain.cancelScheduledValues(now);
        this.output.gain.setTargetAtTime(value, now, rampSeconds / 3);
    }

    get ready() {
        return this.ctx && this.ctx.state === 'running' && this.output.gain.value > 0.001;
    }

    // Play a named preset. `minGap` stops rapid-fire repeats from stacking up.
    play(name, minGap = 0.03) {
        if (!this.ready) return;
        const now = this.ctx.currentTime;
        if (this.lastPlayed[name] !== undefined && now - this.lastPlayed[name] < minGap) return;
        this.lastPlayed[name] = now;
        const preset = PRESETS[name];
        if (preset) preset(this);
    }

    tone({ freq = 440, freqEnd = null, duration = 0.1, type = 'square', volume = 0.2, delay = 0, attack = 0.005 }) {
        if (!this.ready) return;
        const ctx = this.ctx;
        const t = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t + duration);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(volume, t + attack);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        osc.connect(gain);
        gain.connect(this.output);
        osc.start(t);
        osc.stop(t + duration + 0.02);
    }

    noise({ duration = 0.2, volume = 0.3, filterFreq = 2000, filterEnd = null, delay = 0, type = 'lowpass' }) {
        if (!this.ready) return;
        const ctx = this.ctx;
        const t = ctx.currentTime + delay;
        const src = ctx.createBufferSource();
        src.buffer = getNoiseBuffer(ctx);
        const filter = ctx.createBiquadFilter();
        filter.type = type;
        filter.frequency.setValueAtTime(filterFreq, t);
        if (filterEnd) filter.frequency.exponentialRampToValueAtTime(Math.max(20, filterEnd), t + duration);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(volume, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.output);
        src.start(t, Math.random());
        src.stop(t + duration + 0.02);
    }
}

// A minimal looping step sequencer for background chiptunes.
// tracks: [{ notes: ['C3', null, 'G3', ...], type: 'triangle', volume: 0.1, length: 0.9 }]
// Each entry is one step (a 16th note at the given bpm); null is a rest.
export class ChipTune {
    constructor(sounds, { bpm = 120, tracks = [] }) {
        this.sounds = sounds;
        this.bpm = bpm;
        this.tracks = tracks;
        this.playing = false;
        this.step = 0;
        this.nextTime = 0;
        this.timer = null;
    }

    get stepSeconds() {
        return 60 / this.bpm / 4;
    }

    start() {
        const ctx = this.sounds.ctx;
        if (this.playing || !ctx) return;
        this.playing = true;
        this.step = 0;
        this.nextTime = ctx.currentTime + 0.05;
        this.timer = setInterval(() => this.schedule(), 50);
    }

    stop() {
        this.playing = false;
        clearInterval(this.timer);
        this.timer = null;
    }

    schedule() {
        const s = this.sounds;
        const ctx = s.ctx;
        if (!s.ready) {
            // Keep the clock moving so we don't burst-play when unmuted.
            this.nextTime = ctx.currentTime + 0.05;
            return;
        }
        // After a stall (throttled timer, long frame) skip the missed steps instead of bursting them.
        if (this.nextTime < ctx.currentTime) this.nextTime = ctx.currentTime + 0.02;
        while (this.nextTime < ctx.currentTime + 0.2) {
            const delay = Math.max(0, this.nextTime - ctx.currentTime);
            for (const track of this.tracks) {
                const note = track.notes[this.step % track.notes.length];
                if (note) {
                    s.tone({
                        freq: noteToFreq(note),
                        duration: this.stepSeconds * (track.length || 0.9),
                        type: track.type || 'square',
                        volume: track.volume || 0.08,
                        delay,
                    });
                }
            }
            this.step++;
            this.nextTime += this.stepSeconds;
        }
    }
}
