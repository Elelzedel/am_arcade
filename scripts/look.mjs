// Quick visual check of the diorama in headless Chromium.
//
//   node scripts/look.mjs <out.png> [url] [--eval "js"] [--wait ms] [--size 1440x900]
//
// Evaluates the optional JS after the page settles (e.g. to move the camera),
// waits, then screenshots. Page errors and warnings are printed.
import puppeteer from 'puppeteer-core';

const args = process.argv.slice(2);
const out = args[0] || '/tmp/look.png';
let url = 'http://localhost:8080/';
const evals = [];
let wait = 4000;
let size = [1440, 900];
for (let i = 1; i < args.length; i++) {
    if (args[i] === '--eval') evals.push(args[++i]);
    else if (args[i] === '--wait') wait = Number(args[++i]);
    else if (args[i] === '--size') size = args[++i].split('x').map(Number);
    else url = args[i];
}

const browser = await puppeteer.launch({
    executablePath: process.env.CHROMIUM || '/usr/bin/chromium',
    headless: true,
    args: ['--use-angle=vulkan', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan', '--autoplay-policy=no-user-gesture-required', `--window-size=${size[0]},${size[1]}`],
    defaultViewport: { width: size[0], height: size[1] },
});
const page = await browser.newPage();
page.on('console', (msg) => {
    if (['error', 'warn', 'log'].includes(msg.type())) console.log(`[page ${msg.type()}]`, msg.text().slice(0, 400));
});
page.on('pageerror', (err) => console.log('[page exception]', err.message));
await page.goto(url, { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 2500));
for (const js of evals) {
    const v = await page.evaluate(js);
    if (v !== undefined) console.log('[eval]', JSON.stringify(v));
    await new Promise((r) => setTimeout(r, 200));
}
await new Promise((r) => setTimeout(r, wait));
await page.screenshot({ path: out });
console.log('[shot]', out);
await browser.close();
