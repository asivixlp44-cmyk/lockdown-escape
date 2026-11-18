// QA helper: a Scorpion Chase on the autopilot, a screenshot every half second (the burst, the chase camera, the end), and how far
// behind the Scorpion stays. Run: node tests/chase-look.mjs [world] [portrait]
import { startServer, startVite, stopAll, launch, open, shot, sleep, qa, TEST_PORT } from './lib.mjs';
import { stagePlan } from '../shared/world.js';
import { recLevel } from '../shared/config.js';
await startServer(TEST_PORT, { QA: '1', NO_BOTS: '1' });
await startVite();
const b = await launch();
const w = +(process.argv[2] || 0), portrait = process.argv[3] === 'portrait';
let k = 0;
for (let i = 0; i < 15; i++) if (stagePlan(w, i).type === 'chase') { k = i; break; }
try {
    const page = await open(b, 'http://localhost:5719/', portrait ? { w: 390, h: 844, dpr: 2, touch: true, q: 'low', uid: 'cl' + Date.now() } : { w: 1280, h: 720, q: 'medium', uid: 'cl' + Date.now() });
    await qa(page, (a) => { const q = window.__qa; q.close(); q.give({ lv: a.lv, best: 15, world: a.w, reviveAt: 0 }); }, { lv: recLevel(w, k), w });
    await sleep(2500);
    await qa(page, (a) => { const q = window.__qa; q.close(); q.teleport(0, 0, q.wallZ(a.k) + 10, Math.PI); q.auto(true); }, { k });
    for (let i = 0; i < 14; i++) {
        await sleep(500);
        const st = await qa(page, () => { const q = window.__qa, c = q.chase && q.chase(); return { z: +q.P.b.z.toFixed(1), c, dead: q.state().dead }; });
        console.log(i, JSON.stringify(st), await shot(page, 'chase-' + (portrait ? 'p' : 'd') + w + '-' + i));
    }
    console.log('errors', page.errors);
} catch (e) { console.error(e); }
await b.close(); stopAll();
process.exit(0);
