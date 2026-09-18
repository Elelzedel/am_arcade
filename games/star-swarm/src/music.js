// Original chiptune loop for STAR SWARM: driving A-minor space march.
// 4 bars of 16th notes: Am - F - G - E.

const _ = null;

function bassBar(lo, hi) {
    return [lo, _, hi, _, lo, _, hi, _, lo, _, hi, _, lo, hi, lo, hi];
}

const BASS = [
    ...bassBar('A2', 'A3'),
    ...bassBar('F2', 'F3'),
    ...bassBar('G2', 'G3'),
    ...bassBar('E2', 'E3'),
];

const LEAD_A = [
    'E5', _, 'A5', _, 'C6', _, 'B5', 'A5', _, _, 'E5', _, 'A5', _, _, _,
    'F5', _, 'A5', _, 'C6', _, 'D6', 'C6', _, _, 'A5', _, 'F5', _, _, _,
    'G5', _, 'B5', _, 'D6', _, 'C6', 'B5', _, _, 'G5', _, 'D5', _, _, _,
    'E5', _, 'G#5', _, 'B5', _, 'D6', _, 'C6', _, 'B5', _, 'G#5', _, 'E5', _,
];

const LEAD_B = [
    'A5', _, _, 'G5', 'A5', _, 'C6', _, 'E6', _, 'D6', _, 'C6', _, 'B5', _,
    'A5', _, _, 'G5', 'F5', _, 'A5', _, 'C6', _, _, _, 'A5', _, _, _,
    'B5', _, _, 'A5', 'G5', _, 'B5', _, 'D6', _, 'E6', _, 'D6', _, 'B5', _,
    'G#5', _, 'A5', _, 'B5', _, 'E5', _, 'G#5', _, 'B5', _, 'E6', _, _, _,
];

function arpBar(a, b, c) {
    return [a, b, c, b, a, b, c, b, a, b, c, b, a, b, c, b];
}

const ARP = [
    ...arpBar('A4', 'C5', 'E5'),
    ...arpBar('F4', 'A4', 'C5'),
    ...arpBar('G4', 'B4', 'D5'),
    ...arpBar('E4', 'G#4', 'B4'),
];

const DRUM = [];
for (let bar = 0; bar < 8; bar++) {
    for (let s = 0; s < 16; s++) DRUM.push(s % 4 === 0 ? 90 : (s % 8 === 4 ? 70 : null));
}

export const MUSIC = {
    bpm: 138,
    tracks: [
        { notes: [...BASS, ...BASS], type: 'triangle', volume: 0.09, length: 0.8 },
        { notes: [...LEAD_A, ...LEAD_B], type: 'square', volume: 0.04, length: 0.75 },
        { notes: [...ARP, ...ARP], type: 'square', volume: 0.018, length: 0.4 },
        { notes: DRUM, type: 'sine', volume: 0.06, length: 0.3 },
    ],
};
