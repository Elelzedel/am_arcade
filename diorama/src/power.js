import { rng } from './util.js';

/**
 * The mains. Everything that lights up registers here with a moment in the
 * start-up sequence; when the visitor walks in, the arcade wakes one tube at
 * a time, each with its own nervous flicker before it catches.
 *
 *   power.add(delay, (v) => material.opacity = v)
 *
 * Items with a negative delay (the street lamp, the vending machine) are the
 * city's, not the arcade's: they are already burning before anyone arrives.
 */
export class Power {
    constructor() {
        this.items = [];
        this.t = -2.5;         // the street's own lights come up while the page loads
        this.limit = 0;        // the clock holds here until the doors open
        this.rand = rng(99);
        this.onIgnite = null;
    }

    add(delay, apply, { flicker = 0.55, stutter = 0, quiet = false } = {}) {
        // A few random blinks during warm-up, then steady.
        const blinks = [];
        let t = 0;
        while (t < flicker) {
            const on = 0.02 + this.rand() * 0.08;
            const off = 0.03 + this.rand() * 0.12;
            blinks.push([t, t + on]);
            t += on + off;
        }
        const item = { delay, apply, flicker, blinks, stutter, quiet, seed: this.rand() * 100, value: -1, lit: false };
        this.items.push(item);
        apply(0);
        return item;
    }

    // Opens the doors: the sequence runs on from wherever the street is.
    open() {
        this.limit = Infinity;
    }

    // Everything on immediately.
    instant() {
        this.limit = Infinity;
        this.t = 1e5;
    }

    level(item, time) {
        const local = this.t - item.delay;
        if (local < 0) return 0;
        if (local < item.flicker) {
            for (const [a, b] of item.blinks) if (local >= a && local < b) return 0.6 + 0.4 * ((local - a) / (b - a));
            return 0.04;
        }
        if (item.stutter) {
            // A tired tube: every so often it drops out for a beat.
            const s = Math.sin(time * 0.37 + item.seed) * Math.sin(time * 1.13 + item.seed * 2);
            if (s > 1 - item.stutter) return Math.sin(time * 60 + item.seed) > 0 ? 1 : 0.1;
        }
        return 1;
    }

    update(dt, time) {
        this.t = Math.min(this.t + dt, this.limit);
        for (const item of this.items) {
            const v = this.level(item, time);
            if (v !== item.value) {
                if (!item.lit && v > 0.5) {
                    item.lit = true;
                    if (!item.quiet && this.t < 1e4) this.onIgnite?.(item);
                }
                item.value = v;
                item.apply(v);
            }
        }
    }
}

export const power = new Power();
