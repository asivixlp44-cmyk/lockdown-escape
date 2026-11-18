// QA helper: the start line of a race on each map: the camera looking back at the purge gas, then forward at the gun.
// Run: node tests/race-look.mjs [map]   (screenshots in OUT_DIR)
import { startServer, startVite, stopAll, launch, open, shot, sleep, qa, TEST_PORT } from './lib.mjs';
await startServer(TEST_PORT, { QA: '1', NO_BOTS: '1' });
await startVite();
const b = await launch();
const maps = process.argv[2] !== undefined ? [+process.argv[2]] : [0, 1, 2, 3];
try {
    const page = await open(b, 'http://localhost:5719/', { w: 1280, h: 720, q: 'medium', uid: 'racelook' + Date.now() });
    for (const w of maps) {
        await qa(page, () => { window.__qa.close(); });
        await qa(page, (a) => window.__qa.play({ map: a.w, lv: 10, now: true }), { w });
        for (let i = 0; i < 40; i++) { const m = await qa(page, () => window.__qa.state().match); if (m && m.phase === 'wait') break; await sleep(250); }
        await sleep(2500);
        console.log(await shot(page, 'racelook' + w + '-back'));
        for (let i = 0; i < 60; i++) { const m = await qa(page, () => window.__qa.state().match); if (m && m.phase === 'play') break; await sleep(200); }
        await sleep(300);
        console.log(await shot(page, 'racelook' + w + '-go'));
        await qa(page, () => window.__qa.send('quit', {}));
        await sleep(3000);
    }
    console.log('errors', page.errors);
} catch (e) { console.error(e); }
await b.close(); stopAll();
process.exit(0);
