// The Stretcher (our own): the lab's escaped anomaly that chases you up a Stretcher Chase stage, and its sleeping twin slumped in the
// containment cell in the Atrium. A tall, thin, long-limbed thing (about 15 studs when it rears up): one huge round eye with a glowing
// iris and a heavy brow, a wide stitched grin, a knobbly spine, a containment collar with a blinking beacon on the back of its neck,
// hazard bands round its wrists, arms so long its clawed hands drag along the floor. Sculpted, rounded low-poly forms, all one
// geometry: every vertex says which part it is and where that part turns (aPart, aC), so the run is all in the vertex shader (the
// long legs loping, the knees folding, the arms swinging and slapping the floor, reaching for you when it's close, the head tilting
// and twitching, the whole body rearing up when it bursts out of its vent) and the whole monster is one draw, its pose a few uniforms.
// Local space: its reach (where its claws get you) at the origin on the floor, facing -z (north), its body behind (+z). It runs in a
// low crouch, head at your height and nothing over 9.5 studs: the chase camera looks down over its head at you. Only when it bursts
// out (or rears up) does it stand tall.
// (The exported names stay the scorpion's: main.js, stagefx.js and world.js know them by those.)
import { T } from './engine.js';
import { nearFade } from './geo.js';
import { CU } from './clock.js';
import * as FX from './fx.js';

// each sector's Stretcher: shell (its skin), dark (shadows, the mouth, claws), rim (the collar, the wrist bands, the stitches),
// belly (the eye's white), eye (the iris, glowing), beacon (the collar's blinking light); glowRim: the stitches and bands glow (night)
const LOOKS = {
    hazard: { shell: 0xe6e2da, dark: 0x2a2a34, rim: 0xffc21a, belly: 0xfffdf6, eye: 0xff4a1a, beacon: 0xff2a1a, glowRim: 0 },
    biolab: { shell: 0xf2d8e6, dark: 0x4a1a3a, rim: 0x2ad8c8, belly: 0xffffff, eye: 0x2affc8, beacon: 0xff2a6a, glowRim: 0 },
    cryo: { shell: 0xd8eaf6, dark: 0x1e2e4e, rim: 0x2a7ad8, belly: 0xffffff, eye: 0xff3a6a, beacon: 0xff3a3a, glowRim: 0 },
    void: { shell: 0x3e3262, dark: 0x120c22, rim: 0x6af0ff, belly: 0xeae4ff, eye: 0x6af0ff, beacon: 0xff4ad8, glowRim: 1 },
};
export const scorpionLook = (Wd) => LOOKS[Wd && Wd.id] || LOOKS.hazard;
// the parts: 0 body, 1 / 3 the thighs (left / right), 2 / 4 the shins and feet, 5 / 7 the upper arms, 6 / 8 the forearms and hands,
// 9 the head
// the running pose's joints (the vertex shader turns the limbs round these)
const HIP = [[-1.05, 8.0, 7.2], [1.05, 8.0, 7.2]], SHOULDER = [[-1.5, 7.75, 3.25], [1.5, 7.75, 3.25]], HIPC = [0, 8.0, 7.2];

// ----- a little sculpting kit: smooth-shaded ellipsoids, oriented and tapered, their colour worked out per vertex -----
const tc = new T.Color(), tc2 = new T.Color();
class Sculpt {
    constructor() { this.p = []; this.n = []; this.c = []; this.g = []; this.a = []; this.cen = []; }
    // an ellipsoid round C with axes ex, ey, ez (unit) and radii rx, ry, rz; its cross-section scaled from tA at the -ez end to tB at
    // the +ez end (a tapered segment); nu sides round, nv rings along; col(lx, ly, lz, ny) -> colour, glow(lx, ly, lz) -> 0/1/2
    blob(C, ex, ey, ez, rx, ry, rz, tA, tB, nu, nv, col, glow, part, pv) {
        const V = [];
        for (let j = 0; j <= nv; j++) {
            const th = j / nv * Math.PI, lz = -Math.cos(th), s = Math.sin(th), tp = tA + (tB - tA) * (lz + 1) / 2, row = [];
            for (let i = 0; i <= nu; i++) {
                const ph = i / nu * Math.PI * 2, lx = s * Math.cos(ph), ly = s * Math.sin(ph);
                const px = lx * rx * tp, py = ly * ry * tp, pz = lz * rz;
                const P = [C[0] + ex[0] * px + ey[0] * py + ez[0] * pz, C[1] + ex[1] * px + ey[1] * py + ez[1] * pz, C[2] + ex[2] * px + ey[2] * py + ez[2] * pz];
                const nx = lx / (rx * tp || 1), ny = ly / (ry * tp || 1), nz = lz / rz;
                const N = [ex[0] * nx + ey[0] * ny + ez[0] * nz, ex[1] * nx + ey[1] * ny + ez[1] * nz, ex[2] * nx + ey[2] * ny + ez[2] * nz], l = Math.hypot(N[0], N[1], N[2]) || 1;
                N[0] /= l; N[1] /= l; N[2] /= l;
                row.push({ P, N, c: col(lx, ly, lz, N[1]), g: glow ? glow(lx, ly, lz) : 0 });
            }
            V.push(row);
        }
        const put = (v) => { this.p.push(...v.P); this.n.push(...v.N); tc.set(v.c); this.c.push(tc.r, tc.g, tc.b); this.g.push(v.g); this.a.push(part); this.cen.push(pv[0], pv[1], pv[2]); };
        for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
            const a = V[j][i], b = V[j][i + 1], c = V[j + 1][i + 1], d = V[j + 1][i];
            if (j > 0) { put(a); put(b); put(c); }
            if (j < nv - 1) { put(a); put(c); put(d); }
        }
    }
    geometry() {
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3));
        g.setAttribute('normal', new T.Float32BufferAttribute(this.n, 3));
        g.setAttribute('color', new T.Float32BufferAttribute(this.c, 3));
        g.setAttribute('aGlow', new T.Float32BufferAttribute(this.g, 1));
        g.setAttribute('aPart', new T.Float32BufferAttribute(this.a, 1));
        g.setAttribute('aC', new T.Float32BufferAttribute(this.cen, 3));
        g.computeBoundingSphere();
        return g;
    }
}
const add = (a, b, k) => [a[0] + b[0] * (k ?? 1), a[1] + b[1] * (k ?? 1), a[2] + b[2] * (k ?? 1)];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// a frame round direction ez (ex level, ey up as far as it can be)
function frame(ez) { let ex = cross([0, 1, 0], ez); if (Math.hypot(...ex) < 1e-3) ex = [1, 0, 0]; ex = norm(ex); return [ex, norm(cross(ez, ex))]; }
const mixHex = (a, b, k) => tc2.set(a).lerp(tc.set(b), Math.max(0, Math.min(1, k))).getHex();
const sm = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

// the two poses' joints: 0 running (the shader's bind pose: a low crouch, head forward at your height, arms hanging to the floor
// ahead), 1 asleep (sitting slumped against the cell's back wall, knees up, arms over them, head bowed, the eye shut)
const POSE = [
    {
        hip: HIP, knee: [[-1.25, 4.5, 6.0], [1.25, 4.5, 6.0]], ankle: [[-1.2, 1.05, 7.5], [1.2, 1.05, 7.5]], toe: [[-1.15, 0.2, 5.75], [1.15, 0.2, 5.75]],
        pelvis: [0, 8.15, 7.35], waist: [0, 8.35, 6.3], shC: [0, 7.85, 3.2], sh: SHOULDER, elbow: [[-2.3, 4.5, 1.9], [2.3, 4.5, 1.9]], wrist: [[-2.05, 1.4, -0.45], [2.05, 1.4, -0.45]],
        hand: [0, -0.32, -1], neck0: [0, 7.9, 2.75], neck1: [0, 7.05, 1.75], head: [0, 6.05, 0.7], face: norm([0, -0.1, -1]),
    },
    {
        hip: [[-1.05, 1.1, 2.6], [1.05, 1.1, 2.6]], knee: [[-1.55, 5.3, -0.55], [1.55, 5.3, -0.55]], ankle: [[-1.35, 0.95, -1.9], [1.35, 0.95, -1.9]], toe: [[-1.35, 0.2, -3.55], [1.35, 0.2, -3.55]],
        pelvis: [0, 1.15, 2.85], waist: [0, 2.6, 3.25], shC: [0, 5.3, 2.65], sh: [[-1.5, 5.25, 2.75], [1.5, 5.25, 2.75]], elbow: [[-2.55, 5.65, -0.35], [2.55, 5.65, -0.35]], wrist: [[-2.2, 2.85, -2.35], [2.2, 2.85, -2.35]],
        hand: [0, -1, -0.25], neck0: [0, 5.55, 2.25], neck1: [0, 5.05, 1.4], head: [0, 4.55, 0.55], face: norm([0, -0.78, -0.62]),
    },
];

// build the Stretcher (pose 0 awake and running, 1 asleep); L: its colours; low: fewer facets (far away, Low quality)
export function scorpionGeo(L, low, pose) {
    const S = new Sculpt(), sleep = pose === 1, J = POSE[sleep ? 1 : 0], Q = low ? 0.6 : 1, nU = (n) => Math.max(5, Math.round(n * Q)), nV = (n) => Math.max(3, Math.round(n * Q));
    const gr = L.glowRim ? 1 : 0, rimG = gr ? () => 1 : null, body = [0, 0, 0], beacon = L.beacon ?? L.eye;
    const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
    // the skin: a touch lighter on top, shadowed underneath
    const skin = (base) => (lx, ly, lz, ny) => (ny < -0.2 ? mixHex(base, L.dark, 0.32 * sm(-0.2, -0.9, ny)) : mixHex(base, 0xffffff, 0.1 * sm(0.3, 1, ny)));
    // a tapered segment from A to B, radius rA to rB (a thigh, a shin, an arm, a finger, the neck), its ends a little darker (the
    // knobbly joints)
    const seg = (A, B, rA, rB, nu, nv, base, part, pv, o) => {
        const ez = norm(sub(B, A)), [ex, ey] = frame(ez), L2 = Math.hypot(...sub(B, A)) / 2, C = lerp3(A, B, 0.5), r = Math.max(rA, rB), ov = (o && o.ov) ?? 0.3;
        const sc = (o && o.flat) ? () => base : skin(base), ends = (o && o.ends) ?? 0.25;
        S.blob(C, ex, ey, ez, r, r, L2 + r * ov, rA / r, rB / r, nu, nv, (lx, ly, lz, ny) => mixHex(sc(lx, ly, lz, ny), L.dark, ends * sm(0.75, 1, Math.abs(lz))), o && o.glow, part, pv);
    };
    const ball = (C, r, nu, nv, c, g, part, pv) => S.blob(C, X, Y, Z, r, r, r, 1, 1, nu, nv, typeof c === 'function' ? c : () => c, g ? () => g : null, part, pv);
    // a ring round a limb (a collar, a wrist band): short segments round the circle at P, square to dir
    const ring = (P, dir, R, r, n, c, part, pv, g) => {
        const [a, b] = frame(norm(dir));
        const at = (i) => { const t = i / n * Math.PI * 2; return add(add(P, a, Math.cos(t) * R), b, Math.sin(t) * R); };
        for (let i = 0; i < n; i++) seg(at(i), at(i + 1), r, r, nU(5), 3, c, part, pv, { flat: true, ends: 0, ov: 0.6, glow: g });
    };

    // ----- the body: the pelvis, a thin waist, the narrow ribcage (shoulder blades on its back), a knobbly spine along the top -----
    const spine = norm(sub(J.shC, J.waist)), [sx_, sy_] = frame(spine);
    S.blob(J.pelvis, X, Y, Z, 1.35, 0.85, 1.0, 1, 1, nU(10), nV(6), skin(L.shell), null, 0, body);
    seg(J.pelvis, J.waist, 0.72, 0.62, nU(8), nV(4), L.shell, 0, body, { ends: 0 });
    const ribC = lerp3(J.waist, J.shC, 0.5);
    S.blob(ribC, sx_, sy_, spine, 1.38, 1.08, Math.hypot(...sub(J.shC, J.waist)) * 0.56, 0.62, 1, nU(12), nV(7), (lx, ly, lz, ny) => {
        // the ribs showing through: faint dark bands down its sides
        const c = skin(L.shell)(lx, ly, lz, ny), rib = Math.abs(lx) > 0.55 && ly < 0.5 && Math.sin(lz * 11) > 0.55 ? 1 : 0;
        return rib ? mixHex(c, L.dark, 0.28) : c;
    }, null, 0, body);
    for (const s of [-1, 1]) S.blob(add(add(ribC, sx_, s * 0.72), sy_, 0.82), sx_, sy_, spine, 0.62, 0.3, 1.05, 1, 0.8, nU(7), nV(4), skin(mixHex(L.shell, L.dark, 0.08)), null, 0, body);
    // the spine: a row of knobs from the tail to the neck, the biggest over the shoulders
    for (let i = 0; i <= 7; i++) {
        const t = i / 7, P = lerp3(J.pelvis, J.shC, t), up = 0.86 + 0.2 * Math.sin(t * Math.PI);
        ball(add(P, sy_, up), 0.13 + 0.08 * Math.sin(t * Math.PI * 0.9 + 0.2), nU(6), nV(4), skin(mixHex(L.shell, L.dark, 0.18)), 0, 0, body);
    }
    // the neck, the containment collar round it (its beacon blinking on the back), the shoulders
    seg(J.neck0, J.neck1, 0.42, 0.36, nU(7), nV(4), L.shell, 0, body, { ends: 0 });
    const nd = norm(sub(J.neck1, J.neck0)), cP = lerp3(J.neck0, J.neck1, 0.35);
    ring(cP, nd, 0.5, 0.15, low ? 7 : 10, L.rim, 0, body, rimG);
    ball(add(cP, frame(nd)[1], 0.62), 0.22, nU(6), nV(4), beacon, 2, 0, body);

    // ----- the head (it tilts and twitches on its neck): a tall egg, the huge eye, a heavy brow, a wide stitched grin -----
    const fz = J.face, [fx, fy] = frame(fz), HC = J.head, hp = J.neck1;
    S.blob(HC, fx, fy, fz, 1.3, 1.55, 1.25, 1, 1, nU(14), nV(10), (lx, ly, lz, ny) => mixHex(skin(L.shell)(lx, ly, lz, ny), L.dark, 0.18 * sm(0.2, -0.9, lz)), null, 9, hp);
    const eyeC = add(add(HC, fz, 0.86), fy, 0.35);
    S.blob(eyeC, fx, fy, fz, 0.94, 0.94, 0.94, 1, 1, nU(16), nV(12), sleep
        // shut: the lid over it, a dark seam across
        ? (lx, ly, lz, ny) => (lz > 0.2 && Math.abs(ly + 0.05) < 0.1 ? L.dark : skin(mixHex(L.shell, L.dark, 0.06))(lx, ly, lz, ny))
        : (lx, ly, lz) => (lz > 0.9 ? 0x0a0a12 : lz > 0.66 ? L.eye : lz > 0.6 ? mixHex(L.eye, L.dark, 0.7) : mixHex(L.belly, 0xff8a8a, 0.18 * sm(0.2, -0.5, lz))),
    sleep ? null : (lx, ly, lz) => (lz > 0.66 && lz <= 0.9 ? 1 : 0), 9, hp);
    // a little glint in the pupil
    if (!sleep) ball(add(add(add(eyeC, fz, 0.9), fy, 0.24), fx, 0.2), 0.09, 4, 3, 0xffffff, 1, 9, hp);
    // the brow: a heavy ridge over the eye, drawn down at the middle (it glares)
    for (const s of [-1, 1]) {
        const a = add(add(add(HC, fz, 1.12), fy, 1.12), fx, s * 0.1), b = add(add(add(HC, fz, 0.42), fy, 1.24), fx, s * 0.76);
        seg(a, b, 0.24, 0.17, nU(6), nV(4), mixHex(L.shell, L.dark, 0.12), 9, hp, { ends: 0.15 });
    }
    // the grin: a dark line curving up at the corners, stitched across in the collar's colour
    const onFace = (u, v, out) => { const x = u * 1.3, y = v * 1.55, z = 1.25 * Math.sqrt(Math.max(0, 1 - u * u - v * v)) + (out || 0.05); return add(add(add(HC, fx, x), fy, y), fz, z); };
    const mouth = [];
    for (let j = 0; j <= 8; j++) { const u = -0.66 + 1.32 * j / 8; mouth.push([u, -0.5 + 0.2 * (u / 0.66) * (u / 0.66)]); }
    for (let j = 0; j < 8; j++) seg(onFace(...mouth[j], 0.03), onFace(...mouth[j + 1], 0.03), 0.09, 0.09, nU(5), 3, L.dark, 9, hp, { flat: true, ends: 0, ov: 0.5 });
    for (const j of [1, 3, 5, 7]) { const [u, v] = mouth[j]; seg(onFace(u, v + 0.12, 0.07), onFace(u, v - 0.12, 0.07), 0.055, 0.055, 4, 3, L.rim, 9, hp, { flat: true, ends: 0, glow: rimG }); }

    // ----- the legs: a long thigh down to a knobbly knee, a long shin, a long thin foot with three claws -----
    for (let s = 0; s < 2; s++) {
        const thigh = 1 + s * 2, shin = 2 + s * 2, hip = J.hip[s], knee = J.knee[s], ank = J.ankle[s], toe = J.toe[s];
        seg(hip, knee, 0.62, 0.42, nU(8), nV(5), L.shell, thigh, hip);
        ball(knee, 0.46, nU(7), nV(4), skin(mixHex(L.shell, L.dark, 0.15)), 0, thigh, hip);
        seg(knee, ank, 0.4, 0.26, nU(7), nV(5), L.shell, shin, knee);
        seg(ank, toe, 0.3, 0.2, nU(6), nV(4), L.shell, shin, knee, { ends: 0.1 });
        const fd = norm(sub(toe, ank)), [fa] = frame(fd);
        for (const o of [-0.22, 0, 0.22]) seg(add(toe, fa, o), add(add(toe, fa, o * 1.6), add(fd, [0, -0.18, 0]), 0.7), 0.11, 0.04, 4, 3, L.dark, shin, knee, { ends: 0, flat: true });
    }

    // ----- the arms: so long its hands drag on the floor; a knobbly elbow, a hazard band round each wrist, a big hand with four long
    // clawed fingers curling down and a thumb -----
    for (let s = 0; s < 2; s++) {
        const up = 5 + s * 2, fore = 6 + s * 2, sh = J.sh[s], el = J.elbow[s], wr = J.wrist[s], side = s ? 1 : -1;
        ball(sh, 0.6, nU(7), nV(5), skin(L.shell), 0, up, sh);
        seg(sh, el, 0.46, 0.34, nU(8), nV(5), L.shell, up, sh);
        ball(el, 0.4, nU(6), nV(4), skin(mixHex(L.shell, L.dark, 0.15)), 0, up, sh);
        seg(el, wr, 0.34, 0.24, nU(7), nV(5), L.shell, fore, el);
        ring(lerp3(el, wr, 0.78), sub(wr, el), 0.33, 0.1, low ? 6 : 8, L.rim, fore, el, rimG);
        const hd = norm(J.hand), [ha, hb] = frame(hd), pc = add(wr, hd, 0.5);
        S.blob(pc, ha, hb, hd, 0.6, 0.26, 0.62, 1, 0.9, nU(8), nV(5), skin(L.shell), null, fore, el);
        // fingers: long, two joints, curling down at the tips (dark claws)
        for (const o of [-0.42, -0.14, 0.14, 0.42]) {
            const f0 = add(add(pc, hd, 0.5), ha, o), f1 = add(add(add(f0, hd, 0.95), ha, o * 0.35), hb, -0.12), f2 = add(add(f1, hd, 0.62), hb, -0.42);
            seg(f0, f1, 0.13, 0.11, nU(5), 3, L.shell, fore, el, { ends: 0.3 });
            seg(f1, f2, 0.11, 0.035, nU(5), 3, mixHex(L.shell, L.dark, 0.25), fore, el, { ends: 0.7 });
        }
        const t0 = add(add(pc, ha, side * 0.55), hd, 0.1), t1 = add(add(add(t0, ha, side * 0.35), hd, 0.55), hb, -0.25);
        seg(t0, t1, 0.12, 0.05, nU(5), 3, L.shell, fore, el, { ends: 0.6 });
    }
    return S.geometry();
}

// the live monster: one mesh, its pose in uniforms. mode: 'burst' (rearing up out of its floor vent in a cloud of dust), 'run', 'bite'
export function buildScorpion(group, Wd, low) {
    const L = scorpionLook(Wd), g = scorpionGeo(L, low, 0);
    const U = { uPhase: { value: 0 }, uStrike: { value: 0 }, uBob: { value: 0 }, uRear: { value: 0 } };
    const v3s = (a) => 'vec3(' + a.map((x) => x.toFixed(3)).join(', ') + ')';
    const m = new T.MeshLambertMaterial({ vertexColors: true });
    m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, U); sh.uniforms.uNow = CU.uNow;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
attribute float aPart; attribute vec3 aC; attribute float aGlow; uniform float uNow; uniform float uPhase; uniform float uStrike; uniform float uBob; uniform float uRear;
varying float vGlow;
mat2 sRot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }`)
            .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
vec3 sP = position; float id = aPart; vec3 nN = objectNormal;
if (id > 0.5 && id < 4.5) {
    // a leg: the two out of step, each swinging round its hip, the knee folding as it comes forward (the foot lifting), straight as
    // it pushes back
    float side = id < 2.5 ? -1.0 : 1.0, ph = uPhase + (side > 0.0 ? 3.1416 : 0.0);
    float sw = -sin(ph) * 0.62, kb = 0.1 + 0.92 * max(0.0, cos(ph));
    vec3 hip = side < 0.0 ? ${v3s(HIP[0])} : ${v3s(HIP[1])};
    if (mod(id, 2.0) < 0.5) { vec3 q = sP - aC; q.yz = sRot(kb) * q.yz; nN.yz = sRot(kb) * nN.yz; sP = aC + q; }
    vec3 q = sP - hip; q.yz = sRot(sw) * q.yz; nN.yz = sRot(sw) * nN.yz; sP = hip + q;
} else if (id > 4.5 && id < 8.5) {
    // an arm: swinging against its leg, the elbow bending as it comes back; reaching out ahead (straight, up at you) when it bites
    float side = id < 6.5 ? -1.0 : 1.0, ph = uPhase + (side > 0.0 ? 3.1416 : 0.0);
    float sa = sin(ph) * 0.62 - uStrike * 1.05, eb = -(0.1 + 0.55 * max(0.0, -cos(ph))) * (1.0 - uStrike * 0.8);
    vec3 sh = side < 0.0 ? ${v3s(SHOULDER[0])} : ${v3s(SHOULDER[1])};
    if (mod(id, 2.0) < 0.5) { vec3 q = sP - aC; q.yz = sRot(eb) * q.yz; nN.yz = sRot(eb) * nN.yz; sP = aC + q; }
    // (when it bites, the hands spread out round you)
    float spread = uStrike * 0.22 * side;
    vec3 q = sP - sh; q.yz = sRot(sa) * q.yz; nN.yz = sRot(sa) * nN.yz; q.xz = sRot(-spread) * q.xz; nN.xz = sRot(-spread) * nN.xz; sP = sh + q;
} else if (id > 8.5) {
    // the head: tilting slowly from side to side, twitching now and then, thrust forward when it bites
    float tw = sin(uNow * 1.3) * 0.16 + step(0.93, fract(uNow * 0.37)) * sin(uNow * 61.0) * 0.12, nod = -uStrike * 0.3 + sin(uPhase * 2.0) * 0.05;
    vec3 q = sP - aC; q.xy = sRot(tw) * q.xy; nN.xy = sRot(tw) * nN.xy; q.yz = sRot(nod) * q.yz; nN.yz = sRot(nod) * nN.yz; sP = aC + q;
}
if (id < 0.5 || id > 4.5) {
    // the whole top half rearing up round the hips (it bursts out standing tall, then drops into its crouch to run); a little roll
    // from side to side as it lopes
    vec3 q = sP - ${v3s(HIPC)}; float ra = -1.3 * uRear + sin(uPhase * 2.0) * 0.04; q.yz = sRot(ra) * q.yz; nN.yz = sRot(ra) * nN.yz;
    float rl = sin(uPhase) * 0.05; q.xy = sRot(rl) * q.xy; nN.xy = sRot(rl) * nN.xy; sP = ${v3s(HIPC)} + q;
}
sP.y += uBob;
// hands and feet slap down on the floor rather than through it (not while it's still coming up out of its vent)
if (id > 0.5 && id < 8.5 && uBob > -0.5) sP.y = max(sP.y, 0.1);
objectNormal = nN;`)
            .replace('#include <begin_vertex>', `vec3 transformed = sP;
vGlow = aGlow > 1.5 ? (fract(uNow * 1.4) < 0.45 ? 1.0 : 0.12) : aGlow > 0.5 ? 1.0 : 0.0;`);
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vGlow;')
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += diffuseColor.rgb * (0.12 + vGlow * 1.3);
diffuseColor.rgb *= 1.0 - vGlow * 0.6;`);
    };
    m.customProgramCacheKey = () => 'lde-stretcher' + (low ? '-l' : '');
    // (only what's right at the lens dissolves: the chase camera looks down over its head and must see it)
    nearFade(m, 'lde-stretcher-f' + (low ? '-l' : ''), 3, 6.5);
    const mesh = new T.Mesh(g, m);
    mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = !low; mesh.matrixAutoUpdate = false; mesh.visible = false;
    group.add(mesh);
    // a soft shadow under it (it runs on keys that take no shadows)
    let blob = null;
    if (!low) {
        const bg = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
        blob = new T.Mesh(bg, new T.ShaderMaterial({
            vertexShader: 'varying vec2 vP; void main() { vP = position.xz * 2.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
            fragmentShader: 'varying vec2 vP; void main() { float r = length(vP); if (r > 1.0) discard; gl_FragColor = vec4(0.0, 0.0, 0.0, (1.0 - smoothstep(0.35, 1.0, r)) * 0.4); }',
            transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
        }));
        blob.scale.set(9, 1, 14); blob.frustumCulled = false; blob.matrixAutoUpdate = false; blob.visible = false; blob.renderOrder = 2;
        group.add(blob);
    }
    const dust = new T.Color(Wd.floor ?? 0xe8e6de).lerp(new T.Color(0xffffff), 0.3).getHex(), tv = new T.Vector3();
    let burstAt = -1, puffAt = 0, warm = false;
    const S = {
        mesh, blob,
        // on: shown or not; x, y, z: its reach on the floor; ry: facing (0 north); t: seconds (its clock); mode: 'burst' | 'run' | 'bite'
        set(on, x, y, z, ry, t, mode) {
            if (!on) { if (!warm) { mesh.visible = false; if (blob) blob.visible = false; } burstAt = -1; return; }
            mesh.visible = true; if (blob) blob.visible = true;
            if (mode === 'burst' && (burstAt < 0 || t < burstAt)) { burstAt = t; puffAt = 0; }
            if (mode !== 'burst') burstAt = -1;
            const bk = mode === 'burst' ? Math.min(1, (t - burstAt) / 0.8) : 1, rise = (1 - bk) * (1 - bk);
            const bite = mode === 'bite' ? 1 : 0;
            U.uPhase.value = t * (mode === 'burst' ? 6 : 11.5);
            U.uBob.value = Math.abs(Math.sin(t * 11.5)) * 0.32 * bk - rise * 15;
            U.uStrike.value += (bite - U.uStrike.value) * 0.25;
            // it comes up standing tall, and drops into its crouch as it sets off
            U.uRear.value += ((mode === 'burst' ? 1 : 0) - U.uRear.value) * (mode === 'burst' ? 0.3 : 0.14);
            const lunge = U.uStrike.value * 1.6, s = Math.sin(ry), c = Math.cos(ry);
            mesh.position.set(x - s * lunge, y, z - c * lunge);
            mesh.rotation.set(-0.3 * rise, ry, 0, 'YXZ');
            mesh.updateMatrix(); mesh.updateMatrixWorld();
            if (blob) { blob.position.set(x + s * 4, y + 0.12, z + c * 4); blob.rotation.set(0, ry, 0); blob.updateMatrix(); blob.updateMatrixWorld(); }
            // dust: a cloud as it breaks out of its vent, puffs from its feet and hands as it runs
            if (mode === 'burst' && t - puffAt > 0.12 && bk < 1) { puffAt = t; for (let i = 0; i < (low ? 2 : 4); i++) { tv.set(x + (Math.random() - 0.5) * 7 * c, y + 0.5, z + 5 + (Math.random() - 0.5) * 7); FX.dust(tv, low ? 2 : 3, 2.2, dust); } }
            else if (!low && mode !== 'burst' && t - puffAt > 0.2) { puffAt = t; tv.set(x + (Math.random() - 0.5) * 6 * c, y + 0.3, z + 1 + Math.random() * 7); FX.dust(tv, 1, 1.2, dust); }
        },
        warm(on) { warm = !!on; mesh.visible = warm; if (blob) blob.visible = warm; if (on) { mesh.position.set(0, -50, 0); mesh.updateMatrix(); mesh.updateMatrixWorld(); } },
        dispose() { group.remove(mesh); g.dispose(); m.dispose(); if (blob) { group.remove(blob); blob.geometry.dispose(); blob.material.dispose(); } },
    };
    return S;
}
