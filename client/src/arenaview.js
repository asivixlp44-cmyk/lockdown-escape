// Purge Run on screen: six lanes side by side down a stretch of the Keyline, each lane railed in its racer's colour and floored with
// giant keycaps in keyboard rows, the same things in every lane (goo pits, hazard-striped barriers, chemical tanks with warning lamps,
// swinging hammers, supply crates sliding across, boost chevrons), a gate with a portal at the end. Behind the start line the purge
// gas: a towering wall of glowing pink-red gas as wide as the course, strobes flashing along its foot, beacon light sweeping through
// it, tongues of it reaching ahead along the floor, coming on faster and faster.
import { T, V3, scene } from './engine.js';
import { Kit, batchKits, rng } from './geo.js';
import { buildBlobs, releaseBlobs } from './blobs.js';
import { Signs, big, GOLD } from './signs.js';
import { CU } from './clock.js';
import {
    horizon, hullMaterial, propMaterial, decalQuads, energyQuads, decal, energyQuad, halo, decalMaterial, energyMaterial,
    flameMesh, bladeMaterial, railRun, styleOf, lookOf, floorQuad, shade, mixC, presentMesh, stack, CASE,
} from './world.js';
import { buildJelly } from './keycaps.js';
import { CFG } from '../../shared/config.js';
import { ARENA, laneX, caneAt, laneBoxAt, LANE_BOX } from '../../shared/arena.js';

const SPOTS = CFG.matchSpots;
// a swinging hammer over a lane: its pivot's height and the boom down to its head (the head's x is caneAt * ARENA.hw from the lane's middle)
export const LANE_BLADE = { pivot: 10.6, arm: 8.6 };
// a boost pad's half size (x across, z along), round its x in the lane
export const LANE_BOOST = { hw: 3, hd: 3.2 };
// the sliding supply crates' colours and their bands
const POD_C = [[0x8a94a4, 0xffc21a], [0xff7a1a, 0x22222c], [0x2ab8b0, 0xffffff], [0xe8e4dc, 0xff3a2a], [0x6a5ad8, 0xffc21a], [0xffc21a, 0x22222c]];
// steel, its dark, the hazard stripes' two colours
const STEEL = 0x8c96a6, STEEL_DK = 0x3a404c, HZ_Y = 0xffc21a, HZ_K = 0x1c1c24;
// a band of hazard stripes on one face of a Kit (the face at z, facing +z when s is 1, -z when -1): yellow slanted bars on black
function stripeBand(k, s, z, x0, x1, y0, y1, n) {
    const want = [0, 0, s], zb = z + s * 0.05, zs = z + s * 0.1, pitch = (x1 - x0) / n, sw = pitch / 2, sl = (y1 - y0) * 0.85, cl = (x) => Math.max(x0, Math.min(x1, x));
    k.faceTo([x0, y0, zb], [x1, y0, zb], [x1, y1, zb], [x0, y1, zb], want, HZ_K);
    for (let i = -2; i <= n; i++) {
        const a = x0 + i * pitch, q = [cl(a), cl(a + sw), cl(a + sw + sl), cl(a + sl)];
        if (q[1] - q[0] < 0.02 && q[2] - q[3] < 0.02) continue;
        k.faceTo([q[0], y0, zs], [q[1], y0, zs], [q[2], y1, zs], [q[3], y1, zs], want, HZ_Y);
    }
}
// A swinging hammer: a steel arm from its pivot (local 0, 0, 0) down to a heavy hammer head swinging across x: a dark steel block banded
// in hazard stripes, rubber pads on the faces it swings into, a red lamp on top, yellow rivets down the arm
function hammerGeo(Wd, armLen, scale) {
    const k = new Kit({ glow: true }), L = armLen, s = scale || 1;
    k.box(0, -0.4, 0, 1.8 * s, 1.4 * s, 1.8 * s, STEEL_DK, { soft: true });
    const rl = L - 2.6 * s, segs = Math.max(4, Math.round(rl / 2.4)), sl = rl / segs;
    for (let i = 0; i < segs; i++) {
        const y = -1.1 - (i + 0.5) * sl, w = (i % 2 ? 0.5 : 0.72) * s;
        k.box(0, y, 0, w, sl + 0.04, w, i % 2 ? STEEL_DK : STEEL);
        if (i % 2 === 0) for (const sz of [1, -1]) k.box(0, y, sz * (w / 2 + 0.03), 0.22 * s, 0.22 * s, 0.06, HZ_Y, { glow: 1 });
    }
    k.box(0, -L, 0, 3.4 * s, 2.5 * s, 1.9 * s, 0x4a505c, { soft: true });
    for (let i = 0; i < 6; i++) k.box(-1.45 * s + i * 0.58 * s, -L, 0, 0.58 * s, 2.56 * s, 1.96 * s, i % 2 ? HZ_K : HZ_Y);
    for (const sx of [-1, 1]) k.box(sx * 1.95 * s, -L, 0, 0.5 * s, 2.2 * s, 1.7 * s, 0x22262e, { soft: true });
    k.box(0, -L + 1.45 * s, 0, 0.7 * s, 0.5 * s, 0.7 * s, 0xff2a1a, { glow: 1 });
    return k.geometry();
}
// The purge gas: a towering wall of glowing gas the width of the course, all in its shader (unlit): billows rolling up it, bright along
// their crowns, dense and dark at its foot where it eats the keys, the whole wall pulsing with the alarm, beacon light sweeping through
// it, sparks whirling in it, a row of strobes flashing along its foot, tongues of gas reaching out ahead along the floor. The gas goes
// on behind it.
const STORM = {
    hazard: { uDeep: 0x5a0a22, uMid: 0xd8204a, uLight: 0xff6a90, uSun: 0xffe0ea, uDebris: 0xffd23a },
    biolab: { uDeep: 0x4a0a3a, uMid: 0xc8208a, uLight: 0xff70c8, uSun: 0xffe8f8, uDebris: 0x7affd8 },
    cryo: { uDeep: 0x5a0a2a, uMid: 0xe02a5a, uLight: 0xff8aa8, uSun: 0xfff0f4, uDebris: 0x9af0ff },
    void: { uDeep: 0x2a0a3a, uMid: 0xb81a7a, uLight: 0xff5ac8, uSun: 0xffd8f0, uDebris: 0x7af0ff },
};
function surgeMesh(Wd, width, low) {
    const g = new T.PlaneGeometry(width, 54, low ? 28 : 40, low ? 12 : 16).translate(0, 27, 0).rotateY(Math.PI);
    const C = STORM[Wd.id] || STORM.hazard, uniforms = { uNow: CU.uNow, uW: { value: width } };
    for (const k in C) uniforms[k] = { value: new T.Color(C[k]) };
    const front = new T.Mesh(g, new T.ShaderMaterial({
        uniforms,
        vertexShader: `uniform float uNow; varying vec2 vP; varying float vReach;
            void main() {
                vec3 p = position; float t = uNow;
                float n = sin(p.x * 0.17 + t * 1.3) * sin(p.y * 0.13 - t * 1.6) + 0.6 * sin(p.x * 0.05 - t * 0.7 + p.y * 0.06);
                // tongues of gas reaching ahead low down, the billows at the top curling over toward you
                float low = 1.0 - smoothstep(0.0, 9.0, p.y);
                float reach = max(0.0, sin(p.x * 0.23 + sin(p.x * 0.09 + t * 1.2) * 2.0 + t * 2.4)) * low * 7.0 + smoothstep(28.0, 54.0, p.y) * 9.0 + n * 2.4;
                p.z -= reach;
                vReach = reach; vP = p.xy;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
            }`,
        fragmentShader: `uniform float uNow; uniform float uW; uniform vec3 uDeep, uMid, uLight, uSun, uDebris; varying vec2 vP; varying float vReach;
            float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
            void main() {
                float t = uNow; vec2 P = vP;
                // its billowing top
                float top = 47.0 + 4.0 * sin(P.x * 0.12 + t * 0.7) + 2.5 * sin(P.x * 0.33 - t * 1.3);
                if (P.y > top) discard;
                // billows rolling up it, big and small
                float b1 = sin(P.x * 0.19 + t * 1.1 + sin(P.y * 0.13 - t * 0.8) * 2.0) * sin(P.y * 0.22 - t * 1.9 + sin(P.x * 0.07) * 1.5);
                float b2 = sin(P.x * 0.47 - t * 2.3 + P.y * 0.11) * sin(P.y * 0.53 + t * 2.9 - P.x * 0.09);
                float bill = b1 * 0.65 + b2 * 0.35, hgt = clamp(P.y / top, 0.0, 1.0);
                // round billows on a grid rolling upward, each a dome lit from above (the crevices between them dark)
                vec2 pp = vec2(P.x * 0.105, P.y * 0.115 - t * 0.38), pc = floor(pp), pf = fract(pp) - 0.5;
                float puff = 0.0;
                #ifdef LOW
                { float h = hash(pc); vec2 d = pf - (vec2(h, fract(h * 7.1)) - 0.5) * 0.4; float r = 0.62; float k = 1.0 - length(d) / r; puff = k > 0.0 ? sqrt(k) * (0.55 + 0.45 * d.y / r) : 0.0; }
                #else
                for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
                    vec2 o = vec2(float(i), float(j)); float h = hash(pc + o);
                    vec2 d = pf - o - (vec2(h, fract(h * 7.1)) - 0.5) * 0.7; float r = 0.58 + 0.36 * fract(h * 3.3);
                    float k = 1.0 - length(d) / r;
                    if (k > 0.0) puff = max(puff, sqrt(k) * (0.55 + 0.45 * d.y / r));
                }
                #endif
                float sh = clamp(puff * 0.85 + bill * 0.18, 0.0, 1.0);
                vec3 c = mix(uDeep, uMid, smoothstep(0.05, 0.6, sh));
                c = mix(c, uLight, smoothstep(0.5, 0.95, sh) * (0.45 + 0.55 * hgt));
                // the crowns glowing
                float edgeTop = smoothstep(top - 7.0, top - 0.5, P.y);
                c = mix(c, uSun, edgeTop * (0.45 + 0.55 * smoothstep(-0.2, 0.8, b1)));
                // dense and dark at its foot
                c = mix(c, uDeep * 0.8, (1.0 - smoothstep(0.0, 6.0, P.y)) * 0.5);
                // the alarm: the whole wall pulsing, beacon light sweeping through it in great slanting beams
                float pulse = 0.5 + 0.5 * sin(t * 6.0);
                c *= 0.86 + 0.24 * pulse;
                float beam = smoothstep(0.8, 1.0, sin(P.x * 0.07 - P.y * 0.045 + t * 2.6)) + smoothstep(0.86, 1.0, sin(-P.x * 0.05 - P.y * 0.06 + t * 1.9 + 2.0));
                c = mix(c, uSun, clamp(beam, 0.0, 1.0) * 0.32 * (0.4 + 0.6 * hgt));
                // streaks, and sparks whirling in it
                float streak = smoothstep(0.92, 1.0, sin(P.y * 1.3 + P.x * 0.05 - t * 6.0 + sin(P.x * 0.2) * 3.0));
                c = mix(c, uLight * 1.1, streak * 0.12 * step(0.5, hash(floor(vec2(P.x * 0.08, P.y * 0.6)))));
                vec2 ec = vec2(P.x * 0.35 + t * 3.0, P.y * 0.35 - t * 2.0 + sin(P.x * 0.1 + t) * 2.0), ci = floor(ec);
                float eh = hash(ci); vec2 ef = fract(ec) - 0.5;
                c = mix(c, uDebris * 1.3, step(0.95, eh) * (1.0 - smoothstep(0.05, 0.16, length(ef))));
                // the strobes along its foot, flashing in turn (red and white), a line of light on the floor under them
                vec2 sc = vec2(fract(P.x / 9.0) - 0.5, (P.y - 2.0) / 9.0) * 9.0;
                float lamp = 1.0 - smoothstep(0.55, 1.15, length(sc)), on = step(0.25, sin(t * 9.0 + floor(P.x / 9.0) * 2.1));
                c = mix(c, mod(floor(P.x / 9.0), 2.0) < 0.5 ? vec3(1.0, 0.25, 0.2) : vec3(1.0), lamp * on);
                c = mix(c, uSun, (1.0 - smoothstep(0.0, 0.6, P.y)) * 0.8);
                // the tongues running out ahead along the floor
                c = mix(c, uLight, smoothstep(3.0, 6.0, vReach) * (1.0 - smoothstep(0.0, 8.0, P.y)) * 0.4);
                float a = 0.97 - 0.35 * smoothstep(top - 6.0, top, P.y) * (1.0 - edgeTop);
                // seen from inside (it has the camera, at the start line on a tall screen): a thin veil of gas, not a wall
                gl_FragColor = gl_FrontFacing ? vec4(c, a) : vec4(c, 0.25);
                #include <colorspace_fragment>
            }`,
        defines: low ? { LOW: 1 } : {},
        transparent: true, depthWrite: false, side: T.DoubleSide,
    }));
    front.renderOrder = 4;
    const bodyG = new T.BoxGeometry(width, 44, 160).translate(0, 22, 88);
    const body = new T.Mesh(bodyG, new T.MeshBasicMaterial({ color: C.uDeep, fog: false }));
    const grp = new T.Group();
    grp.add(front, body);
    grp.userData.parts = [front, body];
    return grp;
}

export function buildArena(plan, w, spotsCol, low, mySpot) {
    const Wd = lookOf(w), st = styleOf(Wd), R = rng(w * 53 + 3), group = new T.Group(), signs = new Signs(4, 448, 152), one = () => 0.5;
    const fl = [], lights = [], D = decalQuads(), E = energyQuads(), ctx = { Wd, st, R, low, fl, lights, D };
    const S0 = new Kit(), P0 = new Kit({ glow: true }), kits = [S0], propKits = [P0];
    const L2 = ARENA.laneW / 2, hwAll = SPOTS * L2, XA = hwAll + 0.6, back = 36, end = plan.finish - 16;
    // stretches of the course, each its own kit (culled on its own)
    const SEG = 120, stretches = [];
    for (let z = back; z > end; z -= SEG) { const S = new Kit(), P = new Kit({ glow: true }); stretches.push({ z1: z, z0: Math.max(end, z - SEG), S, P }); kits.push(S); propKits.push(P); }
    const at = (z) => stretches.find((s) => z <= s.z1 && z >= s.z0) || stretches[stretches.length - 1];
    const pools = plan.obs.filter((o) => o.kind === 'pool');
    // the floor: each lane's keyboard plate in its racer's colour (yours brighter), showing between the keys; bands of it; the rifts
    // cut out
    {
        const cuts = new Set([end, back]);
        for (const o of pools) { cuts.add(o.z0); cuts.add(o.z1); }
        for (let z = Math.ceil(end / 12) * 12; z < back; z += 12) cuts.add(z);
        for (const s of stretches) cuts.add(s.z0);
        const zz = [...cuts].filter((z) => z >= end && z <= back).sort((a, b) => a - b);
        for (let i = 0; i < zz.length - 1; i++) {
            const a = zz[i], b = zz[i + 1], m = (a + b) / 2;
            if (pools.some((o) => m > o.z0 && m < o.z1)) continue;
            const K = at(m).S;
            for (let s = 0; s < SPOTS; s++) {
                const cx = laneX(s), c0 = mixC(shade(Wd.floor, 0.62), spotsCol[s], s === mySpot ? 0.5 : 0.3), c = Math.floor(m / 12) & 1 ? c0 : shade(c0, 0.9);
                floorQuad(K, cx - L2, cx + L2, a, b, 0.02, c);
            }
        }
    }
    // the rifts: a wall of the case at each edge, a line of light along it
    for (const o of pools) {
        const K = at((o.z0 + o.z1) / 2), d = o.z1 - o.z0;
        for (const z of [o.z0 + 0.2, o.z1 - 0.2]) K.S.box(0, -0.8, z, hwAll * 2, 1.6, 0.4, shade(Wd.rim, 0.8), { tile: 8 });
        decal(D, 0, 0, -0.3, (o.z0 + o.z1) / 2, hwAll, d / 2, Wd.hazard, Wd.hazard2, 1, 0);
        for (const z of [o.z0, o.z1]) K.P.box(0, 0.08, z, hwAll * 2, 0.16, 0.5, Wd.hazard2, { glow: 1, shade: 0.8 });
    }
    // the rails between the lanes: low walls of hull lit along the top in the colours either side of them, a post now and then
    for (let s = 1; s < SPOTS; s++) {
        const x = -hwAll + s * ARENA.laneW;
        for (const S of stretches) {
            const zm = (S.z0 + S.z1) / 2, len = S.z1 - S.z0;
            S.S.box(x, 0.6, zm, 0.8, 1.2, len, Wd.wall2, { tile: 8 });
            S.P.box(x - 0.22, 1.24, zm, 0.34, 0.1, len, spotsCol[s - 1], { glow: 1 });
            S.P.box(x + 0.22, 1.24, zm, 0.34, 0.1, len, spotsCol[s], { glow: 1 });
            for (let z = S.z1 - 12; z > S.z0 + 2; z -= low ? 48 : 24) S.S.box(x, 1.1, z, 1.1, 2.2, 1.6, Wd.wall, { tile: 8 });
        }
    }
    // the course's edges (the Keyway's own rails), the case's ends
    for (const S of stretches) for (const sx of [-1, 1]) railRun(S.S, S.P, sx, XA, S.z0, S.z1, ctx, (z) => z > back - 4);
    for (const z of [back + 1.3, end - 1.3]) S0.box(0, -CASE / 2 + 0.3, z, (XA + 2.6) * 2, CASE + 0.6, 2.6, Wd.wall2, { tile: 8 });
    // the start: a line of light across, a little gate over each lane lit inside in its racer's colour; the race's name over it all
    for (let s = 0; s < SPOTS; s++) {
        const cx = laneX(s), z = ARENA.startZ - 2.2;
        P0.box(cx, 0.08, z, ARENA.laneW - 1.4, 0.08, 0.7, 0xffffff, { glow: 1 });
        for (const sx of [-1, 1]) {
            S0.box(cx + sx * (L2 - 0.9), 4, z, 1.1, 8, 1.1, Wd.wall2, { tile: 8 });
            P0.box(cx + sx * (L2 - 1.48), 4, z, 0.08, 7.4, 0.6, spotsCol[s], { glow: 1 });
        }
        P0.box(cx, 8.3, z, ARENA.laneW - 1.0, 0.8, 1.2, spotsCol[s], { glow: 1 });
        P0.box(cx, 9.3, z, 1.1, 1.1, 0.4, Wd.trim, { glow: 1, rz: Math.PI / 4 });
        P0.box(cx, 0.06, ARENA.startZ + 4, 3, 0.06, 3, spotsCol[s], { glow: 1, ry: Math.PI / 4 });
    }
    signs.add([big('PURGE RUN', GOLD, 100, '#2a0a14'), { t: 'outrun the purge gas!', c: '#ffffff', s: '#2a0a14', px: 40 }], 26, new V3(0, 17, ARENA.startZ - 6), false, 140);
    // what's in the way, in every lane
    const blades = [], boxes = [];
    for (const o of plan.obs) {
        const K = at(o.z ?? o.z0);
        for (let s = 0; s < SPOTS; s++) {
            const cx = laneX(s);
            if (o.kind === 'hurdle') {
                // a barrier across the lane: steel, hazard stripes along both faces, a light in its racer's colour along its top
                const wd = ARENA.hw * 2 + 1, hh = o.h - 0.3;
                K.P.box(cx, hh / 2, o.z, wd, hh, o.d, STEEL_DK);
                for (const sz of [1, -1]) stripeBand(K.P, sz, o.z + sz * o.d / 2, cx - wd / 2 + 0.2, cx + wd / 2 - 0.2, 0.18, hh - 0.18, low ? 5 : 8);
                K.P.box(cx, o.h - 0.15, o.z, wd + 0.2, 0.3, o.d + 0.24, STEEL, {});
                K.P.box(cx, o.h + 0.04, o.z, wd, 0.1, o.d * 0.5, spotsCol[s], { glow: 1 });
            } else if (o.kind === 'pillars') {
                // chemical tanks to weave round: a steel drum (eight-sided), a window of glowing goo, a band of its racer's colour, a
                // warning lamp on top
                for (const p of o.list) {
                    const x = cx + p.x;
                    K.P.box(x, 0.5, p.z, 3.4, 1, 3.4, STEEL_DK);
                    for (const r of [0, Math.PI / 4]) K.P.box(x, 4.6, p.z, 2.7, 7.2, 2.7, STEEL, { ry: r });
                    for (const r of [0, Math.PI / 4]) K.P.box(x, 4.9, p.z, 2.86, 3.0, 2.86, Wd.hazard2, { ry: r, glow: 1 });
                    K.P.box(x, 2.1, p.z, 2.9, 0.7, 2.9, spotsCol[s], { ry: Math.PI / 8 });
                    K.P.box(x, 8.6, p.z, 3.4, 0.8, 3.4, STEEL_DK);
                    K.P.box(x, 9.4, p.z, 1.1, 0.9, 1.1, 0xff3a2a, { glow: 1, soft: !low });
                    if (!low) lights.push([x, 9.4, p.z, 2.4, 0xff4a3a]);
                }
            } else if (o.kind === 'blade') {
                // the hammer's gantry: a steel beam across the lane on two posts, its pivot, warning marks below
                const by = LANE_BLADE.pivot + 0.7;
                K.P.box(cx, by, o.z, ARENA.laneW, 1, 1.2, STEEL_DK, {});
                for (const bx of [-3.6, 3.6]) K.P.box(cx + bx, by, o.z, 0.5, 1.12, 1.32, HZ_Y, {});
                for (const sx of [-1, 1]) K.P.box(cx + sx * L2, by / 2, o.z, 1.2, by + 0.6, 1.6, STEEL, {});
                K.P.box(cx, by - 0.2, o.z, 1.6, 1.4, 1.6, Wd.banner, { soft: true });
                for (let x = -6; x <= 6; x += 3) K.P.box(cx + x, 0.05, o.z, 1.4, 0.04, 0.35, Wd.hazard2, { glow: 1, shade: 0.8 });
                blades.push({ o, x: cx });
            } else if (o.kind === 'slider') {
                // a supply crate sliding from rail to rail: its track, warning stripes
                const tz = LANE_BOX.d / 2 + 0.6;
                floorQuad(K.S, cx - L2, cx + L2, o.z - tz, o.z + tz, 0.05, shade(Wd.rim, 0.85));
                for (const sz2 of [-1, 1]) K.P.box(cx, 0.07, o.z + sz2 * tz, ARENA.hw * 2, 0.05, 0.35, Wd.hazard2, { glow: 1, shade: 0.85 });
                const [c1, c2] = POD_C[(boxes.length + s) % POD_C.length];
                boxes.push({ o, x: cx, c1, c2 });
            } else if (o.kind === 'boost') {
                decal(D, 1, cx + o.x, 0.09, o.z, LANE_BOOST.hw, LANE_BOOST.hd, mixC(Wd.floor, 0x000000, 0.55), mixC(spotsCol[s], 0xffffff, 0.3), 1, 0);
                K.S.box(cx + o.x, 0.04, o.z, LANE_BOOST.hw * 2 + 0.6, 0.08, LANE_BOOST.hd * 2 + 0.6, Wd.rim, { tile: 8 });
            }
        }
    }
    // the finish: a chequered band across every lane, a great warp gate over the course (two pylons banded in the sector's accent,
    // a plasma beacon on each, a lintel with lights along it), a portal of light filling it
    {
        const K = at(plan.finish), z = plan.finish, zg = z - 6, tx = hwAll + 2.6;
        for (let s = 0; s < SPOTS; s++) { const cx = laneX(s); for (let i = 0; i < 7; i++) for (let j = 0; j < 2; j++) K.P.box(cx - 6 + i * 2, 0.06, z + 1.2 - j * 2.4, 2, 0.06, 2.4, (i + j) % 2 ? 0x1a1030 : 0xffffff, { glow: (i + j) % 2 ? 0 : 1 }); }
        for (const sx of [-1, 1]) {
            const x = sx * tx;
            K.S.box(x, 10, zg, 5.2, 36, 6.4, Wd.wall, { tile: 8 });
            K.P.box(x, 17.5, zg, 5.6, 3, 6.8, Wd.banner);
            K.S.box(x, 28.4, zg, 6.2, 0.8, 7.4, Wd.wall2, { tile: 8 });
            K.P.box(x - sx * 2.66, 12, zg, 0.1, 22, 1.6, Wd.trim, { glow: 1 });
            for (let j = 0; j < 4; j++) for (const d of [-1, 1]) K.P.box(x + d * 0.7, 5 + j * 3, zg + 3.26, 1.7, 0.4, 0.1, Wd.trim, { glow: 1, rz: d * 0.62 });
            K.P.box(x, 29.5, zg, 2.2, 0.9, 2.2, STEEL_DK, {});
            K.P.box(x, 30.5, zg, 1.4, 1.2, 1.4, 0xff3a2a, { glow: 1, soft: !low });
            lights.push([x, 30.5, zg, 3.2, 0xff4a3a]);
        }
        K.S.box(0, 25, zg, hwAll * 2 + 0.4, 4, 5, Wd.wall2, { tile: 8 });
        K.P.box(0, 27.2, zg, hwAll * 2 + 1, 0.4, 5.4, Wd.moss ?? 0xffffff, { soft: !low });
        for (let x = -hwAll + 2, i = 0; x <= hwAll - 2; x += 4, i++) K.P.box(x, 27.7, zg, 0.6, 0.5, 0.6, [0xff3a2a, HZ_Y, 0xffffff, Wd.glow ?? 0x7af0ff][i % 4], { glow: 1 });
        K.P.box(0, 22.9, zg + 2.55, hwAll * 2, 0.4, 0.1, Wd.trim, { glow: 1 });
        energyQuad(E, 3, 0, 0.2, zg, hwAll * 2, 22.6, Wd.trim, Wd.glow, 1, 22.6 / (hwAll * 2));
        signs.add([big('FINISH!', GOLD, 118, '#3a1a00')], 24, new V3(0, 31, z - 4), false, 400);
    }
    const farKits = [new Kit({ glow: true }), new Kit({ glow: true })];
    horizon(Wd, farKits, rng(w * 41 + 5), back + 260, end - 200, low);
    propKits.push(...farKits);
    for (const f of fl) halo(E, f[0], f[1] + f[3] * 0.7, f[2], f[3] * 2.4, f[4], 1);
    for (const l of lights) halo(E, l[0], l[1], l[2], l[3], l[4], 0.5);
    // The keycap floor: keyboard rows down every lane, each row staggered on the one before like a real keyboard's (0, half, three
    // quarters, a quarter of a key along), a smaller key in the sector's third colour where a row leaves room at an edge; clear of
    // what's in the way, the start and the finish. Low quality: bigger keys, fewer of them
    const KP = low ? 5.2 : 4.3, kr = low ? 2.35 : 1.9, lim = ARENA.laneW / 2 - 0.55, kg = KP - 2 * kr;
    const rowsX = (low ? [0, 0.5] : [0, 0.5, 0.75, 0.25]).map((f) => {
        const out = [];
        let lo = Infinity, hi = -Infinity;
        for (let j = -3; j <= 3; j++) { const x = (f + j) * KP; if (Math.abs(x) + kr <= lim) { out.push([x, kr, 0]); lo = Math.min(lo, x - kr); hi = Math.max(hi, x + kr); } }
        for (const [a, b] of [[-lim, lo - kg], [hi + kg, lim]]) if (b - a >= 1.7) out.push([(a + b) / 2, (b - a) / 2, 1]);
        return out;
    });
    const clearAt = (x, z, r) => {
        if (z + r > ARENA.startZ - 4.5 || z - r < plan.finish + 3) return true;
        for (const o of plan.obs) {
            if (o.kind === 'pool') { if (z + r > o.z0 - 0.6 && z - r < o.z1 + 0.6) return true; }
            else if (o.kind === 'hurdle') { if (Math.abs(z - o.z) < o.d / 2 + r + 0.4) return true; }
            else if (o.kind === 'slider') { if (Math.abs(z - o.z) < LANE_BOX.d / 2 + r + 0.6) return true; }
            else if (o.kind === 'blade') { if (Math.abs(z - o.z) < r + 1.2) return true; }
            else if (o.kind === 'pillars') { for (const p of o.list) if (Math.abs(z - p.z) < 1.8 + r && Math.abs(x - p.x) < 1.8 + r) return true; }
            else if (o.kind === 'boost') { if (Math.abs(z - o.z) < LANE_BOOST.hd + r + 0.4 && Math.abs(x - o.x) < LANE_BOOST.hw + r + 0.4) return true; }
        }
        return false;
    };
    const keys = [];
    for (let s = 0; s < SPOTS; s++) {
        const cx = laneX(s);
        let row = 0;
        for (let z = ARENA.startZ - 4.6 - kr; z - kr > plan.finish + 3; z -= KP, row++) {
            for (const [x, r, edge] of rowsX[row % rowsX.length]) {
                if (clearAt(x, z, r)) continue;
                keys.push({ x: cx + x, z, r, c: edge ? Wd.keys[2] : Wd.keys[R() < 0.72 ? 0 : 1] });
            }
        }
    }
    const jelly = buildJelly(group, keys, { low });
    // (a pod's geometry is 2.04 wide and deep, 1.34 high)
    const BX_ = LANE_BOX.w / 2.04, BY_ = (LANE_BOX.h - 1) / 1.08, BZ_ = LANE_BOX.d / 2.04;
    const boxM = presentMesh(boxes.map((b) => ({ x: b.x, y: 0, z: b.o.z, sx: BX_, sy: BY_, sz: BZ_, c1: b.c1, c2: b.c2 })), low, group, false, Math.max(1, boxes.length));
    boxM.instanceMatrix.setUsage(T.DynamicDrawUsage);
    // ----- build it -----
    buildBlobs(group, () => Math.random());
    const hullMesh = batchKits(kits, hullMaterial(), true);
    if (hullMesh) group.add(hullMesh);
    const propMesh = batchKits(propKits, propMaterial(), true);
    if (propMesh) group.add(propMesh);
    const decalMat = decalMaterial(Wd, low), decalGeo = D.geometry(), decals = new T.Mesh(decalGeo, decalMat);
    decals.frustumCulled = false; decals.renderOrder = 1;
    group.add(decals);
    const energyMat = energyMaterial(), energyG = E.geometry(), energy = new T.Mesh(energyG, energyMat);
    energy.frustumCulled = false; energy.renderOrder = 3;
    group.add(energy);
    const flames = flameMesh(fl, 0xfff0b0, group);
    const bladeG = hammerGeo(Wd, LANE_BLADE.arm, 0.72), bladeM = new T.InstancedMesh(bladeG, bladeMaterial(), Math.max(1, blades.length));
    bladeM.count = blades.length;
    bladeM.instanceMatrix.setUsage(T.DynamicDrawUsage);
    bladeM.frustumCulled = false; bladeM.castShadow = !low; bladeM.receiveShadow = true;
    group.add(bladeM);
    const surge = surgeMesh(Wd, (XA + 6.4) * 2 + 4, low);
    surge.position.set(0, 0, ARENA.surgeZ0);
    group.add(surge);
    signs.build(group);
    group.traverse((o) => { o.matrixAutoUpdate = false; o.updateMatrix(); });
    group.updateMatrixWorld(true);
    scene.add(group);
    const bo = new T.Object3D();
    let lastZ = NaN;
    const bm = new T.Matrix4();
    const view = {
        group, surge, blades: bladeM, jelly,
        // t: the server's seconds (the clock caneAt counts by); surgeZ: where the purge gas's front is (shared/arena.js surgeAt)
        update(t, surgeZ) {
            for (let i = 0; i < blades.length; i++) {
                const b = blades[i], s = Math.max(-1, Math.min(1, caneAt(b.o, t) * ARENA.hw / LANE_BLADE.arm));
                bo.position.set(b.x, LANE_BLADE.pivot, b.o.z); bo.rotation.set(0, 0, Math.asin(s)); bo.updateMatrix();
                bladeM.setMatrixAt(i, bo.matrix);
            }
            if (blades.length) bladeM.instanceMatrix.needsUpdate = true;
            for (let i = 0; i < boxes.length; i++) { const b = boxes[i]; bm.makeScale(BX_, BY_, BZ_).setPosition(b.x + laneBoxAt(b.o, t), 0, b.o.z); boxM.setMatrixAt(i, bm); }
            if (boxes.length) boxM.instanceMatrix.needsUpdate = true;
            if (surgeZ !== undefined && surgeZ !== lastZ) { lastZ = surgeZ; surge.position.z = surgeZ; surge.updateMatrix(); }
        },
        dispose() {
            releaseBlobs(group);
            signs.dispose();
            if (hullMesh) (hullMesh.isBatchedMesh ? hullMesh.dispose() : hullMesh.geometry.dispose());
            if (propMesh) (propMesh.isBatchedMesh ? propMesh.dispose() : propMesh.geometry.dispose());
            decalGeo.dispose(); decalMat.dispose(); energyG.dispose(); energyMat.dispose();
            if (flames) { flames.geometry.dispose(); flames.material.dispose(); flames.dispose(); }
            bladeG.dispose(); bladeM.dispose();
            jelly.dispose();
            boxM.geometry.dispose(); boxM.material.dispose(); boxM.dispose();
            for (const m of surge.userData.parts) { m.geometry.dispose(); m.material.dispose(); }
            scene.remove(group);
        },
    };
    view.update(CU.uNow.value, ARENA.surgeZ0);
    void stack; void one;
    return view;
}
