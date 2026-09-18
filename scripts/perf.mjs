// Uncapped frame timing of the overview (and first person) at a given pixel density.
//   node scripts/perf.mjs <url> [dpr] [seconds]
import puppeteer from 'puppeteer-core';
const [url = 'http://localhost:8080/?skip', dpr = '2', seconds = '6'] = process.argv.slice(2);
const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium', headless: true,
    args: [...(process.env.SOFTWARE_GL ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=vulkan', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan']), '--disable-gpu-vsync', '--disable-frame-rate-limit'],
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: Number(dpr) },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[page exception]', e.message));
await page.goto(url, { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 5000));
const measure = (label) => page.evaluate((s, label) => new Promise((res) => {
    let n = 0; const t0 = performance.now(); const times = []; let last = t0;
    const f = () => { const t = performance.now(); times.push(t - last); last = t; n++; if (t - t0 < s * 1000) requestAnimationFrame(f); else { times.sort((a, b) => a - b); res({ label, fps: +(n / ((t - t0) / 1000)).toFixed(1), p50: +times[Math.floor(times.length / 2)].toFixed(2), p95: +times[Math.floor(times.length * 0.95)].toFixed(2), tier: window.arcade?.stage?.tier?.name }); } };
    requestAnimationFrame(f);
}), Number(seconds), label);
console.log(JSON.stringify(await measure('overview')));
const walks = await page.evaluate(() => !!window.arcade?.startWalking);
if (walks) {
    await page.evaluate(() => window.arcade.startWalking());
    await new Promise((r) => setTimeout(r, 2500));
    console.log(JSON.stringify(await measure('first person')));
}
await browser.close();
