import monotonUrl from '@fontsource/monoton/files/monoton-latin-400-normal.woff2';
import yellowtailUrl from '@fontsource/yellowtail/files/yellowtail-latin-400-normal.woff2';
import bricolageUrl from '@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2';
import { loadArcadeFont } from '../../games/shared/font.js';

// Four voices, each with one job:
//   Monoton     the big neon letterforms (rooftop sign, title card)
//   Yellowtail  hand-bent neon script ("insert coin", "open")
//   Bricolage   everything the visitor reads in the interface
//   Press Start the machines themselves (marquees, keys, screens)
export const FONTS = {
    neon: '"Monoton", sans-serif',
    script: '"Yellowtail", cursive',
    ui: '"Bricolage Grotesque", system-ui, sans-serif',
    pixel: '"Press Start 2P", monospace',
};

let loading = null;

export function loadFonts() {
    if (!loading) {
        const faces = [
            new FontFace('Monoton', `url(${monotonUrl})`),
            new FontFace('Yellowtail', `url(${yellowtailUrl})`),
            new FontFace('Bricolage Grotesque', `url(${bricolageUrl})`, { weight: '200 800' }),
        ];
        loading = Promise.all([
            ...faces.map((face) => face.load().then((f) => document.fonts.add(f)).catch(() => {})),
            loadArcadeFont(),
        ]);
    }
    return loading;
}
