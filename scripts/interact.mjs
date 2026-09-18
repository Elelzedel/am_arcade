// Drives the diorama with real mouse input and screenshots each step.
//   node scripts/interact.mjs <out-prefix>
import puppeteer from 'puppeteer-core';
const prefix = process.argv[2] || '/tmp/it';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--use-angle=vulkan', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan', '--autoplay-policy=no-user-gesture-required'], defaultViewport: { width: 1440, height: 900 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[page exception]', e.message));
page.on('console', (m) => { if (['error', 'warn'].includes(m.type()) && !m.text().includes('KHR')) console.log(`[${m.type()}]`, m.text()); });
await page.goto('http://localhost:8080/?skip', { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 4000));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => { await page.screenshot({ path: `${prefix}-${name}.png` }); console.log(`[shot] ${name}`); };
// screen position of a world point
const at = (expr) => page.evaluate((expr) => {
    const v = eval(expr).clone().project(window.arcade.stage.camera);
    return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight];
}, expr);
const state = () => page.evaluate(() => ({ state: arcade.state, hovered: arcade.interaction.hovered?.id || null }));

const targets = {
    cabinet: "arcade.cabinets[2].focusPoint()",
    cat: "arcade.counter.cat.root.getWorldPosition(new (arcade.rig.target.constructor)())",
    jukebox: "arcade.scene.getObjectByName('jukebox').getWorldPosition(new (arcade.rig.target.constructor)()).add(new (arcade.rig.target.constructor)(0,1,0))",
    vending: "arcade.vending.root.getWorldPosition(new (arcade.rig.target.constructor)()).add(new (arcade.rig.target.constructor)(0,1,0))",
    rocket: "arcade.rocket.root.getWorldPosition(new (arcade.rig.target.constructor)()).add(new (arcade.rig.target.constructor)(0,0.8,0))",
    trash: "arcade.trash.root.getWorldPosition(new (arcade.rig.target.constructor)()).add(new (arcade.rig.target.constructor)(0,0.5,0))",
};
for (const [name, expr] of Object.entries(targets)) {
    const [x, y] = await at(expr);
    await page.mouse.move(x, y, { steps: 6 });
    await wait(350);
    console.log(name, JSON.stringify(await state()), Math.round(x), Math.round(y));
    if (name === 'cabinet') { await shot('hover-cabinet'); continue; }
    await page.mouse.click(x, y);
    await wait(900);
    await shot(`click-${name}`);
}
// orbit drag and zoom
await page.mouse.move(700, 450);
await page.mouse.down();
await page.mouse.move(400, 380, { steps: 20 });
await page.mouse.up();
await page.mouse.wheel({ deltaY: -600 });
await wait(1500);
await shot('dragged');
console.log('after drag', JSON.stringify(await state()));
// play the racer via click
await page.mouse.move(10, 10);
await page.evaluate(() => { arcade.rig.goal.az = arcade.rig.home.az; arcade.rig.goal.el = arcade.rig.home.el; arcade.rig.goal.dist = arcade.rig.home.dist; });
await wait(1500);
const [cx, cy] = await at(targets.cabinet);
await page.mouse.move(cx, cy, { steps: 4 });
await wait(200);
await page.mouse.click(cx, cy);
await wait(2400);
console.log('after click cabinet', JSON.stringify(await state()));
await page.keyboard.press('Space');
await wait(600);
await page.keyboard.down('ArrowLeft');
await wait(700);
await shot('playing');
await page.keyboard.up('ArrowLeft');
await page.keyboard.press('Escape');
await wait(2000);
console.log('after esc', JSON.stringify(await state()));
await shot('returned');
await browser.close();
