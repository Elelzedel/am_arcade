import { getAudioContext, getMasterOutput, SoundBank } from '../../games/shared/audio.js';

// Room tone (HVAC rumble + fluorescent hum) and footsteps.
export default class Ambience {
    constructor() {
        this.started = false;
        this.foot = 0;
        this.steps = new SoundBank();
        this.steps.setVolume(0.6, 0);
    }

    start() {
        const ctx = getAudioContext();
        if (!ctx || this.started) return;
        this.started = true;

        const out = ctx.createGain();
        out.gain.value = 0;
        out.gain.setTargetAtTime(1, ctx.currentTime, 1.5);
        out.connect(getMasterOutput());
        this.output = out;

        // Brownish noise rumble.
        const length = ctx.sampleRate * 4;
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let last = 0;
        for (let i = 0; i < length; i++) {
            last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
            data[i] = last * 3.5;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;
        const lowpass = ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 300;
        const noiseGain = ctx.createGain();
        noiseGain.gain.value = 0.12;
        noise.connect(lowpass).connect(noiseGain).connect(out);
        noise.start();

        // Mains hum from the lights.
        for (const [freq, vol] of [[60, 0.012], [120, 0.008], [180, 0.003]]) {
            const osc = ctx.createOscillator();
            osc.frequency.value = freq;
            const g = ctx.createGain();
            g.gain.value = vol;
            osc.connect(g).connect(out);
            osc.start();
        }
    }

    // Soft carpet footstep; intensity 0..1 scales with walking speed, foot 0/1
    // is which foot landed. The two feet differ slightly in pitch and weight so
    // a walk reads as left-right-left instead of one foot stamping.
    footstep(intensity, foot = (this.foot ^= 1)) {
        const lead = !foot;
        const pitch = (lead ? 0.88 : 1.0) * (0.94 + Math.random() * 0.12);
        const gain = lead ? 1 : 0.86;
        this.steps.noise({ duration: 0.09, volume: (0.05 + intensity * 0.06) * gain, filterFreq: 500 * pitch, filterEnd: 120 });
        this.steps.tone({ freq: 70 * pitch, freqEnd: 45, duration: 0.07, type: 'sine', volume: (0.05 + intensity * 0.05) * gain });
    }

    // Duck the room while a game is being played.
    setFocus(focused) {
        if (!this.output) return;
        const ctx = getAudioContext();
        this.output.gain.setTargetAtTime(focused ? 0.45 : 1, ctx.currentTime, 0.4);
    }
}
