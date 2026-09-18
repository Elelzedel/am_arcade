// Regression: priming an off-camera screen must not leave an infinite timer.
// Usage: node scripts/check-cabinets.mjs http://localhost:8093
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';

const url = new URL(process.argv[2] || 'http://localhost:8080');
url.searchParams.set('nolock', '');
url.searchParams.set('quality', 'low');
const browser = await puppeteer.launch({
    executablePath: process.env.CHROMIUM || '/usr/bin/chromium',
    headless: true,
    args: ['--use-angle=vulkan', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan', '--autoplay-policy=no-user-gesture-required'],
});
try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(url.href);
    await page.waitForFunction(() => window.arcade?.state === 'intro');
    const results = await page.evaluate(() => {
        const a = window.arcade;
        a.renderer.setAnimationLoop(null);
        const check = (condition, message) => { if (!condition) throw Error(message); };
        const fingerprint = c => {
            const pixels = c.game.ctx.getImageData(0, 0, 800, 600).data;
            let hash = 0, lit = 0;
            for (let i = 0; i < pixels.length; i += 28) {
                hash = Math.imul(hash ^ pixels[i], 16777619);
                if (pixels[i] + pixels[i+1] + pixels[i+2] > 80) lit++;
            }
            return { hash, lit };
        };
        return a.cabinets.filter(c => !c.broken).map(c => {
            const name = c.meta.id;
            c.game.ctx.clearRect(0, 0, 800, 600);
            c.interval = Infinity; c.frameTimer = 0; c.pendingDt = 0;
            c.renderFrame(a.renderer);
            check(Number.isFinite(c.frameTimer), `${name}: infinite startup timer`);
            check(fingerprint(c).lit > 50, `${name}: blank startup screen`);
            c.update(1/60, a.camera, { intersectsSphere: () => false });
            const pose = c.getPlayPose(1.6);
            a.camera.position.copy(pose.position); a.camera.quaternion.copy(pose.quaternion);
            a.camera.fov = pose.fov; a.camera.updateProjectionMatrix(); a.camera.updateMatrixWorld();
            let refreshed = false;
            for (let i=0; i<30; i++) if(c.update(1/60,a.camera,{intersectsSphere:()=>true})) {
                c.renderFrame(a.renderer); refreshed = true;
            }
            check(refreshed, `${name}: never resumed after becoming visible`);
            c.setActive(true); c.keyDown('Space',false); c.keyUp('Space');
            check(c.game.state === 'playing', `${name}: did not enter gameplay`);
            const before = fingerprint(c);
            for (let i=0; i<90; i++) { c.update(1/60,a.camera,{intersectsSphere:()=>true}); c.renderFrame(a.renderer); }
            const after = fingerprint(c);
            check(after.lit > 50 && before.hash !== after.hash, `${name}: gameplay screen frozen`);
            a.composer.render();
            c.setActive(false);
            return { game:name, startup:'painted', visibility:'resumed', gameplay:'animated' };
        });
    });
    assert.equal(results.length, 5);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify(results, null, 2));
} finally {
    await browser.close();
}
