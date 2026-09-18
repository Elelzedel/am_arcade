import fontUrl from '@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff2';

export const FONT_FAMILY = '"Press Start 2P", monospace';

let loading = null;

// Loads the bundled arcade font once. Canvas text drawn before this resolves
// falls back to monospace, so callers that care should await it.
export function loadArcadeFont() {
    if (!loading) {
        const face = new FontFace('Press Start 2P', `url(${fontUrl})`);
        loading = face.load().then((loaded) => {
            document.fonts.add(loaded);
            return loaded;
        }).catch((err) => {
            console.warn('Arcade font failed to load', err);
        });
    }
    return loading;
}

export function font(size) {
    return `${size}px ${FONT_FAMILY}`;
}
