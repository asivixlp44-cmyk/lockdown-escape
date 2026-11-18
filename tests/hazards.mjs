// The hazards bite: standing still in a Stretcher Chase, the Stretcher has you; standing still on the flicker keys, the
// wave takes the key from under you; an Eyeball Hill is a climb (you end the stage higher than you started) and its eyeball flattens
// you; the floor follows the climb (no falling through a ramp). Run: node tests/hazards.mjs
import { startServer, startVite, stopAll, launch, open, shot, sleep, qa, TEST_PORT } from './lib.mjs';
import { stagePlan, wallZ, floorY } from '../shared/world.js';
await startServer(TEST_PORT, { QA: '1', NO_BOTS: '1' });
await startVite();
const b = await launch();
let bad = 0;
const check = (c, what) => { console.log((c ? '  ok  ' : 'FAIL  ') + what); if (!c) bad++; };
const kOf = (type) => { for (let k = 0; k < 15; k++) if (stagePlan(0, k).type === type) return k; return -1; };
try {
    const page = await open(b, 'http://localhost:5719/', { w: 1280, h: 720, q: 'medium', uid: 'haz' + Date.now() });
    const died = () => qa(page, () => window.__qa.state().dead || window.__qa.state().reviveOpen || false);
    const deaths = () => qa(page, () => window.__qa.P.deaths || 0);
    // knocked out: the death card stays up until a button is pressed (once Boxity's countdown is over): BACK TO THE ATRIUM
    const back = async () => { await page.waitForFunction(() => !document.querySelector('#revive').classList.contains('wait'), { timeout: 8000 }).catch(() => {}); await qa(page, () => { if (window.__qa.P.dead) window.__qa.actions.giveUp(); }); await sleep(600); };
    const into = async (k, dz, lv) => {
        await qa(page, (a) => { const q = window.__qa; q.close(); q.give({ lv: a.lv, reviveAt: 0 }); q.teleport(0, 0, q.wallZ(a.k) - a.dz, Math.PI); }, { k, dz, lv });
        await sleep(400);
    };
    // the Scorpion: through its arch, then stand still
    const kc = kOf('chase');
    const d0 = await deaths();
    await into(kc, 3, 10);
    let caught = false;
    for (let i = 0; i < 40 && !caught; i++) { await sleep(200); caught = (await deaths()) > d0; if (i === 8) console.log('  ', await shot(page, 'haz-chase')); }
    check(caught, 'Stretcher Chase (stage ' + (kc + 1) + '): standing still, the Stretcher has you');
    await back(); await sleep(3800);
    // the vanishing keys: on the first row, stand still
    const kb = kOf('blink'), ob = stagePlan(0, kb).list.find((o) => o.kind === 'blink');
    const d1 = await deaths();
    await qa(page, (a) => { const q = window.__qa; q.close(); q.give({ lv: 30, reviveAt: 0 }); q.teleport(a.x, 0, a.z, Math.PI); }, { x: ob.rows[2].x, z: ob.rows[2].z });
    let sank = false;
    for (let i = 0; i < Math.ceil((ob.period + 1.5) / 0.2) && !sank; i++) { await sleep(200); sank = (await deaths()) > d1; }
    check(sank, 'Flicker Keys (stage ' + (kb + 1) + '): standing still, the wave takes the key from under you (period ' + ob.period + ' s)');
    await back(); await sleep(3800);
    // Boulder Hill: run up it at a high Level: higher at the far end; then stand in a boulder's lane
    const kh = kOf('boulders');
    await into(kh, 3, 40);
    const y0 = await qa(page, () => window.__qa.P.b.y);
    await qa(page, () => { const q = window.__qa; q.auto(true); });
    await back(); await sleep(3800);
    const st = await qa(page, () => ({ y: window.__qa.P.b.y, z: window.__qa.P.b.z, ground: window.__qa.P.b.onGround }));
    await qa(page, () => window.__qa.auto(false));
    console.log('  ', await shot(page, 'haz-hill'));
    check(st.y > y0 + 20 && st.y > floorY(0, st.z) - 0.3 && (st.ground ? st.y - floorY(0, st.z) < 1.5 : true), 'Eyeball Hill (stage ' + (kh + 1) + '): a climb, ' + y0.toFixed(1) + ' -> ' + st.y.toFixed(1) + ' studs up, never under the floor (' + floorY(0, st.z).toFixed(1) + ')');
    await back(); await sleep(3800);
    const d2 = await deaths(), ohl = stagePlan(0, kh).list.find((o) => o.kind === 'boulders');
    await qa(page, (a) => { const q = window.__qa; q.close(); q.give({ lv: 10, reviveAt: 0 }); q.teleport(a.x, 0, a.z, Math.PI); }, { x: ohl.lanes[0], z: (ohl.z0 + ohl.z1) / 2 });
    let flat = false;
    for (let i = 0; i < 100 && !flat; i++) { await sleep(200); flat = (await deaths()) > d2; }
    check(flat, 'Eyeball Hill: standing in a lane, a rolling eyeball flattens you');
    check(page.errors.length === 0, 'no console errors ' + JSON.stringify(page.errors));
} catch (e) { console.error(e); bad++; }
console.log(bad ? bad + ' FAILED' : 'all good');
await b.close(); stopAll();
process.exit(bad ? 1 : 0);
