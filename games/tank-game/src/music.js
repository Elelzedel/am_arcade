import { ChipTune } from '../../shared/audio.js';

// "A2 . . A3" -> ['A2', null, null, 'A3']
const seq = (s) => s.trim().split(/\s+/).map((t) => (t === '.' ? null : t));

const bassBar = (lo, hi) => seq(`${lo} . . ${lo} . . ${hi} . ${lo} . ${lo} . ${hi} . ${lo} .`);

const BASS = [
    ...bassBar('A2', 'A3'), ...bassBar('F2', 'F3'), ...bassBar('C2', 'C3'), ...bassBar('G2', 'G3'),
];

const LEAD_A = seq(`
    E5 . . . A4 . C5 . E5 . D5 . C5 . B4 .
    A4 . . . . . C5 . F5 . E5 . C5 . A4 .
    G4 . . . C5 . E5 . G5 . . . E5 . D5 .
    D5 . . . B4 . G4 . B4 . D5 . E5 . D5 .
`);

const LEAD_B = seq(`
    A5 . . . G5 . E5 . . . C5 . E5 . A5 .
    F5 . . . E5 . C5 . . . A4 . C5 . F5 .
    E5 . . . G5 . C6 . . . G5 . E5 . C5 .
    D5 . . . . . G5 . . . F5 . E5 . D5 .
`);

const ARP = seq(`
    A4 C5 E5 C5 A4 C5 E5 C5 A4 C5 E5 C5 A4 C5 E5 C5
    F4 A4 C5 A4 F4 A4 C5 A4 F4 A4 C5 A4 F4 A4 C5 A4
    G4 C5 E5 C5 G4 C5 E5 C5 G4 C5 E5 C5 G4 C5 E5 C5
    G4 B4 D5 B4 G4 B4 D5 B4 G4 B4 D5 B4 G4 B4 D5 B4
`);

export function createMusic(sounds) {
    return new ChipTune(sounds, {
        bpm: 128,
        tracks: [
            { notes: BASS, type: 'triangle', volume: 0.08, length: 0.8 },
            { notes: [...LEAD_A, ...LEAD_B], type: 'square', volume: 0.035, length: 1.6 },
            { notes: [...new Array(64).fill(null), ...ARP], type: 'triangle', volume: 0.025, length: 0.6 },
        ],
    });
}
