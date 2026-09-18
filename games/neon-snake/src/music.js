import { ChipTune } from '../../shared/audio.js';

// Four-bar A-minor loop: Am - F - C - G.
const ROOTS = [['A2', 'A3'], ['F2', 'F3'], ['C3', 'C4'], ['G2', 'G3']];
const ARPS = [
    ['A4', 'C5', 'E5', 'C5'],
    ['F4', 'A4', 'C5', 'A4'],
    ['C5', 'E5', 'G5', 'E5'],
    ['B4', 'D5', 'G5', 'D5'],
];
const _ = null;
const LEAD = [
    'E5', _, _, 'C5', _, 'A4', _, 'C5', 'E5', _, 'A5', _, 'G5', _, 'E5', _,
    'F5', _, _, 'E5', _, 'C5', _, 'A4', 'C5', _, 'F5', _, 'E5', _, 'C5', _,
    'G5', _, _, 'E5', _, 'C5', _, 'E5', 'G5', _, 'C6', _, 'B5', _, 'G5', _,
    'D5', _, 'G5', _, 'B5', _, 'A5', _, 'G5', _, 'F5', _, 'D5', _, 'B4', _,
];

function bassBar([lo, hi]) {
    return [lo, _, hi, _, lo, _, hi, _, lo, _, hi, _, lo, lo, hi, _];
}

function arpBar(notes) {
    const bar = [];
    for (let i = 0; i < 16; i++) bar.push(i % 2 === 0 ? notes[(i / 2) % 4] : _);
    return bar;
}

const KICK = ['C2', _, _, _, _, _, _, _, 'C2', _, _, _, _, _, _, _];

export function createMusic(sounds) {
    return new ChipTune(sounds, {
        bpm: 132,
        tracks: [
            { notes: ROOTS.flatMap(bassBar), type: 'triangle', volume: 0.09, length: 0.8 },
            { notes: LEAD, type: 'square', volume: 0.045, length: 1.6 },
            { notes: ARPS.flatMap(arpBar), type: 'square', volume: 0.018, length: 0.5 },
            { notes: KICK, type: 'sine', volume: 0.12, length: 0.9 },
        ],
    });
}
