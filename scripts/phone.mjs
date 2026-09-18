// Drives the diorama as a phone would: iPhone-sized viewport at 3x, touch
// events injected through the DevTools protocol (so pointer events, multi
// touch and gestures behave as they do on a real device).
//
//   node scripts/phone.mjs <out-prefix> [portrait|landscape] [steps.json]
//
// Steps: { wait }, { shot }, { eval }, { tap: [x, y] },
//        { drag: [[x0, y0], [x1, y1]], ms, hold }   one finger, eased path
//        { touch: [[x, y], ...], ms }               fingers down together
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const [prefix = '/tmp/ph', orient = 'portrait', stepsPath] = process.argv.slice(2);
const [w, h] = orient === 'landscape' ? [844, 390] : [390, 844];
const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium', headless: true,
    args: ['--use-angle=vulkan', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.emulate({
    viewport: { width: w, height: h, deviceScaleFactor: 3, isMobile: true, hasTouch: true, isLandscape: orient === 'landscape' },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
page.on('pageerror', (e) => console.log('[exception]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[error]', m.text().slice(0, 300)); });
const cdp = await page.createCDPSession();
// PHONE_CPU=4 slows the CPU down like a mid-range phone
if (process.env.PHONE_CPU) await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.PHONE_CPU) });
const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto(process.argv[5] || 'http://localhost:8080/?skip', { waitUntil: 'load' });
const steps = stepsPath ? JSON.parse(fs.readFileSync(stepsPath, 'utf8')) : [{ wait: 5000 }, { shot: 'default' }];
for (const s of steps) {
    if (s.wait) await wait(s.wait);
    if (s.eval) console.log('[eval]', JSON.stringify(await page.evaluate(s.eval)));
    if (s.tap) {
        await touch('touchStart', [s.tap]);
        await wait(60);
        await touch('touchEnd', []);
    }
    if (s.drag) {
        const [[x0, y0], [x1, y1]] = s.drag;
        const n = 12;
        await touch('touchStart', [[x0, y0]]);
        for (let i = 1; i <= n; i++) {
            const t = i / n;
            await touch('touchMove', [[x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]]);
            await wait((s.ms || 240) / n);
        }
        if (s.hold) await wait(s.hold);
        if (s.evalHeld) console.log('[evalHeld]', JSON.stringify(await page.evaluate(s.evalHeld)));
        if (s.shotHeld) {
            await page.screenshot({ path: `${prefix}-${s.shotHeld}.png` });
            console.log('[shot]', s.shotHeld);
        }
        await touch('touchEnd', []);
    }
    if (s.pinch) {
        // two fingers moving apart (or together): [[cx, cy], fromGap, toGap]
        const [[cx, cy], a, b] = s.pinch;
        const at = (g) => [[cx - g / 2, cy], [cx + g / 2, cy]];
        await touch('touchStart', at(a));
        for (let i = 1; i <= 10; i++) {
            await touch('touchMove', at(a + ((b - a) * i) / 10));
            await wait(25);
        }
        await touch('touchEnd', []);
    }
    if (s.touch) {
        await touch('touchStart', s.touch);
        await wait(s.ms || 400);
        if (s.shotHeld) {
            await page.screenshot({ path: `${prefix}-${s.shotHeld}.png` });
            console.log('[shot]', s.shotHeld);
        }
        await touch('touchEnd', []);
    }
    if (s.shot) {
        await page.screenshot({ path: `${prefix}-${s.shot}.png` });
        console.log('[shot]', s.shot);
    }
}
await browser.close();
