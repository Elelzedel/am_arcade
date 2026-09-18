// CPU profile of the arcade (Chromium sampling profiler): the load phase, then
// a few seconds of walking. Prints self time per function.
// Usage: node scripts/profile.mjs http://localhost:8080/?nolock
import puppeteer from 'puppeteer-core';
const url = process.argv[2];
const browser = await puppeteer.launch({
    executablePath: process.env.CHROMIUM || '/usr/bin/chromium', headless: true,
    args: ['--use-angle=vulkan', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan', '--autoplay-policy=no-user-gesture-required', '--window-size=1280,800'],
    defaultViewport: { width: 1280, height: 800 },
});
const page = await browser.newPage();
const client = await page.createCDPSession();
await client.send('Profiler.enable');
await client.send('Profiler.setSamplingInterval', { interval: 200 });

function summarize(profile, label, topN = 22) {
    const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
    const self = new Map();
    const dt = profile.timeDeltas;
    for (let i = 0; i < profile.samples.length; i++) {
        const n = nodes.get(profile.samples[i]);
        const f = n.callFrame;
        const file = (f.url || '').split('/').slice(-2).join('/').split('?')[0];
        const key = `${f.functionName || '(anon)'} ${file}:${f.lineNumber + 1}`;
        self.set(key, (self.get(key) || 0) + (dt[i] || 0));
    }
    const total = [...self.values()].reduce((a, b) => a + b, 0) / 1000;
    const rows = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN)
        .map(([k, v]) => `${(v / 1000).toFixed(1).padStart(7)} ms  ${k}`);
    console.log(`=== ${label}: ${total.toFixed(0)} ms sampled ===\n${rows.join('\n')}`);
}

await client.send('Profiler.start');
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.arcade && window.arcade.state === 'intro', { timeout: 30000 });
const { profile: loadProfile } = await client.send('Profiler.stop');
summarize(loadProfile, 'load');

await page.mouse.click(640, 400);
await new Promise((r) => setTimeout(r, 2500));
await client.send('Profiler.start');
await page.keyboard.down('KeyW');
await new Promise((r) => setTimeout(r, 3000));
await page.keyboard.up('KeyW');
await page.mouse.move(700, 400); await page.mouse.move(500, 380);
await new Promise((r) => setTimeout(r, 1500));
const { profile: walkProfile } = await client.send('Profiler.stop');
summarize(walkProfile, 'walking 4.5 s');
await browser.close();
