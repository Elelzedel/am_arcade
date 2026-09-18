// Headless playtest helper using the system Chromium.
//
//   node scripts/shot.mjs <url> <out-prefix> [script.json]
//
// script.json is a list of steps:
//   { "wait": 500 }                       sleep ms
//   { "down": "Space" } / { "up": "Space" }  hold / release a key (KeyboardEvent.code)
//   { "press": "Space", "hold": 100 }     tap a key
//   { "eval": "window.game.score" }       evaluate and print the result
//   { "shot": "name" }                    screenshot to <out-prefix>-name.png
//   { "init": "js" }                      run js before the page loads (must be
//                                         the first step; useful for instrumenting
//                                         APIs the app uses at startup)
// Console errors from the page are printed so crashes are visible.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const [url, outPrefix = '/tmp/shot', scriptPath] = process.argv.slice(2);
if (!url) {
    console.error('usage: node scripts/shot.mjs <url> <out-prefix> [script.json]');
    process.exit(1);
}
const steps = scriptPath ? JSON.parse(fs.readFileSync(scriptPath, 'utf8')) : [{ wait: 1500 }, { shot: 'default' }];

const browser = await puppeteer.launch({
    executablePath: process.env.CHROMIUM || '/usr/bin/chromium',
    headless: true,
    args: [...(process.env.SOFTWARE_GL ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=vulkan', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan']), '--autoplay-policy=no-user-gesture-required', '--window-size=1280,800'],
    defaultViewport: { width: 1280, height: 800 },
    // Long playtests run as a single evaluate; don't cut them off at 3 minutes.
    protocolTimeout: 15 * 60 * 1000,
});

const page = await browser.newPage();
page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warn') console.log(`[page ${msg.type()}]`, msg.text());
});
page.on('pageerror', (err) => console.log('[page exception]', err.message));

const init = steps.find((step) => step.init);
if (init) await page.evaluateOnNewDocument(init.init);

await page.goto(url, { waitUntil: 'load' });

// Map KeyboardEvent.code -> puppeteer key name.
const keyName = (code) => ({ Space: ' ' }[code] ? 'Space' : code);

for (const step of steps) {
    if (step.wait) await new Promise((r) => setTimeout(r, step.wait));
    if (step.down) await page.keyboard.down(keyName(step.down));
    if (step.up) await page.keyboard.up(keyName(step.up));
    if (step.press) {
        await page.keyboard.down(keyName(step.press));
        await new Promise((r) => setTimeout(r, step.hold || 60));
        await page.keyboard.up(keyName(step.press));
    }
    if (step.click) await page.mouse.click(step.click[0], step.click[1]);
    if (step.eval) {
        const value = await page.evaluate(step.eval);
        console.log(`[eval] ${step.eval} =>`, JSON.stringify(value));
    }
    if (step.shot) {
        const path = `${outPrefix}-${step.shot}.png`;
        await page.screenshot({ path });
        console.log(`[shot] ${path}`);
    }
}

await browser.close();
