// QA helper: a quick smoke run: the page loads and joins, both songs render into loops (levels, no NaNs), a few steps count
// +5 Speed each (the X5 event), the Speed pack and SKIP answer, no console errors. Run: node tests/smoke.mjs
import { startServer, startVite, stopAll, launch, open, shot, sleep, qa, TEST_PORT } from './lib.mjs';
await startServer(TEST_PORT, { QA: '1', NO_BOTS: '1' });
await startVite();
const b = await launch();
let bad = 0;
const check = (c, what) => { console.log((c ? '  ok  ' : 'FAIL  ') + what); if (!c) bad++; };
try {
    const page = await open(b, 'http://localhost:5719/', { w: 1280, h: 720, q: 'medium', uid: 'smoke' + Date.now() });
    check(page.loadSecs > 0, 'joined a server in ' + page.loadSecs + ' s');
    await qa(page, () => { const q = window.__qa; q.close(); });
    // the songs: wait for the loops to render, then read the music's level
    await sleep(6000);
    const au = await qa(page, () => window.__qa.audio());
    check(au && au.loops !== undefined, 'music loops: ' + JSON.stringify(au && au.loops));
    const sp0 = await qa(page, () => window.__qa.S.speed);
    await qa(page, () => { const q = window.__qa; q.teleport(0, 0, 60, Math.PI); q.key('KeyW', true); });
    await sleep(2500);
    await qa(page, () => window.__qa.key('KeyW', false));
    await sleep(800);
    const st = await qa(page, () => ({ speed: window.__qa.S.speed, steps: window.__qa.S.steps }));
    check(st.steps > 0 && Math.abs((st.speed - sp0) - st.steps * 5) < 1e-6, st.steps + ' steps, +' + (st.speed - sp0) + ' Speed (x5 a step)');
    await qa(page, () => window.__qa.give({ gems: 100 }));
    await sleep(500);
    const g0 = await qa(page, () => window.__qa.S.gems);
    await qa(page, () => window.__qa.send('spack', { i: 0 }));
    await sleep(800);
    const g1 = await qa(page, () => window.__qa.S.gems);
    check(g1 <= g0 - 5 + 4 && g1 < g0, 'a Speed pack (a quest may pay a little at the same time): ' + g0 + ' -> ' + g1 + ' Gems');
    await qa(page, () => { const q = window.__qa; q.close(); q.teleport(0, 0, q.wallZ(0) - 8, Math.PI); });
    await sleep(1200);
    await qa(page, () => window.__qa.send('skip', {}));
    await sleep(1500);
    const z = await qa(page, () => ({ z: window.__qa.P.b.z, cp: window.__qa.wallZ(1) - 6, gems: window.__qa.S.gems }));
    check(Math.abs(z.z - z.cp) < 3 && z.gems === g1 - 8, 'SKIP: in Stage 2 (z ' + z.z.toFixed(1) + ', checkpoint ' + z.cp + '), ' + z.gems + ' Gems');
    console.log('shot', await shot(page, 'smoke-stage2'));
    // knocked out: Boxity's death screen (its countdown is 0 outside Boxity) and our card; REVIVE puts you back in the stage
    await qa(page, () => window.__qa.die(1, 'monster'));
    await sleep(900);
    const d1 = await qa(page, () => ({ open: !document.querySelector('#revive').hidden, dead: window.__qa.P.dead, why: document.querySelector('#dcWhy').textContent, stage: document.querySelector('#dcStage').textContent, wait: document.querySelector('#revive').classList.contains('wait') }));
    check(d1.open && d1.dead && /Stretcher/.test(d1.why) && /STAGE 2/.test(d1.stage), 'knocked out: the death card (' + d1.why + ' · ' + d1.stage + ')');
    console.log('shot', await shot(page, 'smoke-death'));
    // (Boxity's countdown first: the buttons wait for it)
    await qa(page, () => new Promise((r) => { const t0 = performance.now(); (function w() { if (!document.querySelector('#revive').classList.contains('wait') || performance.now() - t0 > 8000) r(); else setTimeout(w, 100); })(); }));
    await qa(page, () => window.__qa.actions.revive());
    await sleep(1800);
    const d2 = await qa(page, () => ({ open: !document.querySelector('#revive').hidden, dead: window.__qa.P.dead, z: window.__qa.P.b.z, cp: window.__qa.wallZ(1) - 6 }));
    check(!d2.open && !d2.dead && Math.abs(d2.z - d2.cp) < 3, 'REVIVE: back in Stage 2 (z ' + d2.z.toFixed(1) + ')');
    await sleep(3500);
    await qa(page, () => window.__qa.die(1, 'pit'));
    await sleep(900);
    await qa(page, () => new Promise((r) => { const t0 = performance.now(); (function w() { if (!document.querySelector('#revive').classList.contains('wait') || performance.now() - t0 > 8000) r(); else setTimeout(w, 100); })(); }));
    await qa(page, () => window.__qa.actions.giveUp());
    await sleep(1200);
    const d3 = await qa(page, () => ({ open: !document.querySelector('#revive').hidden, dead: window.__qa.P.dead, z: window.__qa.P.b.z, spawn: window.__qa.spawnZ }));
    check(!d3.open && !d3.dead && d3.z > 60, 'BACK TO THE ATRIUM: at the spawn (z ' + d3.z.toFixed(1) + ')');
    // a revive the server never answers (its offer gone: here the server's QA teleport wipes it behind the screen's back): asked again
    // once, then back to the Atrium; the card never waits for ever
    await sleep(3500);
    await qa(page, () => { const q = window.__qa; q.close(); q.teleport(0, 0, q.wallZ(1) - 10, Math.PI); });
    await sleep(1200);
    await qa(page, () => window.__qa.die(1, 'pit'));
    await sleep(900);
    await qa(page, () => window.__qa.send('qa', { tp: [0, 0, 100] }));
    await sleep(400);
    await qa(page, () => window.__qa.actions.revive());
    await sleep(2000);
    const w1 = await qa(page, () => ({ open: !document.querySelector('#revive').hidden, busy: document.querySelector('#revive').classList.contains('busy') }));
    await sleep(10000);
    const w2 = await qa(page, () => ({ open: !document.querySelector('#revive').hidden, dead: window.__qa.P.dead, z: window.__qa.P.b.z }));
    check(w1.open && w1.busy && !w2.open && !w2.dead && w2.z > 60, 'a revive nobody answers: "Reviving…", then back to the Atrium (z ' + w2.z.toFixed(1) + ')');
    check(page.errors.length === 0, 'no console errors ' + JSON.stringify(page.errors));

    // ----- with a stand-in Boxity SDK whose death screen counts down 4..0 (as on Boxity, ads round the edges meanwhile) -----
    const STUB = `window.__log = []; const L = (x) => window.__log.push(x);
    window.Legion = { SDK: {
        init(o) { L('init:' + o.gameSlug); },
        environment() { return { env: 'prod', apiUrl: 'https://api.bloxity.io', playUrl: 'https://play.bloxity.io', portalUrl: 'https://bloxity.io', staticUrl: 'https://static.bloxity.io' }; },
        portal: { isEmbeddedInLegion() { return false; } },
        game: { loadingStep() {}, loadingEnd() { L('loadingEnd'); }, updateRoom() {}, registerFeature(f) { L('feature:' + f); }, gameplayStart() {}, gameplayEnd() {} },
        ads: { onBreakStart(cb) { window.__brk = cb; }, onBreakEnd(cb) { window.__brkEnd = cb; }, declareScreens(o) { L('screens:' + Object.keys(o).join(',') + (o.gameplay && o.gameplay.show ? ':gameplayAds' : '')); },
            screen(t) { L('screen:' + t); return { state: 'closed', onStateChange() {}, hide() {} }; }, hideScreen() {}, isAvailable() { return true; }, showRewarded() { return Promise.resolve({ status: 'skipped' }); } },
        leaderboard: { define(b) { L('boards:' + b.map((x) => x.id).join(',')); }, open() { return false; } },
        deathScreen: { show() { L('death'); let n = 4; const cbs = []; const t = setInterval(() => { n--; cbs.forEach((c) => c(n)); if (n <= 0) clearInterval(t); }, 350);
            return { onCountdown(cb) { cbs.push(cb); cb(n); return () => {}; }, respawn() { if (n > 0) { L('respawn:refused'); return false; } L('respawn:ok'); return true; }, ready: null }; }, hide() { L('deathHide'); } },
        auth: { onUserChanged(cb) { cb(null); }, getToken() { return null; } },
        settings: { listen() {}, triggerAll() {} }, player: { onEvent() {} }, avatar: {}, chat: {},
    } };`;
    const sp = await open(b, 'http://localhost:5719/', { w: 1280, h: 720, q: 'low', uid: 'smokesdk' + Date.now(), sdkStub: STUB });
    await sleep(1500);
    const lg0 = await sp.evaluate(() => window.__log.slice());
    check(lg0.includes('init:lockdown-escape') && lg0.includes('feature:emotes') && lg0.includes('boards:wins,speed,stage,races'), 'init with the slug, emotes registered, the four boards declared');
    check(lg0.includes('screens:panel,lobby,results,gameplay') && lg0.includes('screen:gameplay') && lg0.filter((x) => x === 'loadingEnd').length === 1, 'screens declared (no banners in play), gameplay reported, loadingEnd once');
    await qa(sp, () => { const q = window.__qa; q.close(); q.teleport(0, 0, q.wallZ(1) - 10, Math.PI); });
    await sleep(1200);
    await qa(sp, () => window.__qa.die(1, 'laser'));
    await sleep(250);
    await qa(sp, () => window.__qa.actions.revive());
    await qa(sp, () => window.__qa.actions.giveUp());
    await sleep(400);
    const e1 = await qa(sp, () => ({ open: !document.querySelector('#revive').hidden, wait: document.querySelector('#revive').classList.contains('wait'), n: document.querySelector('#dcN').textContent, log: window.__log.slice() }));
    check(e1.open && e1.wait && e1.log.includes('death') && !e1.log.some((x) => /^respawn/.test(x)), 'knocked out: Boxity\'s death screen, the buttons wait for its countdown (' + e1.n + '), pressing early does nothing');
    await sp.waitForFunction(() => !document.querySelector('#revive').classList.contains('wait'), { timeout: 6000 }).catch(() => {});
    await qa(sp, () => window.__qa.actions.revive());
    await sleep(1600);
    const e2 = await qa(sp, () => ({ open: !document.querySelector('#revive').hidden, dead: window.__qa.P.dead, log: window.__log.slice() }));
    check(!e2.open && !e2.dead && e2.log.includes('respawn:ok') && !e2.log.includes('respawn:refused'), 'after the countdown REVIVE respawns, only on respawn() === true');
    // an ad break: the frames stop and the sound goes, then both come back
    const f0 = await qa(sp, () => { window.__brk(); return window.__qa.perf(true).frames; });
    await sleep(700);
    const f1 = await qa(sp, () => window.__qa.perf().frames);
    await qa(sp, () => window.__brkEnd());
    await sleep(700);
    const f2 = await qa(sp, () => window.__qa.perf().frames);
    check(f1 <= 1 && f2 > 5, 'an ad break pauses the game (' + f1 + ' frames) and it carries on after (' + f2 + ')');
    check(sp.errors.length === 0, 'no console errors with the stand-in SDK ' + JSON.stringify(sp.errors));
} catch (e) { console.error(e); bad++; }
console.log(bad ? bad + ' FAILED' : 'all good');
await b.close(); stopAll();
process.exit(bad ? 1 : 0);
