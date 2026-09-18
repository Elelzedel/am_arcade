// CPU cost of each frame (script + draw submission), measured around the rAF callback.
//   node scripts/cpu.mjs <url> [dpr]
import puppeteer from 'puppeteer-core';
const [url = 'http://localhost:8080/?skip', dpr = '2'] = process.argv.slice(2);
const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium', headless: true,
    args: ['--use-angle=vulkan', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan'],
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: Number(dpr) },
});
const page = await browser.newPage();
await page.evaluateOnNewDocument(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.__cpu = [];
    window.requestAnimationFrame = (cb) => raf((t) => { const s = performance.now(); cb(t); window.__cpu.push(performance.now() - s); });
});
await page.goto(url, { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 6000));
const report = await page.evaluate(async () => {
    window.__cpu.length = 0;
    await new Promise((r) => setTimeout(r, 5000));
    const a = window.__cpu.slice().sort((x, y) => x - y);
    const gl = window.arcade.stage.renderer.getContext();
    const t = performance.now();
    for (let i = 0; i < 10; i++) window.arcade.stage.render(1);
    gl.finish();
    return { frames: a.length, cpuP50: +a[a.length >> 1].toFixed(2), cpuP95: +a[Math.floor(a.length * 0.95)].toFixed(2), renderWithFinish: +((performance.now() - t) / 10).toFixed(2), calls: window.arcade.stage.renderer.info.render.calls };
});
console.log(JSON.stringify(report));
await browser.close();
