// QA helper: the Atrium from the spawn, looking round (8 directions), on a portrait phone and a desktop. Run: node tests/lobby-look.mjs
import { startServer, startVite, stopAll, launch, open, shot, sleep, qa, TEST_PORT } from './lib.mjs';
await startServer(TEST_PORT, { QA: '1', NO_BOTS: '1' });
await startVite();
const b = await launch();
const sizes = process.env.SIZES === 'desk' ? [['desk', 1280, 720]] : [['port', 390, 844], ['desk', 1280, 720]];
try {
    for (const [name, w, h] of sizes) {
        const page = await open(b, 'http://localhost:5719/', { w, h, dpr: name === 'port' ? 2 : 1, touch: name === 'port', q: name === 'port' ? 'low' : 'medium', uid: 'lobby' + name + Date.now() });
        await qa(page, () => { window.__qa.close(); window.__noFloat = true; });
        await sleep(1500);
        for (let i = 0; i < 8; i++) {
            await qa(page, (a) => { const q = window.__qa; q.close(); q.teleport(0, 0, 100, 0); q.look(a.yaw, 0.12, 12); }, { yaw: i * Math.PI / 4 });
            await sleep(700);
            console.log(await shot(page, 'lobby-' + name + '-' + i));
        }
        console.log('errors', page.errors);
        await page.close();
    }
} catch (e) { console.error(e); }
await b.close(); stopAll();
process.exit(0);
