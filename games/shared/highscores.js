const MAX_ENTRIES = 5;
const DEFAULT_NAMES = ['AMA', 'ELZ', 'TNK', 'RCR', 'CPU'];

function storageKey(gameId) {
    return `am-arcade:highscores:${gameId}`;
}

// Persistent top-5 table per game, seeded with beatable defaults so a fresh
// cabinet still looks lived in.
export class HighScoreTable {
    constructor(gameId, defaultScores = [5000, 4000, 3000, 2000, 1000]) {
        this.gameId = gameId;
        this.entries = this.load() || defaultScores.map((score, i) => ({ name: DEFAULT_NAMES[i], score }));
    }

    load() {
        try {
            const raw = localStorage.getItem(storageKey(this.gameId));
            const parsed = raw ? JSON.parse(raw) : null;
            return Array.isArray(parsed) ? parsed : null;
        } catch {
            return null;
        }
    }

    save() {
        try {
            localStorage.setItem(storageKey(this.gameId), JSON.stringify(this.entries));
        } catch {
            // Storage may be unavailable (private mode); scores just won't persist.
        }
    }

    get top() {
        return this.entries[0] ? this.entries[0].score : 0;
    }

    qualifies(score) {
        return score > 0 && (this.entries.length < MAX_ENTRIES || score > this.entries[this.entries.length - 1].score);
    }

    // Returns the rank (0-based) the new entry landed at.
    add(name, score) {
        const entry = { name, score };
        this.entries.push(entry);
        this.entries.sort((a, b) => b.score - a.score);
        this.entries = this.entries.slice(0, MAX_ENTRIES);
        this.save();
        return this.entries.indexOf(entry);
    }
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ';

// Classic three-letter initials entry driven by arrow keys.
export class InitialsEntry {
    constructor(initial = 'AAA') {
        this.chars = initial.split('').map((c) => Math.max(0, LETTERS.indexOf(c)));
        this.cursor = 0;
        this.done = false;
    }

    get name() {
        return this.chars.map((i) => LETTERS[i]).join('');
    }

    // Returns true if the key was consumed.
    handleKey(code) {
        if (this.done) return false;
        switch (code) {
            case 'ArrowUp':
            case 'KeyW':
                this.chars[this.cursor] = (this.chars[this.cursor] + 1) % LETTERS.length;
                return true;
            case 'ArrowDown':
            case 'KeyS':
                this.chars[this.cursor] = (this.chars[this.cursor] + LETTERS.length - 1) % LETTERS.length;
                return true;
            case 'ArrowLeft':
            case 'KeyA':
                this.cursor = Math.max(0, this.cursor - 1);
                return true;
            case 'ArrowRight':
            case 'KeyD':
                this.cursor = Math.min(2, this.cursor + 1);
                return true;
            case 'Space':
            case 'Enter':
            case 'NumpadEnter':
                if (this.cursor < 2) {
                    this.cursor++;
                } else {
                    this.done = true;
                }
                return true;
            default:
                return false;
        }
    }
}
