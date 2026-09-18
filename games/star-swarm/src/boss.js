// The mothership that appears every fifth wave.

const PATTERNS = ['fan', 'spiral', 'ring', 'minions'];
const BOSS_COLORS = ['#ff3b8d', '#8e1b5a', '#ffe066', '#2ee6ff'];

export class Boss {
    constructor(tier) {
        this.tier = tier;
        this.maxHp = 90 + 50 * (tier - 1);
        this.hp = this.maxHp;
        this.x = 400;
        this.y = -100;
        this.t = 0;
        this.state = 'enter';
        this.flash = 0;
        this.patternIndex = 0;
        this.patternTime = 1.5;
        this.fireTimer = 0.5;
        this.spin = 0;
        this.deathTime = 0;
        this.boomTimer = 0;
        this.done = false;
        this.radius = 42;
    }

    get enraged() {
        return this.hp < this.maxHp * 0.5;
    }

    get pattern() {
        return PATTERNS[this.patternIndex % PATTERNS.length];
    }

    get alive() {
        return this.state !== 'dying' && !this.done;
    }

    // Three circles: core and two wings.
    hitTest(x, y, r) {
        if (this.state !== 'fight') return false;
        const dx = x - this.x;
        const dy = y - this.y;
        if (dx * dx + dy * dy < (40 + r) * (40 + r)) return true;
        for (const side of [-1, 1]) {
            const wx = dx - side * 44;
            const wy = dy + 6;
            if (wx * wx + wy * wy < (22 + r) * (22 + r)) return true;
        }
        return false;
    }

    damage(game, amount, bx, by) {
        this.hp -= amount;
        this.flash = 0.06;
        game.fx.sparks(bx, by, '#ff3b8d', 3);
        if (this.hp <= 0) {
            this.hp = 0;
            this.state = 'dying';
            this.deathTime = 0;
            game.sfx('bossDown');
            game.clearEnemyBullets(true);
        }
    }

    update(game, dt) {
        this.t += dt;
        this.flash = Math.max(0, this.flash - dt);

        if (this.state === 'enter') {
            this.y += (150 - this.y) * Math.min(1, dt * 1.6);
            this.x = 400 + Math.sin(this.t * 1.5) * 20 * Math.min(1, this.t);
            if (this.t > 2.4) {
                this.state = 'fight';
                this.t = 0;
            }
            return;
        }

        if (this.state === 'dying') {
            this.deathTime += dt;
            this.boomTimer -= dt;
            this.x += Math.sin(this.deathTime * 40) * 1.5;
            this.y += 12 * dt;
            if (this.boomTimer <= 0) {
                this.boomTimer = 0.11;
                const ox = (Math.random() - 0.5) * 120;
                const oy = (Math.random() - 0.5) * 60;
                game.fx.explode(this.x + ox, this.y + oy, BOSS_COLORS, 0.8);
                game.shake.add(0.12);
                game.sfx('pop');
            }
            if (this.deathTime > 2.2) {
                this.done = true;
                game.fx.explode(this.x, this.y, BOSS_COLORS, 4);
                game.fx.explode(this.x - 50, this.y, BOSS_COLORS, 2);
                game.fx.explode(this.x + 50, this.y, BOSS_COLORS, 2);
                game.fx.ring(this.x, this.y, '#ffffff', 900, 0.8);
                game.shake.add(1);
                game.screenFlash(0.8, '#ffffff');
                game.sounds.play('bigExplosion');
                const points = 5000 * this.tier;
                game.award(points);
                game.fx.popup(this.x, this.y, `${points}`, '#ffe066', 28, 2);
            }
            return;
        }

        // Fight: sweep side to side, bobbing.
        const speed = this.enraged ? 0.75 : 0.55;
        this.x = 400 + Math.sin(this.t * speed) * 230;
        this.y = 150 + Math.sin(this.t * 1.1) * 35;

        this.patternTime -= dt;
        if (this.patternTime <= 0) {
            this.patternIndex++;
            this.patternTime = this.enraged ? 2.8 : 3.4;
            this.fireTimer = 0.35;
            if (this.pattern === 'minions') {
                this.spawnMinions(game);
            }
        }

        this.fireTimer -= dt;
        if (this.fireTimer > 0) return;

        const bs = game.tune.bulletSpeed;
        const px = game.player.x;
        const py = game.player.y;
        switch (this.pattern) {
            case 'fan': {
                const n = this.enraged ? 7 : 5;
                const aim = Math.atan2(py - this.y, px - this.x);
                for (let i = 0; i < n; i++) {
                    const a = aim + (i - (n - 1) / 2) * 0.16;
                    game.enemyBullet(this.x, this.y + 30, Math.cos(a) * bs * 0.9, Math.sin(a) * bs * 0.9, true);
                }
                game.sfx('bossShot');
                this.fireTimer = this.enraged ? 0.45 : 0.6;
                break;
            }
            case 'spiral': {
                const arms = this.enraged ? 3 : 2;
                for (let i = 0; i < arms; i++) {
                    const a = this.spin + (i / arms) * Math.PI * 2;
                    game.enemyBullet(this.x, this.y, Math.cos(a) * 170, Math.sin(a) * 170, true);
                }
                this.spin += 0.26;
                this.fireTimer = this.enraged ? 0.07 : 0.09;
                if (Math.random() < 0.2) game.sfx('enemyShot');
                break;
            }
            case 'ring': {
                const n = this.enraged ? 20 : 14;
                const off = Math.random() * Math.PI;
                for (let i = 0; i < n; i++) {
                    const a = off + (i / n) * Math.PI * 2;
                    game.enemyBullet(this.x, this.y, Math.cos(a) * 180, Math.sin(a) * 180, true);
                }
                game.sfx('bossShot');
                this.fireTimer = this.enraged ? 0.7 : 0.95;
                break;
            }
            default: {
                // Wing cannons while the minions dive.
                for (const side of [-1, 1]) {
                    const x = this.x + side * 50;
                    const a = Math.atan2(py - this.y, px - x);
                    game.enemyBullet(x, this.y + 10, Math.cos(a) * bs, Math.sin(a) * bs, false);
                }
                game.sfx('enemyShot');
                this.fireTimer = this.enraged ? 0.35 : 0.5;
                break;
            }
        }
    }

    spawnMinions(game) {
        const n = this.enraged ? 4 : 3;
        for (let i = 0; i < n; i++) {
            game.spawnMinion(this.x + (i - (n - 1) / 2) * 30, this.y + 20, i * 0.18, this.enraged && i % 2 ? 'wasp' : 'bee');
        }
    }

    draw(ctx, sprites, time) {
        if (this.done) return;
        const set = sprites.boss;
        const frame = Math.floor(time * 4) & 1;
        const img = this.flash > 0 ? set.white[frame] : set.frames[frame];
        const w = set.w;
        const h = set.h;
        // Engine glow behind the hull.
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.5 + 0.2 * Math.sin(time * 8);
        const g = 130 + Math.sin(time * 5) * 10;
        ctx.drawImage(sprites.flash, this.x - g / 2, this.y - g / 2 - 10, g, g);
        ctx.restore();
        if (this.state === 'dying' && Math.floor(time * 20) & 1) {
            ctx.drawImage(set.white[frame], this.x - w / 2, this.y - h / 2);
        } else {
            ctx.drawImage(img, this.x - w / 2, this.y - h / 2);
        }
        // Low health: flickering red glow on the core.
        if (this.enraged && this.state === 'fight') {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.35 + 0.3 * Math.sin(time * 14);
            ctx.drawImage(sprites.eBullet, this.x - 30, this.y - 40, 60, 60);
            ctx.restore();
        }
    }
}
