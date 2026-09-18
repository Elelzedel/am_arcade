// The DOM layer: title card, the small overview HUD, the hover label, the
// in-game chrome and the touch pad. The markup lives in index.html.

const $ = (id) => document.getElementById(id);

export default class Interface {
    constructor() {
        this.el = {
            loader: $('loader'), bar: document.querySelector('#loader .progress i'), status: document.querySelector('#loader .status'),
            progress: document.querySelector('#loader .progress'), enter: $('enter'),
            brand: $('brand'), clock: $('clock'), tools: $('tools'), sound: $('sound'), helpBtn: $('helpBtn'), help: $('help'),
            hint: $('hint'), nowplaying: $('nowplaying'), npTitle: $('npTitle'), npArtist: $('npArtist'),
            label: $('label'), back: $('back'), gametitle: $('gametitle'), controls: $('controls'), toast: $('toast'), pad: $('pad'),
        };
        this.isReady = false;
        this.muted = false;
        this.mode = 'title';
        this.hintShown = 0;
        this.labelFor = null;
        this.clockTimer = 0;
        this.onEnter = null;
        this.onBack = null;
        this.onMute = null;
        this.onPad = null;

        this.el.enter.addEventListener('click', () => this.onEnter?.());
        this.el.back.addEventListener('click', () => this.onBack?.());
        this.el.sound.addEventListener('click', () => this.toggleMute());
        this.el.helpBtn.addEventListener('click', () => this.showHelp(true));
        this.el.help.addEventListener('click', () => this.showHelp(false));

        const touch = matchMedia('(pointer: coarse)').matches;
        document.body.classList.toggle('touch', touch);
        if (touch) {
            for (const b of this.el.pad.querySelectorAll('button')) {
                const code = b.dataset.key;
                const set = (down) => (e) => {
                    e.preventDefault();
                    b.classList.toggle('down', down);
                    this.onPad?.(code, down);
                };
                b.addEventListener('pointerdown', set(true));
                b.addEventListener('pointerup', set(false));
                b.addEventListener('pointercancel', set(false));
                b.addEventListener('pointerleave', set(false));
            }
        }
        this.updateClock();
    }

    progress(p, text) {
        this.el.bar.style.width = `${Math.round(p * 100)}%`;
        if (text !== undefined) this.el.status.textContent = text;
    }

    ready() {
        this.isReady = true;
        this.el.loader.classList.remove('solid');
        this.el.progress.classList.add('hidden');
        this.el.status.classList.add('hidden');
        setTimeout(() => this.el.enter.classList.remove('hidden'), 250);
    }

    setMode(mode, cabinet) {
        this.mode = mode;
        const show = (el, on) => el.classList.toggle('hidden', !on);
        const explore = mode === 'explore';
        const playing = mode === 'playing';
        show(this.el.loader, mode === 'title');
        show(this.el.brand, explore);
        show(this.el.tools, explore || playing);
        show(this.el.nowplaying, explore && this.nowTrack);
        show(this.el.back, playing);
        show(this.el.gametitle, playing);
        show(this.el.controls, playing);
        document.body.classList.toggle('playing', playing);
        if (explore && this.hintShown < 2) {
            this.hintShown++;
            show(this.el.hint, true);
            clearTimeout(this.hintTimer);
            this.hintTimer = setTimeout(() => show(this.el.hint, false), 9000);
        } else {
            show(this.el.hint, false);
        }
        if (playing && cabinet) {
            const { meta, color } = cabinet;
            this.el.gametitle.style.setProperty('--c', color);
            this.el.gametitle.querySelector('.t').textContent = meta.title.replace('\n', ' ');
            const best = cabinet.game.highScores.entries[0];
            this.el.gametitle.querySelector('.s').textContent = best ? `high score ${Number(best.score).toLocaleString('en-US')} · ${best.name}` : '';
            const keys = (k) => k.split('/').map((x) => x.trim()).filter(Boolean).map((x) => `<kbd>${x}</kbd>`).join('');
            const rows = (meta.controls || []).slice(0, 4).map(([k, label]) => `<span>${keys(k)}${label.toLowerCase()}</span>`);
            this.el.controls.innerHTML = rows.join('');
        }
    }

    hideHint() {
        this.el.hint.classList.add('hidden');
    }

    label(item, x, y) {
        const el = this.el.label;
        if (this.labelFor !== item) {
            this.labelFor = item;
            el.style.setProperty('--c', item.color);
            el.querySelector('.title span').textContent = item.name;
            el.querySelector('.sub').innerHTML = item.sub;
        }
        el.classList.remove('hidden');
        const w = el.offsetWidth, h = el.offsetHeight;
        const lx = Math.min(x + 20, window.innerWidth - w - 12);
        const ly = Math.min(y + 22, window.innerHeight - h - 12);
        el.style.transform = `translate(${lx}px, ${ly}px)`;
    }

    hideLabel() {
        if (this.labelFor === null) return;
        this.labelFor = null;
        this.el.label.classList.add('hidden');
    }

    toast(message, ms = 2600) {
        const el = this.el.toast;
        el.textContent = message;
        el.classList.add('show');
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => el.classList.remove('show'), ms);
    }

    nowPlaying(track, playing) {
        this.nowTrack = playing ? track : null;
        this.el.npTitle.textContent = track.title;
        this.el.npArtist.textContent = track.artist;
        this.el.nowplaying.style.setProperty('--c', track.color);
        this.el.nowplaying.classList.toggle('hidden', !(playing && this.mode === 'explore'));
    }

    toggleMute() {
        this.muted = !this.muted;
        this.el.sound.querySelector('.bars').classList.toggle('on', !this.muted);
        this.onMute?.(this.muted);
    }

    showHelp(on) {
        this.el.help.classList.toggle('hidden', !on);
    }

    updateClock() {
        const now = new Date();
        const h = now.getHours();
        const m = String(now.getMinutes()).padStart(2, '0');
        this.el.clock.textContent = `${((h + 11) % 12) + 1}:${m} ${h < 12 ? 'AM' : 'PM'}`;
    }

    update(dt) {
        this.clockTimer -= dt;
        if (this.clockTimer <= 0) {
            this.clockTimer = 5;
            this.updateClock();
        }
    }
}
