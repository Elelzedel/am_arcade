import { ChipTune } from '../../shared/audio.js';

// Am - F - C - G, twice, with a varied lead the second time round.
const _ = null;

const bassBar = (lo, hi) => [lo, _, hi, _, lo, _, hi, lo, _, lo, hi, _, lo, _, hi, _];
const arpBar = (a, b, c) => [a, b, c, b, a, b, c, b, a, b, c, b, a, b, c, b];

const BASS = [
    ...bassBar('A2', 'A3'), ...bassBar('F2', 'F3'), ...bassBar('C3', 'C4'), ...bassBar('G2', 'G3'),
    ...bassBar('A2', 'A3'), ...bassBar('F2', 'F3'), ...bassBar('C3', 'C4'), ...bassBar('E2', 'E3'),
];

const ARP = [
    ...arpBar('A4', 'C5', 'E5'), ...arpBar('F4', 'A4', 'C5'), ...arpBar('G4', 'C5', 'E5'), ...arpBar('G4', 'B4', 'D5'),
    ...arpBar('A4', 'C5', 'E5'), ...arpBar('F4', 'A4', 'C5'), ...arpBar('G4', 'C5', 'E5'), ...arpBar('G#4', 'B4', 'E5'),
];

const LEAD = [
    'E5', _, 'A5', _, 'C6', _, 'B5', 'A5', _, 'G5', _, 'A5', _, _, 'E5', _,
    'F5', _, 'A5', _, 'C6', _, 'D6', 'C6', _, 'A5', _, 'F5', _, _, 'G5', _,
    'G5', _, 'E5', _, 'G5', _, 'C6', _, 'B5', _, 'C6', _, 'D6', _, 'E6', _,
    'D6', _, _, 'B5', _, _, 'G5', _, 'A5', _, 'B5', _, 'D6', _, 'B5', _,
    'A5', 'A5', _, 'E6', _, 'D6', 'C6', _, 'B5', _, 'C6', _, 'A5', _, _, _,
    'A5', _, 'C6', _, 'F6', _, 'E6', 'D6', _, 'C6', _, 'A5', _, 'C6', _, _,
    'G5', 'C6', 'E6', _, 'G6', _, 'E6', _, 'D6', _, 'C6', _, 'D6', _, 'E6', _,
    'B5', _, _, 'G#5', _, _, 'E5', _, 'B5', _, 'D6', _, 'E6', _, _, _,
];

const DRUM = [
    'C2', _, _, _, _, _, _, _, 'C2', _, 'C2', _, _, _, _, _,
];

export function createMusic(sounds) {
    return new ChipTune(sounds, {
        bpm: 138,
        tracks: [
            { notes: BASS, type: 'triangle', volume: 0.09, length: 0.8 },
            { notes: ARP, type: 'square', volume: 0.022, length: 0.5 },
            { notes: LEAD, type: 'square', volume: 0.05, length: 0.85 },
            { notes: DRUM, type: 'sine', volume: 0.12, length: 1.2 },
        ],
    });
}
