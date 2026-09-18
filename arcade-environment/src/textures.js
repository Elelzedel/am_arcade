import * as THREE from 'three';
import { font } from '../../games/shared/font.js';
import { loadImage } from '../../games/shared/art.js';

// Procedurally drawn textures. Where artwork exists it is painted on top once
// it loads, so nothing waits on an image and a missing file still looks fine.

function canvas(width, height) {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    return c;
}

function toTexture(c, { repeat = null, srgb = true } = {}) {
    const texture = new THREE.CanvasTexture(c);
    if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    if (repeat) {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(repeat[0], repeat[1]);
    }
    return texture;
}

// Redraws a canvas texture with an image once it has loaded.
function paintWhenLoaded(texture, url, draw) {
    if (!url) return;
    loadImage(url).then((img) => {
        draw(img);
        texture.needsUpdate = true;
    }).catch((err) => console.warn(err.message));
}

// Draws an image scaled to cover a rectangle, cropping the overflow evenly.
function drawCover(ctx, img, x, y, w, h) {
    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

// Seeded RNG so the carpet looks the same every visit.
function rng(seed) {
    let s = seed;
    return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

// Classic blacklight arcade carpet: dark base with neon squiggles and shapes.
// Returns both the colour map and a matching emissive map for the UV glow.
export function createCarpetTextures() {
    const size = 1024;
    const base = canvas(size, size);
    const glow = canvas(size, size);
    const b = base.getContext('2d');
    const g = glow.getContext('2d');
    const rand = rng(1987);

    b.fillStyle = '#0b0a1c';
    b.fillRect(0, 0, size, size);
    g.fillStyle = '#000';
    g.fillRect(0, 0, size, size);

    // Fine fibre noise on the base only.
    const img = b.getImageData(0, 0, size, size);
    for (let i = 0; i < img.data.length; i += 4) {
        const n = (rand() - 0.5) * 18;
        img.data[i] += n;
        img.data[i + 1] += n;
        img.data[i + 2] += n + 4;
    }
    b.putImageData(img, 0, 0);

    const colors = ['#ff2bd6', '#00e5ff', '#39ff14', '#ffb000', '#8a5cff', '#ff3b3b'];
    const shapes = 140;

    // Draw each shape on both canvases, wrapping around edges so it tiles.
    const drawBoth = (fn) => {
        for (const ctx of [b, g]) {
            for (const dx of [-size, 0, size]) {
                for (const dy of [-size, 0, size]) {
                    ctx.save();
                    ctx.translate(dx, dy);
                    fn(ctx);
                    ctx.restore();
                }
            }
        }
    };

    for (let i = 0; i < shapes; i++) {
        const x = rand() * size;
        const y = rand() * size;
        const color = colors[Math.floor(rand() * colors.length)];
        const kind = rand();
        const rot = rand() * Math.PI * 2;
        const scale = 14 + rand() * 26;
        drawBoth((ctx) => {
            ctx.translate(x, y);
            ctx.rotate(rot);
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = 5;
            ctx.lineCap = 'round';
            ctx.globalAlpha = ctx === b ? 0.75 : 1;
            ctx.beginPath();
            if (kind < 0.3) {
                // squiggle
                ctx.moveTo(-scale * 1.5, 0);
                for (let k = 0; k <= 6; k++) {
                    ctx.quadraticCurveTo(-scale * 1.5 + (k + 0.5) * scale * 0.5, (k % 2 ? 1 : -1) * scale * 0.5, -scale * 1.5 + (k + 1) * scale * 0.5, 0);
                }
                ctx.stroke();
            } else if (kind < 0.5) {
                ctx.moveTo(0, -scale);
                ctx.lineTo(scale * 0.9, scale * 0.6);
                ctx.lineTo(-scale * 0.9, scale * 0.6);
                ctx.closePath();
                ctx.stroke();
            } else if (kind < 0.7) {
                ctx.arc(0, 0, scale * 0.6, 0, Math.PI * 2);
                ctx.stroke();
            } else if (kind < 0.8) {
                // star burst
                for (let k = 0; k < 4; k++) {
                    ctx.moveTo(0, 0);
                    ctx.lineTo(Math.cos(k * Math.PI / 2) * scale * 0.7, Math.sin(k * Math.PI / 2) * scale * 0.7);
                }
                ctx.stroke();
            } else {
                ctx.arc(0, 0, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }

    return {
        map: toTexture(base, { repeat: [4, 4] }),
        emissiveMap: toTexture(glow, { repeat: [4, 4] }),
    };
}

export function createWallTexture() {
    const c = canvas(512, 512);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#1a1030');
    grad.addColorStop(1, '#120a22');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);
    // vertical panel seams
    for (let x = 0; x < 512; x += 128) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(x, 0, 4, 512);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.fillRect(x + 4, 0, 2, 512);
    }
    // faint geometric pattern
    ctx.strokeStyle = 'rgba(138, 92, 255, 0.08)';
    ctx.lineWidth = 2;
    for (let y = 32; y < 512; y += 64) {
        for (let x = 0; x < 512; x += 128) {
            ctx.beginPath();
            ctx.moveTo(x + 20, y);
            ctx.lineTo(x + 64, y + 22);
            ctx.lineTo(x + 108, y);
            ctx.stroke();
        }
    }
    return toTexture(c, { repeat: [6, 1.5] });
}

export function createCeilingTexture() {
    const c = canvas(256, 256);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0d0b16';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#1e1a2c';
    ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, 256, 256);
    const rand = rng(42);
    for (let i = 0; i < 500; i++) {
        ctx.fillStyle = `rgba(255,255,255,${rand() * 0.04})`;
        ctx.fillRect(rand() * 256, rand() * 256, 2, 2);
    }
    return toTexture(c, { repeat: [10, 10] });
}

// Glowing text sign on a transparent background.
export function createNeonSignTexture(text, color, { width = 1024, height = 256, size = 110, sub = null, subColor = '#ffffff' } = {}) {
    const c = canvas(width, height);
    const ctx = c.getContext('2d');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const y = sub ? height * 0.4 : height / 2;
    ctx.font = font(size);
    for (const blur of [40, 20, 8]) {
        ctx.shadowColor = color;
        ctx.shadowBlur = blur;
        ctx.fillStyle = color;
        ctx.fillText(text, width / 2, y);
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.7;
    ctx.fillText(text, width / 2, y);
    ctx.globalAlpha = 1;
    if (sub) {
        ctx.font = font(Math.round(size * 0.28));
        ctx.shadowColor = subColor;
        ctx.shadowBlur = 16;
        ctx.fillStyle = subColor;
        ctx.fillText(sub, width / 2, height * 0.8);
    }
    return toTexture(c);
}

// Backlit marquee strip above a cabinet's screen.
export function createMarqueeTexture(title, color, emblemUrl = null) {
    const c = canvas(512, 128);
    const ctx = c.getContext('2d');
    const texture = toTexture(c);
    const draw = (emblem) => drawMarquee(ctx, title, color, emblem);
    draw(null);
    paintWhenLoaded(texture, emblemUrl, draw);
    return texture;
}

function drawMarquee(ctx, title, color, emblem) {
    const grad = ctx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, '#16102a');
    grad.addColorStop(0.5, '#241a44');
    grad.addColorStop(1, '#16102a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 128);

    // starburst rays
    ctx.save();
    ctx.translate(256, 64);
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = color;
    for (let i = 0; i < 16; i++) {
        ctx.rotate(Math.PI / 8);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(300, -14);
        ctx.lineTo(300, 14);
        ctx.fill();
    }
    ctx.restore();

    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 506, 122);

    // The game's emblem glows at each end of the marquee.
    let textWidth = 470;
    if (emblem) {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
        ctx.drawImage(emblem, 12, 12, 104, 104);
        ctx.drawImage(emblem, 396, 12, 104, 104);
        ctx.restore();
        textWidth = 270;
    }

    const line = title.replace(/\n/g, ' ');
    let size = 40;
    ctx.font = font(size);
    while (ctx.measureText(line).width > textWidth && size > 12) {
        size -= 2;
        ctx.font = font(size);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000';
    ctx.fillText(line, 259, 69);
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = color;
    ctx.fillText(line, 256, 66);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(line, 256, 66);
}

// Side-panel artwork: bold stripes, the game's emblem and its name.
export function createSideArtTexture(title, color, emblemUrl = null) {
    const c = canvas(512, 1024);
    const ctx = c.getContext('2d');
    const texture = toTexture(c);
    drawSideStripes(ctx, title, color);
    paintWhenLoaded(texture, emblemUrl, (emblem) => drawSideArt(ctx, title, color, emblem));
    return texture;
}

function drawSideArt(ctx, title, color, emblem) {
    ctx.clearRect(0, 0, 512, 1024);
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = color;
    // Racing stripes top and bottom, matching the striped fallback.
    ctx.fillRect(0, 40, 512, 22);
    ctx.fillRect(0, 74, 512, 8);
    ctx.fillRect(0, 942, 512, 8);
    ctx.fillRect(0, 962, 512, 22);
    ctx.restore();
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 40;
    ctx.drawImage(emblem, 46, 150, 420, 420);
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = title.split('\n');
    let size = 56;
    ctx.font = font(size);
    while (lines.some((l) => ctx.measureText(l).width > 440) && size > 16) {
        size -= 4;
        ctx.font = font(size);
    }
    const lineHeight = size * 1.5;
    const y0 = 760 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, i) => {
        ctx.lineWidth = 10;
        ctx.strokeStyle = '#000';
        ctx.strokeText(line, 256, y0 + i * lineHeight);
        ctx.fillStyle = color;
        ctx.fillText(line, 256, y0 + i * lineHeight);
    });
}

function drawSideStripes(ctx, title, color) {
    ctx.clearRect(0, 0, 512, 1024);
    ctx.save();
    ctx.translate(256, 512);
    ctx.rotate(-Math.PI / 2);
    // stripes
    const stripe = (offset, width, alpha) => {
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;
        ctx.fillRect(-512, offset, 1024, width);
    };
    stripe(-150, 24, 0.9);
    stripe(-116, 10, 0.6);
    stripe(120, 10, 0.6);
    stripe(140, 24, 0.9);
    ctx.globalAlpha = 1;
    const line = title.replace(/\n/g, ' ');
    let size = 64;
    ctx.font = font(size);
    while (ctx.measureText(line).width > 900 && size > 16) {
        size -= 4;
        ctx.font = font(size);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#000';
    ctx.strokeText(line, 0, 0);
    ctx.fillStyle = color;
    ctx.fillText(line, 0, 0);
    ctx.restore();
}

// Wall poster: the game's painting with its title and tagline, or a synthwave
// placeholder until (or if) the painting can't be loaded.
export function createPosterTexture(title, color, tagline, imageUrl = null) {
    const c = canvas(768, 1024);
    const ctx = c.getContext('2d');
    const texture = toTexture(c);
    ctx.save();
    ctx.scale(2, 2);
    drawPosterPlaceholder(ctx, title, color, tagline);
    ctx.restore();
    paintWhenLoaded(texture, imageUrl, (img) => {
        drawCover(ctx, img, 0, 0, 768, 1024);
        // Fade the bands the text sits on so it reads over any painting.
        const top = ctx.createLinearGradient(0, 0, 0, 260);
        top.addColorStop(0, 'rgba(5,3,12,0.92)');
        top.addColorStop(1, 'rgba(5,3,12,0)');
        ctx.fillStyle = top;
        ctx.fillRect(0, 0, 768, 260);
        const bottom = ctx.createLinearGradient(0, 880, 0, 1024);
        bottom.addColorStop(0, 'rgba(5,3,12,0)');
        bottom.addColorStop(1, 'rgba(5,3,12,0.9)');
        ctx.fillStyle = bottom;
        ctx.fillRect(0, 880, 768, 144);
        ctx.save();
        ctx.scale(2, 2);
        drawPosterText(ctx, title, color, tagline);
        ctx.restore();
    });
    return texture;
}

function drawPosterText(ctx, title, color, tagline) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = title.split('\n');
    lines.forEach((line, i) => {
        ctx.font = font(34);
        ctx.fillStyle = '#000';
        ctx.fillText(line, 195, 73 + i * 48);
        ctx.shadowColor = color;
        ctx.shadowBlur = 16;
        ctx.fillStyle = color;
        ctx.fillText(line, 192, 70 + i * 48);
        ctx.shadowBlur = 0;
    });
    ctx.font = font(12);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 6;
    ctx.fillText(tagline, 192, 480);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8;
    ctx.strokeRect(0, 0, 384, 512);
}

function drawPosterPlaceholder(ctx, title, color, tagline) {
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#05030c');
    grad.addColorStop(1, '#1d0f3a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 384, 512);
    // perspective grid "horizon"
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
        const y = 330 + i * i * 2.2;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(384, y);
        ctx.stroke();
    }
    for (let i = -8; i <= 8; i++) {
        ctx.beginPath();
        ctx.moveTo(192 + i * 12, 330);
        ctx.lineTo(192 + i * 70, 512);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // sun
    const sun = ctx.createLinearGradient(0, 180, 0, 330);
    sun.addColorStop(0, '#ffe066');
    sun.addColorStop(1, color);
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(192, 330, 110, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#05030c';
    for (let i = 0; i < 6; i++) {
        ctx.fillRect(60, 250 + i * 14, 264, 3 + i);
    }
    drawPosterText(ctx, title, color, tagline);
}

// Hand-written "OUT OF ORDER" note taped to a broken cabinet.
export function createOutOfOrderTexture() {
    const c = canvas(256, 192);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f4f1e4';
    ctx.fillRect(0, 0, 256, 192);
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    for (let y = 30; y < 192; y += 22) ctx.fillRect(0, y, 256, 2);
    ctx.fillStyle = '#c21d2e';
    ctx.textAlign = 'center';
    ctx.font = 'bold 40px "Comic Sans MS", "Marker Felt", cursive';
    ctx.fillText('OUT OF', 128, 70);
    ctx.fillText('ORDER', 128, 118);
    ctx.fillStyle = '#333';
    ctx.font = '20px "Comic Sans MS", cursive';
    ctx.fillText('sorry! -mgmt', 128, 165);
    // tape
    ctx.fillStyle = 'rgba(255,255,200,0.6)';
    ctx.fillRect(90, 0, 76, 16);
    return toTexture(c);
}

// Backlit front panel of the soda machine.
export function createSodaFrontTexture() {
    const c = canvas(256, 552);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 256, 0);
    grad.addColorStop(0, '#b0001c');
    grad.addColorStop(0.5, '#ff2a44');
    grad.addColorStop(1, '#b0001c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 552);

    // A big tilted can.
    ctx.save();
    ctx.translate(128, 300);
    ctx.rotate(-0.25);
    ctx.fillStyle = '#e8e8ec';
    ctx.beginPath();
    ctx.roundRect(-55, -120, 110, 240, 18);
    ctx.fill();
    ctx.fillStyle = '#d1001f';
    ctx.fillRect(-55, -80, 110, 160);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-55, 10);
    ctx.bezierCurveTo(-20, -30, 20, 50, 55, 0);
    ctx.stroke();
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'italic bold 64px Georgia, serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 6;
    ctx.fillText('Cola', 128, 70);
    ctx.shadowBlur = 0;
    ctx.font = font(14);
    ctx.fillText('ICE COLD', 128, 500);
    return toTexture(c);
}
