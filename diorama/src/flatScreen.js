// On a phone the tube lifts out of the cabinet once you've stepped up to it:
// the game's own canvas grows from where the screen sits in the 3D scene to
// fill the width (upright) or the height (sideways), crisp and as large as the
// phone allows, with a hint of scanlines and the machine's neon round it.
// Stepping back shrinks it into the tube again.

export default class FlatScreen {
    constructor() {
        this.el = document.createElement('div');
        this.el.id = 'flat';
        this.el.className = 'hidden';
        this.frame = document.createElement('div');
        this.frame.className = 'frame';
        this.el.appendChild(this.frame);
        document.body.appendChild(this.el);
        this.canvas = null;
        this.active = false;
        window.addEventListener('resize', () => this.active && this.layout(false));
    }

    // Where the screen goes: the biggest 4:3 rect that fits the free area.
    target() {
        const w = window.innerWidth, h = window.innerHeight;
        const portrait = h > w;
        const safeTop = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0;
        if (portrait) {
            const width = w;
            return { left: 0, top: 62 + safeTop, width, height: (width * 3) / 4 };
        }
        const height = h - 16;
        const width = Math.min((height * 4) / 3, w * 0.64);
        return { left: (w - width) / 2, top: (h - (width * 3) / 4) / 2, width, height: (width * 3) / 4 };
    }

    layout(animate, from) {
        const t = this.target();
        const f = this.frame.style;
        f.left = `${t.left}px`;
        f.top = `${t.top}px`;
        f.width = `${t.width}px`;
        f.height = `${t.height}px`;
        if (from && animate) {
            // start exactly over the tube, then let CSS carry it to its place
            const sx = from.width / t.width, sy = from.height / t.height;
            f.transition = 'none';
            f.transform = `translate(${from.left - t.left}px, ${from.top - t.top}px) scale(${sx}, ${sy})`;
            f.opacity = '0.4';
            this.frame.getBoundingClientRect();
            f.transition = '';
        }
        f.transform = '';
        f.opacity = '1';
        this.rect = t;
    }

    show(canvas, color, from) {
        this.canvas = canvas;
        this.frame.style.setProperty('--c', color);
        this.frame.prepend(canvas);
        this.active = true;
        this.el.classList.remove('hidden');
        this.layout(true, from);
    }

    hide(to) {
        if (!this.active) return Promise.resolve();
        this.active = false;
        const t = this.rect;
        const f = this.frame.style;
        if (to && t) f.transform = `translate(${to.left - t.left}px, ${to.top - t.top}px) scale(${to.width / t.width}, ${to.height / t.height})`;
        f.opacity = '0';
        this.el.classList.add('hidden');
        return new Promise((resolve) => setTimeout(() => {
            this.canvas?.remove();
            this.canvas = null;
            f.transform = '';
            resolve();
        }, 380));
    }

    /** The screen's rect in CSS px, for mapping touches onto the game. */
    screenRect() {
        return this.rect;
    }
}
