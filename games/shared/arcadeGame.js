import { SoundBank } from './audio.js';
import { HighScoreTable, InitialsEntry } from './highscores.js';
import { drawText, blink, formatScore, dimScreen, drawPanel } from './ui.js';
import { loadArcadeFont } from './font.js';

export const SCREEN_WIDTH = 800;
export const SCREEN_HEIGHT = 600;

const KEY_GROUPS = {
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    up: ['ArrowUp', 'KeyW'],
    down: ['ArrowDown', 'KeyS'],
    action: ['Space'],
    start: ['Space', 'Enter', 'NumpadEnter'],
};

const ATTRACT_CYCLE = 14; // seconds: demo, then high score table
const GAME_OVER_SECONDS = 3;
const SCORES_SECONDS = 6;

/**
 * Base class for every cabinet game. It owns the "arcade flow" so every
 * machine behaves the same way:
 *
 *   attract (demo + high scores) --host activates--> title --Space--> playing
 *   playing --endGame()--> gameover --> [initials] --> scores --> title
 *
 * Host API (used by the 3D arcade and the standalone page):
 *   new Game(canvas), setActive(bool), frame(dt), keyDown(code, repeat),
 *   keyUp(code), setPaused(bool), setVolume(v), dispose(), highScores
 *
 * Subclass hooks:
 *   resetGame()            start a fresh game (this.demo tells you if it's attract mode)
 *   updateGame(dt)         advance gameplay; in demo mode drive the player with simple AI
 *   renderGame(ctx)        draw the world + in-game HUD
 *   onKeyDown(code, repeat) / onKeyUp(code)   gameplay input while playing
 *   updateGameOver(dt)     optional: keep effects animating behind the game over banner
 *
 * Helpers: this.isDown('left'), this.addScore(n), this.endGame(opts),
 *          this.sounds.play('explosion'), this.time, this.demo, this.score
 */
export default class ArcadeGame {
    static meta = {
        id: 'game',
        title: 'GAME',
        color: '#ffffff',
        controls: [],
    };

    constructor(canvas, { standalone = false, attractPrompt = 'PRESS E TO PLAY', leaveHint = 'Q LEAVE CABINET', prompts = {}, controls = null } = {}) {
        this.canvas = canvas;
        this.canvas.width = SCREEN_WIDTH;
        this.canvas.height = SCREEN_HEIGHT;
        this.ctx = canvas.getContext('2d');
        this.width = SCREEN_WIDTH;
        this.height = SCREEN_HEIGHT;
        this.standalone = standalone;
        this.attractPrompt = attractPrompt;
        this.leaveHint = leaveHint;
        // what the screens tell the player to press; a touch host swaps in taps
        this.prompts = { start: 'PRESS SPACE TO START', next: 'PRESS SPACE', initials: 'UP/DOWN CHANGE  SPACE NEXT', footer: null, ...prompts };
        // the title screen's control list (defaults to meta.controls)
        this.controlList = controls;

        this.meta = this.constructor.meta;
        this.sounds = new SoundBank();
        this.highScores = new HighScoreTable(this.meta.id, this.meta.defaultScores);
        this.music = null;

        this.keys = new Set();
        this.time = 0;
        this.stateTime = 0;
        this.score = 0;
        this.demo = true;
        this.active = false;
        this.hostPaused = false;
        this.state = 'attract';
        this.gameOverInfo = null;
        this.initials = null;
        this.newRank = -1;
        this.demoRestartTimer = 0;
        this.fontReady = false;

        loadArcadeFont().then(() => { this.fontReady = true; });
    }

    // Called by subclasses at the end of their constructor.
    init() {
        this.startDemo();
    }

    // ---- host API --------------------------------------------------------

    setActive(active) {
        if (active === this.active) return;
        this.active = active;
        this.keys.clear();
        if (active) {
            this.sounds.play('coin');
            this.setState('title');
        } else {
            this.stopMusic();
            this.startDemo();
        }
    }

    setPaused(paused) {
        this.hostPaused = paused;
        if (paused) {
            this.keys.clear();
            this.stopMusic();
        } else if (this.state === 'playing') {
            this.startMusic();
        }
    }

    setVolume(volume) {
        this.sounds.setVolume(volume);
    }

    keyDown(code, repeat = false) {
        if (!this.active || this.hostPaused) return false;
        this.keys.add(code);

        switch (this.state) {
            case 'title':
                if (!repeat && KEY_GROUPS.start.includes(code)) {
                    this.startGame();
                    return true;
                }
                return this.onTitleKeyDown(code, repeat);
            case 'playing':
                if (code === 'KeyP' && !repeat) {
                    this.setState('paused');
                    this.stopMusic();
                    this.sounds.play('select');
                    return true;
                }
                return this.onKeyDown(code, repeat) !== false;
            case 'paused':
                if (!repeat && (code === 'KeyP' || KEY_GROUPS.start.includes(code))) {
                    this.state = 'playing';
                    this.startMusic();
                    this.sounds.play('select');
                }
                return true;
            case 'gameover':
                if (!repeat && this.stateTime > 1 && KEY_GROUPS.start.includes(code)) {
                    this.afterGameOver();
                }
                return true;
            case 'initials':
                // A fire button still held from the game must not auto-repeat through the entry.
                if (repeat && KEY_GROUPS.start.includes(code)) return true;
                if (this.initials.handleKey(code)) {
                    this.sounds.play(this.initials.done ? 'powerup' : 'blip');
                    if (this.initials.done) {
                        this.newRank = this.highScores.add(this.initials.name, this.score);
                        this.setState('scores');
                    }
                }
                return true;
            case 'scores':
                if (!repeat && this.stateTime > 0.5 && KEY_GROUPS.start.includes(code)) {
                    this.setState('title');
                }
                return true;
            default:
                return false;
        }
    }

    keyUp(code) {
        this.keys.delete(code);
        if (this.state === 'playing') this.onKeyUp(code);
    }

    frame(dt) {
        dt = Math.max(0, Math.min(dt, 1 / 20));
        if (!this.hostPaused) {
            this.update(dt);
        }
        this.render();
    }

    dispose() {
        this.stopMusic();
        this.keys.clear();
    }

    // ---- subclass hooks ----------------------------------------------------

    resetGame() {}
    updateGame(dt) {}
    updateGameOver(dt) {}
    renderGame(ctx) {}
    onKeyDown(code, repeat) { return false; }
    onKeyUp(code) {}
    onTitleKeyDown(code, repeat) { return false; }
    // Extra lines shown on the title screen under the controls (e.g. mode select).
    renderTitleExtras(ctx, y) {}

    // ---- helpers -----------------------------------------------------------

    isDown(group) {
        const codes = KEY_GROUPS[group] || [group];
        return codes.some((c) => this.keys.has(c));
    }

    addScore(points) {
        if (this.demo) return;
        this.score += points;
    }

    // opts: { title, subtitle, color, sound }
    endGame(opts = {}) {
        if (this.demo) {
            // Let the demo linger on its final moment, then restart it.
            if (this.demoRestartTimer <= 0) this.demoRestartTimer = 2.5;
            return;
        }
        if (this.state !== 'playing') return;
        this.stopMusic();
        this.gameOverInfo = {
            title: opts.title || 'GAME OVER',
            subtitle: opts.subtitle || null,
            color: opts.color || '#ff4060',
        };
        this.sounds.play(opts.sound || 'gameOver');
        this.setState('gameover');
    }

    startMusic() {
        if (this.music && !this.demo) this.music.start();
    }

    stopMusic() {
        if (this.music) this.music.stop();
    }

    // ---- internals ---------------------------------------------------------

    setState(state) {
        this.state = state;
        this.stateTime = 0;
    }

    startDemo() {
        this.demo = true;
        this.score = 0;
        this.demoRestartTimer = 0;
        this.resetGame();
        this.setState(this.active ? 'title' : 'attract');
    }

    startGame() {
        this.demo = false;
        this.score = 0;
        this.keys.clear();
        this.resetGame();
        this.sounds.play('start');
        this.setState('playing');
        this.startMusic();
    }

    afterGameOver() {
        if (this.highScores.qualifies(this.score)) {
            this.initials = new InitialsEntry();
            this.setState('initials');
        } else {
            this.newRank = -1;
            this.setState('scores');
        }
    }

    update(dt) {
        this.time += dt;
        this.stateTime += dt;

        switch (this.state) {
            case 'attract':
            case 'title':
                this.updateGame(dt);
                if (this.demoRestartTimer > 0) {
                    this.demoRestartTimer -= dt;
                    if (this.demoRestartTimer <= 0) this.startDemo();
                }
                break;
            case 'playing':
                this.updateGame(dt);
                break;
            case 'gameover':
                this.updateGameOver(dt);
                if (this.stateTime > GAME_OVER_SECONDS) this.afterGameOver();
                break;
            case 'scores':
                if (this.stateTime > SCORES_SECONDS) {
                    this.setState('title');
                }
                break;
            default:
                break;
        }

        // When a game ends and we're back at the title, reset into demo mode.
        if (this.state === 'title' && !this.demo) {
            this.startDemo();
        }
    }

    render() {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.save();
        this.renderGame(ctx);
        ctx.restore();

        switch (this.state) {
            case 'attract':
                this.renderAttract(ctx);
                break;
            case 'title':
                this.renderTitle(ctx);
                break;
            case 'paused':
                this.renderPaused(ctx);
                break;
            case 'gameover':
                this.renderGameOver(ctx);
                break;
            case 'initials':
                this.renderInitials(ctx);
                break;
            case 'scores':
                this.renderScores(ctx);
                break;
            default:
                break;
        }

        if (this.hostPaused && this.active && this.state === 'playing') {
            this.renderPaused(ctx);
        }
        ctx.restore();
    }

    renderLogo(ctx, y, size = 44) {
        const color = this.meta.color;
        const lines = this.meta.title.split('\n');
        lines.forEach((line, i) => {
            drawText(ctx, line, this.width / 2, y + i * (size + 14), {
                size, color, glow: 24,
            });
        });
        return y + lines.length * (size + 14);
    }

    renderAttract(ctx) {
        const cycle = this.time % ATTRACT_CYCLE;
        if (cycle > ATTRACT_CYCLE * 0.62) {
            dimScreen(ctx, this.width, this.height, 0.8);
            this.renderScoreTable(ctx, 150, -1);
        } else {
            dimScreen(ctx, this.width, this.height, 0.35);
            this.renderLogo(ctx, 120);
        }
        drawText(ctx, `HI ${formatScore(this.highScores.top)}`, this.width / 2, 30, { size: 16, color: '#ffe066' });
        if (blink(this.time, 1.2)) {
            drawText(ctx, this.attractPrompt, this.width / 2, this.height - 70, { size: 22, color: '#ffffff', glow: 10 });
        }
        drawText(ctx, 'FREE PLAY', this.width / 2, this.height - 30, { size: 12, color: '#8888aa' });
    }

    renderTitle(ctx) {
        dimScreen(ctx, this.width, this.height, 0.7);
        let y = this.renderLogo(ctx, 90);
        drawText(ctx, `HI ${formatScore(this.highScores.top)}`, this.width / 2, 30, { size: 16, color: '#ffe066' });

        y += 20;
        const controls = this.controlList || this.meta.controls || [];
        if (controls.length) {
            const panelH = controls.length * 30 + 30;
            drawPanel(ctx, 140, y, 520, panelH, { stroke: this.meta.color, glow: 12 });
            controls.forEach(([key, action], i) => {
                const rowY = y + 30 + i * 30;
                drawText(ctx, key, 170, rowY, { size: 13, color: this.meta.color, align: 'left', shadow: false });
                drawText(ctx, action, 630, rowY, { size: 13, color: '#ffffff', align: 'right', shadow: false });
            });
            y += panelH + 20;
        }

        this.renderTitleExtras(ctx, y);

        if (blink(this.time, 1)) {
            drawText(ctx, this.prompts.start, this.width / 2, this.height - 80, { size: 22, color: '#ffffff', glow: 12 });
        }
        drawText(ctx, this.prompts.footer ?? (this.standalone ? 'P PAUSE' : `P PAUSE   ${this.leaveHint}`), this.width / 2, this.height - 36, { size: 11, color: '#8888aa' });
    }

    renderPaused(ctx) {
        dimScreen(ctx, this.width, this.height, 0.6);
        drawText(ctx, 'PAUSED', this.width / 2, this.height / 2 - 20, { size: 40, color: this.meta.color, glow: 20 });
        if (!this.hostPaused && blink(this.time, 1)) {
            drawText(ctx, 'PRESS P TO RESUME', this.width / 2, this.height / 2 + 40, { size: 16 });
        }
    }

    renderGameOver(ctx) {
        const info = this.gameOverInfo;
        const t = Math.min(1, this.stateTime * 3);
        dimScreen(ctx, this.width, this.height, 0.55 * t);
        const scale = 1 + (1 - t) * 1.5;
        ctx.save();
        ctx.translate(this.width / 2, this.height / 2 - 40);
        ctx.scale(scale, scale);
        drawText(ctx, info.title, 0, 0, { size: 48, color: info.color, glow: 30, alpha: t });
        ctx.restore();
        if (info.subtitle) {
            drawText(ctx, info.subtitle, this.width / 2, this.height / 2 + 30, { size: 16, alpha: t });
        }
        drawText(ctx, `SCORE ${formatScore(this.score)}`, this.width / 2, this.height / 2 + 80, { size: 22, color: '#ffe066', alpha: t });
    }

    renderInitials(ctx) {
        dimScreen(ctx, this.width, this.height, 0.85);
        drawText(ctx, 'NEW HIGH SCORE!', this.width / 2, 120, { size: 32, color: this.meta.color, glow: 20 });
        drawText(ctx, formatScore(this.score), this.width / 2, 185, { size: 28, color: '#ffe066' });
        drawText(ctx, 'ENTER YOUR INITIALS', this.width / 2, 260, { size: 16 });

        const name = this.initials.name;
        for (let i = 0; i < 3; i++) {
            const x = this.width / 2 + (i - 1) * 80;
            const selected = i === this.initials.cursor;
            drawText(ctx, name[i] === ' ' ? '_' : name[i], x, 340, {
                size: 48,
                color: selected ? '#ffffff' : '#8888aa',
                glow: selected ? 16 : 0,
            });
            if (selected && blink(this.time, 0.6)) {
                ctx.fillStyle = this.meta.color;
                ctx.fillRect(x - 26, 378, 52, 6);
                drawText(ctx, '▲', x, 300, { size: 14, color: this.meta.color, shadow: false });
                drawText(ctx, '▼', x, 400, { size: 14, color: this.meta.color, shadow: false });
            }
        }
        drawText(ctx, this.prompts.initials, this.width / 2, 480, { size: 12, color: '#aaaacc' });
    }

    renderScores(ctx) {
        dimScreen(ctx, this.width, this.height, 0.85);
        this.renderScoreTable(ctx, 130, this.newRank);
        if (this.stateTime > 0.5 && blink(this.time, 1)) {
            drawText(ctx, this.prompts.next, this.width / 2, this.height - 60, { size: 16 });
        }
    }

    renderScoreTable(ctx, y, highlight) {
        drawText(ctx, 'HIGH SCORES', this.width / 2, y, { size: 32, color: this.meta.color, glow: 20 });
        const colors = ['#ffe066', '#ffffff', '#ffffff', '#ffffff', '#ffffff'];
        this.highScores.entries.forEach((entry, i) => {
            const rowY = y + 80 + i * 50;
            const isNew = i === highlight;
            if (isNew && !blink(this.time, 0.5)) return;
            const color = isNew ? this.meta.color : colors[i];
            const rank = ['1ST', '2ND', '3RD', '4TH', '5TH'][i];
            drawText(ctx, rank, 200, rowY, { size: 20, color, align: 'left' });
            drawText(ctx, entry.name, 360, rowY, { size: 20, color, align: 'left' });
            drawText(ctx, formatScore(entry.score), 600, rowY, { size: 20, color, align: 'right' });
        });
    }
}
