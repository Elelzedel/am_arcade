// GPU time of one full frame (scene, shadows, post), via timer queries.
//   node scripts/gpu.mjs <url> [dpr]
import puppeteer from 'puppeteer-core';
const [url = 'http://localhost:8080/?skip', dpr = '2'] = process.argv.slice(2);
const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium', headless: true,
    args: ['--use-angle=vulkan', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan', '--enable-webgl-draft-extensions'],
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: Number(dpr) },
});
const page = await browser.newPage();
await page.goto(url, { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 6000));
const res = await page.evaluate(async () => {
    const r = window.arcade.stage.renderer;
    const gl = r.getContext();
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if (!ext) return 'no timer query';
    const times = [];
    for (let i = 0; i < 30; i++) {
        const q = gl.createQuery();
        r.shadowMap.needsUpdate = true;
        gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
        window.arcade.stage.render(i);
        gl.endQuery(ext.TIME_ELAPSED_EXT);
        await new Promise((ok) => {
            const poll = () => (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE) ? ok() : setTimeout(poll, 5));
            poll();
        });
        times.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
    }
    times.sort((a, b) => a - b);
    return { gpuMsP50: +times[15].toFixed(2), gpuMsMin: +times[0].toFixed(2) };
});
console.log(JSON.stringify(res));
await browser.close();
