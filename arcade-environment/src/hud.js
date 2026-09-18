const $ = (id) => document.getElementById(id);

function escapeHtml(text) {
    return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// All DOM overlays for the 3D arcade live here.
export default class Hud {
    constructor() {
        this.intro = $('intro');
        this.introEmblem = $('introEmblem');
        this.enterButton = $('enterButton');
        this.pause = $('pause');
        this.pauseHint = $('pauseHint');
        this.crosshair = $('crosshair');
        this.prompt = $('prompt');
        this.promptAction = this.prompt.querySelector('.action');
        this.promptSub = this.prompt.querySelector('.sub');
        this.toastEl = $('toast');
        this.fadeEl = $('fade');
        this.debugEl = $('inputDebug');
        this.promptKey = null;
        this.toastTimer = null;
        this.mouseSpeed = 1;
        this.pauseArgs = [false, null];

        if (matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches) {
            $('touchWarning').classList.remove('hidden');
        }
    }

    setIntroEmblem(url) {
        this.introEmblem.src = url;
        this.introEmblem.classList.remove('hidden');
    }

    setReady() {
        this.enterButton.classList.remove('loading');
        this.enterButton.textContent = 'CLICK TO ENTER';
    }

    hideIntro() {
        this.intro.classList.add('hidden');
    }

    fadeIn() {
        this.fadeEl.classList.add('hidden');
    }

    showPause(inGame, message = null) {
        this.pauseArgs = [inGame, message];
        const lines = [];
        if (message) lines.push(`<b>${escapeHtml(message)}</b>`);
        lines.push('CLICK TO RESUME');
        if (inGame) lines.push('<b>Q</b> STEP AWAY FROM THE MACHINE');
        else lines.push('<b>WASD</b> WALK &nbsp; <b>SHIFT</b> RUN &nbsp; <b>E</b> PLAY');
        lines.push(`<b>[</b> <b>]</b> MOUSE SPEED ${Math.round(this.mouseSpeed * 100)}%`);
        this.pauseHint.innerHTML = lines.join('<br>');
        this.pause.classList.remove('hidden');
    }

    // speed: mouse look multiplier, shown on the pause screen.
    setMouseSpeed(speed) {
        this.mouseSpeed = speed;
        if (!this.pause.classList.contains('hidden')) this.showPause(...this.pauseArgs);
    }

    enableDebug() {
        this.debugEl.classList.remove('hidden');
    }

    setDebug(text) {
        if (this.debugEl.textContent !== text) this.debugEl.textContent = text;
    }

    hidePause() {
        this.pause.classList.add('hidden');
    }

    setCrosshair(visible, targeted = false) {
        this.crosshair.classList.toggle('hidden', !visible);
        this.crosshair.classList.toggle('target', targeted);
    }

    // station: the machine or prop the player is looking at (or null)
    setPrompt(station) {
        const info = station ? station.prompt : null;
        const key = info ? `${info.title}|${info.sub}` : null;
        if (key === this.promptKey) return;
        this.promptKey = key;
        if (!info) {
            this.prompt.classList.remove('show');
            return;
        }
        const title = escapeHtml(info.title);
        this.prompt.style.setProperty('--accent', info.color);
        if (info.disabled) {
            this.promptAction.innerHTML = `<span class="title">${title}</span>`;
            this.promptSub.textContent = info.disabledMessage || 'OUT OF ORDER';
        } else {
            this.promptAction.innerHTML = `<kbd>E</kbd>${escapeHtml(info.action)} <span class="title">${title}</span>`;
            this.promptSub.textContent = info.sub || '';
        }
        this.prompt.classList.add('show');
    }

    refreshPrompt() {
        this.promptKey = null;
    }

    toast(text, ms = 2200) {
        this.toastEl.textContent = text;
        this.toastEl.classList.add('show');
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), ms);
    }
}
