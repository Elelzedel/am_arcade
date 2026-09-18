// Close-up inspection shots of the diorama from fixed poses.
//   node scripts/closeups.mjs <out-prefix> [name ...]
import puppeteer from 'puppeteer-core';
const POSES = {
    shelves: [[-2.9, 1.7, -1.5], [-4.35, 1.05, -3.35], 50],
    pylon: [[-2.8, 4.6, -2.4], [-6.05, 4.3, -5.25], 40],
    figures: [[-3.6, 1.5, -2.5], [-4.2, 1.25, -3.6], 38],
    kitty: [[1.7, 1.55, -2.35], [1.05, 1.15, -3.2], 26],
    prizewall: [[1.4, 1.9, -1.2], [1.5, 1.9, -3.8], 48],
    counterTop: [[2.0, 1.5, -2.0], [1.4, 1.1, -3.2], 40],
    gameon: [[-2.6, 2.6, -1.55], [-4.8, 2.7, -1.55], 45],
    counter: [[0.9, 1.9, -0.6], [-0.3, 1.2, -3.2], 38],
    cat: [[-0.1, 1.75, -2.0], [-0.55, 1.25, -3.0], 30],
    jukebox: [[-2.2, 1.5, 0.1], [-4.1, 1.0, -0.45], 40],
    rocket: [[0.6, 1.4, 0.4], [-0.95, 0.7, -1.15], 38],
    vending: [[3.4, 1.6, -0.4], [1.6, 1.0, -2.35], 42],
    bench: [[-2.0, 1.5, 4.3], [-3.3, 0.6, 2.1], 42],
    sign: [[-0.4, 4.2, 2.4], [-1.95, 4.3, -3.8], 36],
    left: [[-0.5, 2.0, 0.2], [-4.4, 1.5, -1.8], 45],
    back: [[-2.2, 1.9, 0.3], [-2.4, 1.4, -3.7], 50],
    pole: [[4.5, 3.0, 0.0], [3.0, 3.0, -3.9], 45],
};
const [prefix = '/tmp/cu', ...names] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--use-angle=vulkan', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan'], defaultViewport: { width: 1280, height: 800 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[page exception]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[page error]', m.text()); });
await page.goto('http://localhost:8080/?skip', { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 4500));
for (const name of names.length ? names : Object.keys(POSES)) {
    const [p, t, fov] = POSES[name];
    await page.evaluate((p, t, fov) => {
        const V = window.arcade.rig.target.constructor;
        window.arcade.rig.mode = 'fixed';
        window.arcade.rig.fixedPose = { position: new V(...p), target: new V(...t), fov };
    }, p, t, fov);
    await new Promise((r) => setTimeout(r, 700));
    await page.screenshot({ path: `${prefix}-${name}.png` });
    console.log(`[shot] ${prefix}-${name}.png`);
}
await browser.close();
