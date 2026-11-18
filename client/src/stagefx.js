// What moves in the stages' own challenges (shared/stages.js), one draw a kind for a whole sector: the laser sweepers (a beam of light
// turning round its emitter post), the blast doors sliding wall to wall, the giant rolling eyeballs, the supply crates dropping from
// the ceiling, the keycap walls, the glitch keys flickering out under you, the flicker keys, and the Stretcher. (Golden Keys are gone:
// the list is kept, nothing is drawn.)
// Where each thing is comes from the server's clock (the same on every screen); the walls you've smashed and the keys you've broken
// are yours alone (the server doesn't judge them). Lambert and unlit only; everything near the camera is cheap to move. The lasers are
// unlit: an opaque core (white-hot down the middle) and, above Low, a soft additive glow round it (one more draw a kind).
import { T } from './engine.js';
import { CU } from './clock.js';
import { Kit, glowVCMaterial, nearFade } from './geo.js';
import * as SW from '../../shared/world.js';
import * as SG from '../../shared/stages.js';
import { WALLS_N } from '../../shared/config.js';
import * as FX from './fx.js';
// (the keycap floor: its letter atlas, read through the namespace so a renamed export can't break the build)
import * as KEYS from './keycaps.js';
import { buildScorpion } from './monster.js';
// (the shared stage data read through their namespaces: the kinds the stages no longer use may lose their exports)
const { stagePlan, sliderAt, SLIDER } = SW, { SWEEP, sweeperAngle, BALL, ballZ, GUM, gumballsAt, JWALL, TILE } = SG;
// (the vanishing keys: a row is there unless the wave is going through it, on the server's clock)
const BLINK = SG.BLINK || { s: 4, warn: 0.32 }, blinkPhase = SG.blinkPhase || (() => 0);

const m4 = new T.Matrix4(), q4 = new T.Quaternion(), v3 = new T.Vector3(), s3 = new T.Vector3(), e3 = new T.Euler(), tc = new T.Color();
const mixC = (a, b, k) => new T.Color(a).lerp(new T.Color(b), k).getHex();
const hash2 = (x, z) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };

// ----- the keycaps' legends: the keycap floor's letter atlas when it has one (the same letters as the floor's keys), else a little
// font of its own: letters of 3 x 5 cells (rows top to bottom), then arrows for the wide keys. In a key's uv a letter is 0..35 (a
// letter or a digit, turned by where the instance is), an arrow 100 + 0 up, 1 left, 2 right -----
const GLYPHS = [
    ['#.#', '#.#', '##.', '#.#', '#.#'], ['###', '#..', '##.', '#..', '###'], ['#.#', '#.#', '.#.', '.#.', '.#.'], ['.#.', '#.#', '###', '#.#', '#.#'],
    ['.##', '#..', '.#.', '..#', '##.'], ['##.', '#.#', '#.#', '#.#', '##.'], ['#.#', '#.#', '#.#', '###', '#.#'], ['.#.', '#.#', '#.#', '##.', '.##'],
    ['##.', '#.#', '##.', '#.#', '#.#'], ['###', '#..', '##.', '#..', '#..'], ['.##', '#..', '#.#', '#.#', '.##'], ['#.#', '#.#', '###', '#.#', '#.#'],
    ['.#.', '###', '.#.', '.#.', '.#.'], ['..#', '.##', '###', '.##', '..#'], ['#..', '##.', '###', '##.', '#..'],
];
const G_LEFT = 101, G_RIGHT = 102;
const KG = GLYPHS.map((g) => parseInt(g.join('').replace(/#/g, '1').replace(/\./g, '0'), 2));
// the floor's atlas (8 x 8 cells, the letter in the red channel), if it's there yet: { u (its uniform), arrows [up, left, right] }
function glyphAtlas() {
    const U = KEYS.jellyU && KEYS.jellyU.uGlyphs, G = KEYS.GLYPHS || [];
    if (!U || !U.value) return null;
    const at = (ch, fb) => { const i = G.indexOf(ch); return i >= 0 ? i : fb; };
    return { u: U, arrows: [at('↑', 49), at('←', 48), at('→', 50)] };
}
// the legend's GLSL: keyLegend(p: studs from the top's middle, gi: the glyph, cs: the legend's box in studs) 0..1
const legendGLSL = (A) => (A ? `
uniform sampler2D uGlyphs;
float keyLegend(vec2 p, float gi, float cs) {
    vec2 gu = p / cs + 0.5;
    if (gu.x < 0.0 || gu.x > 1.0 || gu.y < 0.0 || gu.y > 1.0) return 0.0;
    return texture2D(uGlyphs, (vec2(mod(gi, 8.0), 7.0 - floor(gi / 8.0)) + clamp(gu, 0.02, 0.98)) / 8.0).r;
}` : `
const int KG[${KG.length}] = int[${KG.length}](${KG.join(', ')});
float keyLegend(vec2 p, float gi, float cs) {
    vec2 q = p / (cs * 0.125 * vec2(3.0, 5.0)) + 0.5;
    if (q.x < 0.0 || q.x >= 1.0 || q.y < 0.0 || q.y >= 1.0) return 0.0;
    // (top left cell the highest bit: bit = row from the bottom * 3 + column from the right)
    int bit = int(q.y * 5.0) * 3 + 2 - int(q.x * 3.0);
    return float((KG[int(gi + 0.5)] >> bit) & 1);
}`);
// a keycap's top in a Kit, as uv: x the glyph * 16 + studs across the top from its middle, y studs up it; every other face -99
const NO_UV = [-99, -99, -99, -99];
const topUV = (gi, w, h) => [gi * 16 - w / 2, -h / 2, gi * 16 + w / 2, h / 2];

// The keycaps' material (the walls', the crumbling keys'): matte plastic, a little self-lit, the legend painted on every top in the
// world's legend colour (glowing in the worlds whose legends glow), a letter picked by where the instance is. cell: the legend's box in
// studs. wall: the wall's flight when it's smashed (aK: each key's middle and its seed; aBurst: when its wall was smashed)
const FLY = 1.25;
function keycapMaterial(Wd, key, cell, wall) {
    const m = new T.MeshLambertMaterial({ vertexColors: true }), A = glyphAtlas();
    const U = { uLeg: { value: new T.Color(Wd.legend ?? 0x222222) }, uLegK: { value: Wd.legendGlow || 0 }, uCell: { value: cell } };
    if (A) U.uGlyphs = A.u;
    // (how many letters to turn through, and where the arrows are, in the atlas or the little font)
    const NA = A ? '36.0' : '12.0', AR = (A ? A.arrows : [12, 13, 14]).map((v) => v.toFixed(1));
    m.onBeforeCompile = (sh) => {
        sh.uniforms.uNow = CU.uNow; Object.assign(sh.uniforms, U);
        let vs = sh.vertexShader.replace('#include <common>', `#include <common>
uniform float uNow; varying vec3 vKu;${wall ? '\nattribute vec4 aK; attribute float aBurst;' : ''}`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>
{ float gi = floor((uv.x + 8.0) / 16.0), ak = gi - 100.0; vec3 ip = instanceMatrix[3].xyz; float off = floor(fract(sin(dot(ip.xz, vec2(0.1731, 0.0937))) * 4375.85) * 36.0);
  vKu = vec3(uv.x - gi * 16.0, uv.y, ak < -0.5 ? mod(gi + off, ${NA}) : ak < 0.5 ? ${AR[0]} : ak < 1.5 ? ${AR[1]} : ${AR[2]}); }`);
        if (wall) {
            // smashed: every key tumbles off ahead and up, falls to the floor and shrinks away; the plate behind them goes at once.
            // Then nothing until the wall grows back (its matrix, main side); a key flying at the lens shrinks out of the way
            vs = vs.replace('#include <color_vertex>', `vColor = vec4(color * mix(instanceColor, vec3(1.0), step(1.5, aK.w) + step(aK.w, -0.5)), 1.0);`)
                .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
float kAge = uNow - aBurst, kFly = step(0.0, kAge) * step(kAge, ${FLY.toFixed(2)}), kGone = step(${FLY.toFixed(2)}, kAge) * step(kAge, 5.9);
float kS = fract(abs(aK.w)), kA = kAge * (4.0 + kS * 6.0) * kFly, kB = kAge * (2.5 + fract(kS * 7.31) * 5.0) * kFly;
float kca = cos(kA), ksa = sin(kA), kcb = cos(kB), ksb = sin(kB);
mat3 kR = mat3(1.0, 0.0, 0.0, 0.0, kca, ksa, 0.0, -ksa, kca) * mat3(kcb, ksb, 0.0, -ksb, kcb, 0.0, 0.0, 0.0, 1.0);
objectNormal = kR * objectNormal;`)
                .replace('#include <begin_vertex>', `#include <begin_vertex>
if (kFly > 0.5) {
    if (aK.w < -0.5) transformed = aK.xyz;
    else {
        vec3 kv = vec3(aK.x * 0.42 + (kS - 0.5) * 9.0, 6.0 + kS * 8.0 + aK.y * 0.5, -(10.0 + fract(kS * 3.7) * 12.0));
        vec3 kc = vec3(aK.x + kv.x * kAge, max(0.8, aK.y + kv.y * kAge - 18.0 * kAge * kAge), aK.z + kv.z * kAge);
        float kd = -(modelViewMatrix * instanceMatrix * vec4(kc, 1.0)).z;
        float sc = (1.0 - smoothstep(${(FLY - 0.4).toFixed(2)}, ${FLY.toFixed(2)}, kAge)) * smoothstep(3.0, 8.0, kd);
        transformed = kc + kR * (transformed - aK.xyz) * sc;
    }
} else if (kGone > 0.5) transformed = aK.xyz;`);
        }
        sh.vertexShader = vs;
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform vec3 uLeg; uniform float uLegK; uniform float uCell; varying vec3 vKu;${legendGLSL(A)}`)
            .replace('#include <color_fragment>', `#include <color_fragment>
float kLg = vKu.y > -50.0 ? keyLegend(vKu.xy, vKu.z, uCell) * (1.0 - smoothstep(80.0, 130.0, length(vViewPosition))) : 0.0;
diffuseColor.rgb = mix(diffuseColor.rgb, uLeg * (1.0 - uLegK), kLg);`)
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += diffuseColor.rgb * 0.24 + uLeg * kLg * uLegK * 1.25;`);
    };
    m.customProgramCacheKey = () => key + (A ? '-a' : '-f');
    return m;
}
// a keycap's raised top on one face of a Kit: the rim (x0..x1, y0..y1 at depth z0) sloping in by e to the top at depth z1 (the
// keycap's face is +z when z1 > z0, -z when z1 < z0); its colour c (sides a shade darker), the legend gi on it
function capFace(k, x0, x1, y0, y1, z0, z1, e, c, gi) {
    const s = Math.sign(z1 - z0), a0 = x0 + e, a1 = x1 - e, b0 = y0 + e, b1 = y1 - e;
    // the top: wound to face out, its uv reading the right way round from that side
    if (s > 0) k.quad([a0, b0, z1], [a1, b0, z1], [a1, b1, z1], [a0, b1, z1], c, { uv: topUV(gi, a1 - a0, b1 - b0) });
    else k.quad([a1, b0, z1], [a0, b0, z1], [a0, b1, z1], [a1, b1, z1], c, { uv: topUV(gi, a1 - a0, b1 - b0) });
    k.faceTo([x0, y1, z0], [x1, y1, z0], [a1, b1, z1], [a0, b1, z1], [0, 1, s], c, { uv: NO_UV, shade: 0.96 });
    k.faceTo([x0, y0, z0], [x1, y0, z0], [a1, b0, z1], [a0, b0, z1], [0, -1, s], c, { uv: NO_UV, shade: 0.74 });
    k.faceTo([x0, y0, z0], [x0, y1, z0], [a0, b1, z1], [a0, b0, z1], [-1, 0, s], c, { uv: NO_UV, shade: 0.86 });
    k.faceTo([x1, y0, z0], [x1, y1, z0], [a1, b1, z1], [a1, b0, z1], [1, 0, s], c, { uv: NO_UV, shade: 0.86 });
}
// A keycap wall: rows of giant keys across the way (staggered, a wide modifier key at the rows' ends in the world's third colour, the
// rest tinted by the wall's instance colour), a dark plate behind them. Each key is a cap on both faces (low: fewer, bigger keys, the
// front, a flat back), so a smashed one tumbles as a solid key. Built at its real size (x across, y up from the floor, z its
// thickness); aK on every vertex says which key it's part of (its middle; w: -1 the plate, 0..1 a key's seed, + 2 a modifier)
function wallGeo(Wd, low) {
    const k = new Kit(), W = 34.6, H = JWALL.h, D = JWALL.d, ks = [];
    const rows = low ? [[1.5, 1.5, 1.5, 1.5, 1.5], [2, 1.75, 1.75, 2], [1.75, 2, 2, 1.75]] : [[1.25, 1, 1, 1, 1, 1, 1.25], [1.5, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1.5]];
    const u = W / 7.5, rh = H / rows.length, g = 0.12, e = 0.48, mod = Wd.keys[2];
    let n = 0;
    // the plate: the keys sit in it (the gaps between them show it)
    k.box(0, H / 2, 0, W - 0.3, H - 0.3, 1.0, mixC(mod, 0x000000, 0.55), { uv: NO_UV });
    ks.push([0, k.count, 0, H / 2, 0, -1]);
    rows.forEach((row, ri) => {
        let x = -W / 2;
        const y0 = ri * rh + g, y1 = (ri + 1) * rh - g;
        row.forEach((w, j) => {
            // (a wide key at either end of a row is a modifier: the third colour, an arrow on it)
            const x0 = x + g, x1 = x + w * u - g, end = j === 0 || j === row.length - 1, wide = w > 1.01 && end, v0 = k.count, c = wide ? mod : 0xffffff;
            const gi = wide ? (j === 0 ? G_RIGHT : G_LEFT) : (n * 5 + ri * 3) % 36;
            capFace(k, x0, x1, y0, y1, 0, D / 2, e, c, gi);
            if (low) k.quad([x1, y0, 0], [x0, y0, 0], [x0, y1, 0], [x1, y1, 0], c, { uv: NO_UV, shade: 0.8 });
            else capFace(k, x0, x1, y0, y1, 0, -D / 2, e, c, gi);
            ks.push([v0, k.count, (x0 + x1) / 2, (y0 + y1) / 2, 0, (wide ? 2 : 0) + hash2(n * 3.1, ri * 7.7) * 0.98]);
            x += w * u; n++;
        });
    });
    const geo = k.geometry(), aK = new Float32Array(geo.attributes.position.count * 4);
    for (const [v0, v1, x, y, z, w] of ks) for (let v = v0; v < v1; v++) aK.set([x, y, z, w], v * 4);
    geo.setAttribute('aK', new T.Float32BufferAttribute(aK, 4));
    return geo;
}
// a glitch key: a keycap the size of a tile, its top at the floor (y 0), a skirt under it (seen as it drops)
function tileGeo() {
    const k = new Kit(), h = TILE.s / 2 - 0.1;
    capFace(k, -h, h, -h, h, 0, 0.42, 0.44, 0xffffff, 0);
    k.box(0, 0, -0.32, h * 2, h * 2, 0.64, 0xffffff, { uv: NO_UV, shade: 0.72 });
    // (built facing +z: laid down, its top facing up)
    return k.geometry().rotateX(-Math.PI / 2).translate(0, -0.37, 0);
}

// the shadow of a falling crate (unlit, see-through, darker and bigger as it comes)
function shadowMaterial() {
    return new T.ShaderMaterial({
        vertexShader: 'attribute float aK; varying vec2 vP; varying float vK; void main() { vP = position.xz; vK = aK; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }',
        fragmentShader: 'varying vec2 vP; varying float vK; void main() { float r = length(vP); if (r > 1.0) discard; float a = (1.0 - smoothstep(0.55, 1.0, r)) * (0.18 + 0.5 * vK) + smoothstep(0.86, 0.95, r) * (1.0 - smoothstep(0.95, 1.0, r)) * 0.55 * vK; gl_FragColor = vec4(mix(vec3(0.1, 0.03, 0.02), vec3(1.0, 0.32, 0.12), smoothstep(0.86, 0.95, r) * vK), a); }',
        transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    });
}
// ----- the laser sweepers: a beam of light turning round its emitter post. Each sector's own colour (it has to read on its walls):
// alarm red in Hazard Halls, toxic green in the Bio Lab, hot pink in the Cryo Vault, magenta in the Void Wing -----
export const laserColors = (Wd) => { const id = Wd && Wd.id; return id === 'biolab' ? { c: 0x22ff6a, core: 0xeafff0 } : id === 'cryo' ? { c: 0xff2a6a, core: 0xffe8f0 } : id === 'void' ? { c: 0xff3ad8, core: 0xffeaff } : { c: 0xff2a24, core: 0xfff0e8 }; };
// A laser sweeper's beam, right across (local x along it, its middle at the post, y at SWEEP.y): a square bar of light SWEEP.r each way
// (the hit test's length), the emitter head turning with it on top of the post (a drum banded in hazard stripes, a dark cap, a lens
// glowing where the beam leaves it each side), an emitter node burning at each tip. aGlow 1: light (painted in its shader); 0: steel,
// shaded by a fixed light
function beamGeo(Wd, low) {
    const k = new Kit({ glow: true }), L = SWEEP.r, C = laserColors(Wd), pr = SWEEP.post, bw = SWEEP.t * (low ? 0.8 : 0.62), th = SWEEP.t * 1.15;
    k.box(0, 0, 0, L * 2 - 0.6, bw, bw, C.c, { glow: 1 });
    const n = low ? 8 : 12, R = pr + 0.3, sw = 2 * R * Math.sin(Math.PI / n) + 0.06;
    k.box(0, 0, 0, R * 1.6, th, R * 1.6, 0x6c7482, {});
    for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * Math.PI * 2; k.box(Math.cos(a) * R, 0, Math.sin(a) * R, sw, th, 0.26, i % 2 ? 0x1c1c24 : 0xffc21a, { ry: -a - Math.PI / 2 }); }
    for (const r of [0, Math.PI / 4]) k.box(0, th / 2 + 0.08, 0, R * 1.52, 0.18, R * 1.52, 0x2a2e38, { ry: r });
    k.box(0, th / 2 + 0.3, 0, 0.7, 0.3, 0.7, C.core, { glow: 1 });
    for (const sx of [-1, 1]) {
        k.box(sx * (R + 0.18), 0, 0, 0.3, bw * 1.6, bw * 1.6, C.core, { glow: 1 });
        k.box(sx * L, 0, 0, 0.95, 0.95, 0.95, C.core, { glow: 1, rx: Math.PI / 4, ry: Math.PI / 4 });
    }
    return k.geometry();
}
const PANEL_TOP = SLIDER.h - 0.6, PANEL_PW = 0.9;
const panelRows = (low) => { const n = low ? 4 : 5, y0 = 0.8, y1 = PANEL_TOP - 0.5; return { n, y0, dy: (y1 - y0) / (n - 1) }; };
// a band of hazard stripes on one face of a Kit (the face at z, facing +z when s is 1, -z when -1): yellow slanted bars on black
function stripeBand(k, s, z, x0, x1, y0, y1, n) {
    const want = [0, 0, s], zb = z + s * 0.07, zs = z + s * 0.12, pitch = (x1 - x0) / n, sw = pitch / 2, sl = (y1 - y0) * 0.85, cl = (x) => Math.max(x0, Math.min(x1, x));
    k.faceTo([x0, y0, zb], [x1, y0, zb], [x1, y1, zb], [x0, y1, zb], want, 0x1c1c24);
    for (let i = -2; i <= n; i++) {
        const a = x0 + i * pitch, q = [cl(a), cl(a + sw), cl(a + sw + sl), cl(a + sl)];
        if (q[1] - q[0] < 0.02 && q[2] - q[3] < 0.02) continue;
        k.faceTo([q[0], y0, zs], [q[1], y0, zs], [q[2], y1, zs], [q[3], y1, zs], want, 0xffc21a);
    }
}
// the doors' steel, each sector's
// (dark against the pale floors and walls; light against the Void Wing's dark)
const doorSteel = (Wd) => ({ hazard: 0x4e5664, biolab: 0x4e3a5c, cryo: 0x34486a, void: 0x9a94c4 })[Wd && Wd.id] ?? 0x4e5664;
// A blast door: a slab of steel sliding wall to wall (the hit test's size), a band of hazard stripes across both faces, raised panels and
// a seam down the middle (two halves), black-and-yellow bumpers on the ends it slams into, a red alarm lamp blinking on top (aGlow 2)
function panelGeo(Wd, low) {
    const k = new Kit({ glow: true }), w = SLIDER.w, h = PANEL_TOP, d = SLIDER.d, st = doorSteel(Wd), dk = mixC(st, 0x101018, 0.55), lt = mixC(st, 0xffffff, 0.2);
    k.box(0, h / 2, 0, w - 0.3, h, d - 0.4, st);
    k.box(0, 0.35, 0, w, 0.7, d - 0.1, dk);
    k.box(0, h - 0.3, 0, w + 0.1, 0.6, d - 0.2, dk);
    for (const sz of [1, -1]) {
        const zf = sz * (d / 2 - 0.2);
        for (const sx of [-1, 1]) k.box(sx * (w / 4 - 0.05), h * 0.62, zf + sz * 0.06, w / 2 - 1.0, h * 0.44, 0.12, lt);
        k.box(0, h * 0.6, zf + sz * 0.09, 0.18, h * 0.6, 0.16, dk);
        stripeBand(k, sz, zf, -w / 2 + 0.4, w / 2 - 0.4, 0.82, 2.1, low ? 4 : 6);
        // a yellow frame round the face (its outline reads from far off)
        for (const sx of [-1, 1]) k.box(sx * (w / 2 - 0.42), (2.1 + h - 0.62) / 2, zf + sz * 0.08, 0.26, h - 0.62 - 2.1, 0.12, 0xffc21a);
        k.box(0, h - 0.74, zf + sz * 0.08, w - 0.6, 0.24, 0.12, 0xffc21a);
    }
    const nb = low ? 3 : 5, bh = (h - 1.4) / nb;
    for (const sx of [-1, 1]) for (let i = 0; i < nb; i++) k.box(sx * (w / 2 - 0.02), 0.8 + bh * (i + 0.5), 0, 0.5, bh - 0.03, d - 0.9, i % 2 ? 0x1c1c24 : 0xffc21a);
    k.box(0, h + 0.15, 0, 1.5, 0.3, 1.5, dk);
    k.box(0, h + 0.62, 0, 0.9, 0.66, 0.9, 0xff2a1a, { glow: 2 });
    return k.geometry();
}
function laserMaterial(Wd) {
    const C = laserColors(Wd), u = T.UniformsUtils.merge([T.UniformsLib.fog, { uC: { value: new T.Color(C.c) }, uCore: { value: new T.Color(C.core) } }]);
    u.uNow = CU.uNow;
    return new T.ShaderMaterial({
        uniforms: u, fog: true,
        vertexShader: `attribute vec3 color; attribute float aGlow; varying vec3 vC; varying vec2 vUv; varying float vX; varying vec3 vN; varying float vG; varying float vD;
            #include <fog_pars_vertex>
            void main() {
                vC = color; vUv = uv; vX = position.x; vN = normal; vG = aGlow;
                vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
                vD = -mvPosition.z;
                gl_Position = projectionMatrix * mvPosition;
                #include <fog_vertex>
            }`,
        fragmentShader: `uniform float uNow; uniform vec3 uC; uniform vec3 uCore; varying vec3 vC; varying vec2 vUv; varying float vX; varying vec3 vN; varying float vG; varying float vD;
            #include <fog_pars_fragment>
            void main() {
                if (vD < 6.0) { float dk = 1.0 - smoothstep(2.5, 6.0, vD); if (mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0) < dk * 2.0) discard; }
                vec3 c;
                if (vG > 1.5) {
                    // an alarm lamp: its own colour, blinking
                    c = vC * (fract(uNow * 2.2) < 0.5 ? 1.25 : 0.35);
                } else if (vG > 0.5) {
                    // the laser: white-hot down its middle, pulses of light running along it, a shimmer
                    float v = abs(vUv.y - 0.5) * 2.0, run = 0.5 + 0.5 * sin(vX * 2.4 - uNow * 24.0), fl = 0.93 + 0.07 * sin(uNow * 67.0 + vX * 0.9);
                    c = mix(uC * 1.1, uCore * 1.2, (1.0 - smoothstep(0.0, 0.8, v)) * (0.55 + 0.45 * run)) * fl;
                } else c = vC * (0.78 + 0.42 * max(dot(normalize(vN), vec3(-0.33, 0.85, 0.41)), 0.0));
                gl_FragColor = vec4(c, 1.0);
                #include <colorspace_fragment>
                #include <fog_fragment>
            }`,
    });
}
// The glow round a laser (not on Low): quads added on top, unlit; aQ says what each is: z 0 a band along a beam (x -1..1 across it,
// y studs along it), 1 a flare (xy -1..1 from its middle), 2 a curtain of beams (x: rows, a beam on every whole number; y studs across)
function glowQuads() {
    const G = { p: [], q: [], i: [] };
    G.quad = (cs, qs) => { const b = G.p.length / 3; for (let j = 0; j < 4; j++) { G.p.push(...cs[j]); G.q.push(...qs[j]); } G.i.push(b, b + 1, b + 2, b, b + 2, b + 3); };
    return G;
}
function glowGeoOf(G) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(G.p, 3)); g.setAttribute('aQ', new T.Float32BufferAttribute(G.q, 3)); g.setIndex(G.i); g.computeBoundingSphere(); return g; }
function beamGlowGeo() {
    const G = glowQuads(), L = SWEEP.r, gw = SWEEP.t * 1.4, gh = SWEEP.t * 1.05, F = 1.7, fq = [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
    const band = [[-1, -L, 0], [-1, L, 0], [1, L, 0], [1, -L, 0]];
    // a flat band and an upright one (one of them faces the camera however the beam lies), a flare at each tip
    G.quad([[-L, 0, -gw], [L, 0, -gw], [L, 0, gw], [-L, 0, gw]], band);
    G.quad([[-L, -gh, 0], [L, -gh, 0], [L, gh, 0], [-L, gh, 0]], band);
    for (const x of [-L, L]) { G.quad([[x - F, -F, 0], [x + F, -F, 0], [x + F, F, 0], [x - F, F, 0]], fq); G.quad([[x, -F, -F], [x, -F, F], [x, F, F], [x, F, -F]], fq); }
    return glowGeoOf(G);
}
function panelGlowGeo(low) {
    const G = glowQuads(), R = panelRows(low), x0 = -SLIDER.w / 2 + PANEL_PW, x1 = -x0, zf = SLIDER.d / 2 - 0.3, ya = R.y0 - R.dy / 2, yb = R.y0 + (R.n - 0.5) * R.dy;
    for (const z of [zf, -zf]) G.quad([[x0, ya, z], [x1, ya, z], [x1, yb, z], [x0, yb, z]], [[-0.5, x0, 2], [-0.5, x1, 2], [R.n - 0.5, x1, 2], [R.n - 0.5, x0, 2]]);
    return glowGeoOf(G);
}
function laserGlowMaterial(Wd) {
    const C = laserColors(Wd), u = T.UniformsUtils.merge([T.UniformsLib.fog, { uC: { value: new T.Color(C.c) }, uCore: { value: new T.Color(C.core) } }]);
    u.uNow = CU.uNow;
    return new T.ShaderMaterial({
        uniforms: u, fog: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
        vertexShader: `attribute vec3 aQ; varying vec3 vQ; varying float vD;
            #include <fog_pars_vertex>
            void main() {
                vQ = aQ;
                vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
                vD = -mvPosition.z;
                gl_Position = projectionMatrix * mvPosition;
                #include <fog_vertex>
            }`,
        fragmentShader: `uniform float uNow; uniform vec3 uC; uniform vec3 uCore; varying vec3 vQ; varying float vD;
            #include <fog_pars_fragment>
            void main() {
                float a, h;
                if (vQ.z < 0.5) { h = 1.0 - abs(vQ.x); a = pow(h, 2.6) * (0.55 + 0.15 * sin(vQ.y * 1.7 - uNow * 19.0)); }
                else if (vQ.z < 1.5) { h = max(0.0, 1.0 - length(vQ.xy)); a = pow(h, 2.2) * (0.9 + 0.2 * sin(uNow * 31.0 + vQ.x)); }
                else { h = max(0.0, 1.0 - abs(fract(vQ.x + 0.5) - 0.5) * 3.2); a = pow(h, 2.4) * 0.5 + 0.06 + 0.16 * smoothstep(0.92, 1.0, sin(vQ.x * 1.3 - uNow * 5.0)); }
                a *= smoothstep(1.5, 5.0, vD);
                #ifdef USE_FOG
                a *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
                #endif
                if (a < 0.004) discard;
                gl_FragColor = vec4(mix(uC, uCore, h * h * 0.55) * a, 1.0);
                #include <colorspace_fragment>
            }`,
    });
}
// The rolling eyeballs: giant googly eyes as tall as two players, white with red veins, an iris in the sector's colour (glowing in the
// Void Wing) and a black pupil with a glint, all on one side, so the eye rolls round and round as it comes at you. A sphere with its pole
// at the iris (its rings fall on the iris's and the pupil's edges: crisp), a colour a face, its normals round
const IRIS = { hazard: [0xff8a1a, 0], biolab: [0x1ec8b4, 0], cryo: [0x2a64d8, 0], void: [0xd84aff, 1] };
function ballGeo(Wd, low) {
    const R = BALL.r, g0 = new T.SphereGeometry(R, low ? 20 : 32, low ? 12 : 18).rotateX(Math.PI / 2), g = g0.toNonIndexed();
    g0.dispose();
    const p = g.attributes.position, n = p.count, col = new Float32Array(n * 3), glow = new Float32Array(n), I = IRIS[Wd.id] || IRIS.hazard;
    const white = new T.Color(0xfffcf4), vein = new T.Color(0xd8303e), iris = new T.Color(I[0]), limb = new T.Color(I[0]).multiplyScalar(0.45), pupil = new T.Color(0x0c0a12), glint = new T.Color(0xffffff);
    const VEINS = [0.2, 1.0, 1.75, 2.6, 3.3, 4.1, 4.9, 5.6].map((a, i) => ({ a, len: 14 + hash2(i, 3.3) * 16 }));
    const D = 180 / Math.PI;
    for (let f = 0; f < n; f += 3) {
        v3.set(0, 0, 0); for (let v = f; v < f + 3; v++) { v3.x += p.getX(v); v3.y += p.getY(v); v3.z += p.getZ(v); }
        v3.normalize();
        const th = Math.acos(Math.max(-1, Math.min(1, v3.z))) * D, ph = Math.atan2(v3.y, v3.x);
        let c = white, gl = 0;
        if (th < 20) c = ph > 0.9 && ph < 2.1 && th > 9 ? glint : pupil;
        else if (th < 48) { c = iris; gl = I[1]; }
        else if (th < 58) c = limb;
        else for (const V of VEINS) {
            const dph = Math.abs(((ph - V.a) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
            if (th < 60 + V.len && dph < (low ? 0.2 : 0.13)) { c = tc.copy(white).lerp(vein, 0.6 - 0.3 * (th - 60) / V.len); break; }
        }
        for (let v = f; v < f + 3; v++) { col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b; glow[v] = gl; }
    }
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    g.setAttribute('aGlow', new T.BufferAttribute(glow, 1));
    return g;
}
// A falling supply crate: a box in the sector's accent colour framed in dark steel along every edge, a band of hazard tape round its
// middle (black stripes on yellow), a cross brace on top. CRATE: its half size (it lands flat on its bottom)
const CRATE = GUM.r * 0.72;
function boulderGeo(low, Wd) {
    const k = new Kit(), h = CRATE, s = h * 2, fr = 0.36, body = mixC(Wd.sea, 0xffffff, 0.12), frame = mixC(Wd.wall2, 0x000000, 0.3), e = h - fr / 2;
    k.box(0, 0, 0, s - 0.12, s - 0.12, s - 0.12, body);
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
        k.box(a * e, b * e, 0, fr, fr, s, frame); k.box(a * e, 0, b * e, fr, s, fr, frame); k.box(0, a * e, b * e, s, fr, fr, frame);
    }
    k.box(0, 0, 0, s + 0.06, s * 0.24, s + 0.06, 0xffc21a);
    if (!low) {
        for (let j = -1; j <= 1; j++) {
            const o = j * s * 0.3;
            for (const sg of [-1, 1]) {
                k.box(o, 0, sg * (h + 0.05), 0.26, s * 0.3, 0.05, 0x1c1c24, { rz: Math.PI / 4 });
                k.box(sg * (h + 0.05), 0, o, 0.05, s * 0.3, 0.26, 0x1c1c24, { rx: Math.PI / 4 });
            }
        }
        for (const sg of [-1, 1]) k.box(0, sg * (h - 0.04), 0, s * 1.2, 0.12, 0.3, frame, { ry: Math.PI / 4 * sg });
    }
    return k.geometry();
}
// A list of things along the course, in order down it (z falling), drawn only near the camera: the ones within R of it go in the
// mesh's first slots and nothing else is drawn (an instanced mesh over the whole course is never culled: 15 stages of keys three
// thousand studs off, under the fog, cost as much as everything else on screen). slide() says if the window moved
function windowOf(list, zOf) { list.sort((a, b) => zOf(b) - zOf(a)); return { list, zOf, lo: 0, hi: 0 }; }
function slide(w, camZ, R) {
    const L = w.list;
    let lo = L.length, hi = L.length;
    for (let i = 0; i < L.length; i++) if (w.zOf(L[i]) < camZ + R) { lo = i; break; }
    for (let i = lo; i < L.length; i++) if (w.zOf(L[i]) <= camZ - R) { hi = i; break; }
    const moved = lo !== w.lo || hi !== w.hi;
    w.lo = lo; w.hi = hi;
    return moved;
}

// wi: the world; Wd/st: its look (world.js); low: Low quality. Returns what main.js reads and drives each frame
export function buildStageFx(group, wi, Wd, st, low) {
    const sweepers = [], sliders = [], balls = [], gumZones = [], walls = [], tiles = [], candies = [], blinks = [];
    // (everything stands on the Keyroad's floor, which climbs: shared/world.js floorY)
    const fy = SW.floorY ? (z) => SW.floorY(wi, z) : () => 0, slope = SW.slopeAt ? (z) => SW.slopeAt(wi, z) : () => 0;
    let hasChaser = false;
    for (let k = 0; k < WALLS_N; k++) {
        const P = stagePlan(wi, k);
        for (const o of P.list) {
            if (o.kind === 'sweeper') for (let j = 0; j < (o.bars || 1); j++) sweepers.push({ k, o, off: j * Math.PI / 2 });
            else if (o.kind === 'slider') sliders.push({ k, o, i: sliders.length });
            else if (o.kind === 'boulders') o.lanes.forEach((x, i) => balls.push({ k, o, i, x }));
            else if (o.kind === 'gumballs') gumZones.push({ k, o, list: [] });
            else if (o.kind === 'jwall') walls.push({ k, o, i: o.i, burstAt: -99, wobT: -99, fxAt: -99 });
            else if (o.kind === 'crumble') o.tiles.forEach((t, i) => tiles.push({ k, i, x: t.x, z: t.z, f: fy(t.z), hitAt: -99, state: 0, ci: 0 }));
            else if (o.kind === 'blink') o.rows.forEach((q, ri) => { const n = Math.max(1, Math.round(q.w / BLINK.s)); for (let j = 0; j < n; j++) blinks.push({ k, o, ri, x: q.x - q.w / 2 + BLINK.s * (j + 0.5), z: q.z, f: fy(q.z), ci: 0 }); });
            else if (o.kind === 'chaser') hasChaser = true;
        }
        // (Golden Keys: kept in the list for whoever reads it, never drawn)
        (P.candies || []).forEach((c, i) => candies.push({ k, i, x: c.x, y: c.y, z: c.z, got: false }));
    }
    // (in order down the course, each drawn only near the camera). A wall's keys are the world's first or second colour in turn;
    // a crumbling key mostly the first, now and then the others
    const KC = Wd.keys.map((c) => new T.Color(c));
    walls.forEach((w, i) => { w.c = KC[i % 2]; });
    tiles.forEach((ti) => { const h = hash2(ti.x, ti.z); ti.ci = h < 0.55 ? 0 : h < 0.85 ? 1 : 2; });
    blinks.forEach((b) => { const h = hash2(b.x + 3.1, b.z); b.ci = h < 0.5 ? 0 : h < 0.85 ? 1 : 2; });
    const wBars = windowOf(sweepers, (x) => x.o.z), wSlides = windowOf(sliders, (x) => x.o.z), wBalls = windowOf(balls, (x) => x.o.z), wWalls = windowOf(walls, (x) => x.o.z);
    const wTiles = windowOf(tiles, (x) => x.z), wBlinks = windowOf(blinks, (x) => x.z);
    walls.forEach((w, i) => { w.idx = i; });
    const R_BARS = 300, R_SLIDES = 280, R_BALLS = 480, R_WALLS = 320, R_TILES = 460;
    const mats = [], geos = [], meshes = [];
    const own = (mesh) => { mesh.frustumCulled = false; mesh.matrixAutoUpdate = false; group.add(mesh); meshes.push(mesh); return mesh; };
    const inst = (g, m, n) => { geos.push(g); if (!mats.includes(m)) mats.push(m); const me = own(new T.InstancedMesh(g, m, Math.max(1, n))); me.count = 0; me.castShadow = false; me.instanceMatrix.setUsage(T.DynamicDrawUsage); return me; };
    // ----- the lasers: the sweepers' beams and the sliding laser gates, an opaque core each and (not on Low) the glow round it.
    // (Always built, even with none in this world: their programs are compiled behind the loading screen)
    const lasM = laserMaterial(Wd), glowM = low ? null : laserGlowMaterial(Wd);
    const bars = inst(beamGeo(Wd, low), lasM, sweepers.length), barGlow = glowM ? inst(beamGlowGeo(), glowM, sweepers.length) : null;
    const slideMesh = inst(panelGeo(Wd, low), lasM, sliders.length), slideGlow = null;
    void panelGlowGeo;
    if (barGlow) barGlow.renderOrder = 3;
    if (slideGlow) slideGlow.renderOrder = 3;
    // ----- rolling eyeballs, falling crates, keycap walls: only built in a sector that has them -----
    const ballMesh = balls.length ? inst(ballGeo(Wd, low), nearFade(glowVCMaterial(CU.uNow), 'lde-eyeball', 5, 11), balls.length) : null;
    // (each crate a shade lighter or darker than the next)
    const GUM_MAX = 40;
    let gumMesh = null, shMesh = null, shG = null, shK = null, STONE = null;
    if (gumZones.length) {
        const gumM = new T.MeshLambertMaterial({ vertexColors: true });
        gumM.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.16;'); };
        gumM.customProgramCacheKey = () => 'lde-crate';
        STONE = [1, 0.9, 0.82, 0.96, 0.86, 1, 0.92, 0.78].map((v) => new T.Color(v, v, v));
        gumMesh = inst(boulderGeo(low, Wd), gumM, GUM_MAX);
        gumMesh.setColorAt(0, tc.set(0xffffff));
        shG = new T.CircleGeometry(1, 20).rotateX(-Math.PI / 2); shK = new Float32Array(GUM_MAX);
        shG.setAttribute('aK', new T.InstancedBufferAttribute(shK, 1));
        shMesh = inst(shG, shadowMaterial(), GUM_MAX);
        shMesh.renderOrder = 2;
    }
    // (aBurst: when the wall in each slot was smashed, on the shaders' clock)
    let wallMesh = null, aB = null, aBA = null;
    if (walls.length) {
        const wallG = wallGeo(Wd, low);
        aB = new Float32Array(walls.length).fill(-99); aBA = new T.InstancedBufferAttribute(aB, 1);
        aBA.setUsage(T.DynamicDrawUsage); wallG.setAttribute('aBurst', aBA);
        wallMesh = inst(wallG, keycapMaterial(Wd, 'sbe-kwall', 2.6, true), walls.length);
        wallMesh.setColorAt(0, tc.set(0xffffff));
    }
    const dustC = mixC(Wd.wall, 0xffffff, 0.5);
    // ----- glitch keys (they flicker and glitch out a moment after you step on them) -----
    const tileK = keycapMaterial(Wd, 'sbe-ktile', 3.0, false), tileM = nearFade(tileK, tileK.customProgramCacheKey(), 3, 6), tileMesh = inst(tileGeo(), tileM, tiles.length);
    tileMesh.setColorAt(0, tc.set(0xffffff));
    tileMesh.receiveShadow = !low;
    // the flicker keys: the same keycaps (one draw for a sector's), shaking and flickering cyan and magenta before they go, sinking away,
    // rising back
    const blinkMesh = inst(tileGeo(), tileM, blinks.length), FLASH = new T.Color(0xff2ad8), FLASH2 = new T.Color(0x2af0ff), R_BLINKS = 320;
    blinkMesh.setColorAt(0, tc.set(0xffffff));
    blinkMesh.receiveShadow = !low;
    // the Stretcher (one, for the stages it chases you up); hidden until fx.chaser shows it
    const scorp = hasChaser ? buildScorpion(group, Wd, low) : null;
    const tileAt = (ti, lt) => {
        // a key: still, or pressed down and glitching (jumping about in little steps), glitching out (shrinking in steps, squashing,
        // dropping away), flickering back up
        const u = lt - ti.hitAt;
        let y = 0.2, jx = 0, jz = 0, s = 1, sy = 1;
        const yf = ti.f || 0;
        if (ti.state !== 0) {
            if (u < TILE.shake) { const st = Math.floor(u * 24); y = 0.2 - 0.2 * Math.min(1, u / 0.08); jx = (hash2(st, ti.x) - 0.5) * 0.5; jz = (hash2(ti.z, st + 0.5) - 0.5) * 0.5; }
            else if (u < TILE.shake + 0.7) { const f = u - TILE.shake, st = Math.floor(f * 20); y = -f * f * 22; jx = (hash2(st, ti.x) - 0.5) * 2.2 * f; s = Math.max(0, 1 - Math.floor(f * 9) / 6); sy = st % 2 ? 0.45 : 1; }
            else if (u < TILE.shake + TILE.back) s = 0;
            else if (u < TILE.shake + TILE.back + 0.4) { const f = (u - TILE.shake - TILE.back) / 0.4; y = -1.2 + f * 1.4; s = Math.floor(f * 5) / 5 + 0.2; sy = Math.floor(u * 30) % 2 ? 0.6 : 1; }
        }
        return m4.compose(v3.set(ti.x + jx, y + yf, ti.z + jz), q4.identity(), s3.set(s, s * sy, s));
    };
    const GL1 = new T.Color(0x2af0ff), GL2 = new T.Color(0xff2ad8);
    const tileCol = (ti, lt) => {
        const u = lt - ti.hitAt, base = KC[ti.ci];
        if (ti.state === 0 || (u > TILE.shake + 0.7 && u < TILE.shake + TILE.back)) return base;
        const k = Math.floor(u * 22 + hash2(ti.x, ti.z) * 3) % 3;
        return k === 0 ? base : tc.copy(base).lerp(k === 1 ? GL1 : GL2, 0.7);
    };
    const setN = (m, n) => { if (!m) return; m.count = n; if (n) m.instanceMatrix.needsUpdate = true; };

    const near = (z, camZ, d) => Math.abs(z - camZ) < d;
    let warm = false;
    const fx = {
        sweepers, sliders, balls, gumZones, walls, tiles, candies, slideMesh,
        // the walls you've smashed, the keys you've broken: yours alone; t: your clock (seconds)
        wallUp: (w, t) => t - w.burstAt > 6,
        burst(w, t) {
            w.burstAt = t; w.fxAt = CU.uNow.value;
            if (aB && w.idx >= wWalls.lo && w.idx < wWalls.hi) { aB[w.idx - wWalls.lo] = w.fxAt; aBA.needsUpdate = true; }
            v3.set(0, 3, w.o.z);
            for (let i = 0; i < 4; i++) { v3.x = (i - 1.5) * 8; FX.dust(v3, low ? 2 : 4, 1.6, dustC); FX.splash(v3, Wd.keys[(w.i + i) % 3], low ? 2 : 4, 1.2); }
            v3.set(0, 5, w.o.z); FX.popSpark(v3, Wd.trim);
        },
        bonk(w, t) { w.wobT = t; },
        // a key under you starts to give (it drops TILE.shake later and comes back TILE.back after that)
        touch(ti, t) { if (ti.state === 0) { ti.state = 1; ti.hitAt = t; } },
        tileSolid: (ti, t) => ti.state === 0 || (ti.state === 1 && t - ti.hitAt < TILE.shake),
        // which Golden Keys you've found (kept for old callers: nothing is drawn)
        setCandies(bits) { for (const c of candies) c.got = !!(bits && ((bits[c.k] | 0) & (1 << c.i))); },
        take(c) { if (c) c.got = true; },
        // every frame: t the server's seconds, lt your own clock's, camZ where the camera is along the course
        update(t, lt, camZ) {
            // laser sweepers: each beam turned round its pylon by the server's clock (the hit test in main.js reads the same angle)
            slide(wBars, camZ, R_BARS);
            for (let i = wBars.lo; i < wBars.hi; i++) {
                const s = sweepers[i], a = sweeperAngle(s.o, t) + s.off;
                q4.setFromAxisAngle(T.Object3D.DEFAULT_UP, a);
                m4.compose(v3.set(s.o.x, SWEEP.y + (s.f ?? (s.f = fy(s.o.z))), s.o.z), q4, s3.set(1, 1, 1));
                bars.setMatrixAt(i - wBars.lo, m4);
                if (barGlow) barGlow.setMatrixAt(i - wBars.lo, m4);
            }
            setN(bars, wBars.hi - wBars.lo); setN(barGlow, wBars.hi - wBars.lo);
            // sliding laser gates: wall to wall on the server's clock (sliderAt: the same as the hit test)
            slide(wSlides, camZ, R_SLIDES);
            for (let i = wSlides.lo; i < wSlides.hi; i++) {
                const s = sliders[i];
                m4.makeTranslation(sliderAt(s.o, t), s.f ?? (s.f = fy(s.o.z)), s.o.z);
                slideMesh.setMatrixAt(i - wSlides.lo, m4);
                if (slideGlow) slideGlow.setMatrixAt(i - wSlides.lo, m4);
            }
            setN(slideMesh, wSlides.hi - wSlides.lo); setN(slideGlow, wSlides.hi - wSlides.lo);
            if (ballMesh) {
                slide(wBalls, camZ, R_BALLS);
                for (let i = wBalls.lo; i < wBalls.hi; i++) {
                    const b = balls[i], z = ballZ(b.o, b.i, t), sl = slope(z), roll = z * Math.sqrt(1 + sl * sl) / BALL.r;
                    q4.setFromEuler(e3.set(roll, 0, 0));
                    // an eyeball rolls up out of the floor at the far end to full size where it can hit you;
                    // out past the near end it sinks away into the floor
                    const grow = Math.max(0.12, Math.min(1, (z - b.o.z0 + 12) / 10)), sink = Math.max(0, z - b.o.z1) * 0.6;
                    // (down the hill: on the floor where it is)
                    m4.compose(v3.set(b.x, fy(z) + BALL.r * grow * Math.sqrt(1 + sl * sl) - Math.min(BALL.r * 2.2, sink), z), q4, s3.set(grow, grow, grow));
                    ballMesh.setMatrixAt(i - wBalls.lo, m4);
                }
                setN(ballMesh, wBalls.hi - wBalls.lo);
            }
            // crates: falling from the ceiling once their shadow has grown, tumbling; a thud, a little hop, then down into the floor
            if (gumMesh) {
                let n = 0;
                for (const zn of gumZones) {
                    if (!near(zn.o.z, camZ, 220)) continue;
                    gumballsAt(zn.o, t, zn.list);
                    for (const d of zn.list) {
                        if (n >= GUM_MAX) break;
                        const u = t - d.t0, land = GUM.warn + GUM.fall, ur = Math.min(u, land) - GUM.warn;
                        let y;
                        if (u < GUM.warn) y = 60; else if (u < land) { const f = (u - GUM.warn) / GUM.fall; y = CRATE + (1 - f * f) * 56; } else { const f = u - land; y = CRATE + Math.abs(Math.sin(f * 9)) * 1.2 * Math.exp(-f * 6) - Math.max(0, f - 0.35) * 9; }
                        const vis = u >= GUM.warn - 0.25 && u < land + 0.65 ? 1 : 0;
                        // tumbling as it falls, square on the floor once it lands
                        if (u < land) q4.setFromEuler(e3.set(ur * 5 + (d.s % 7), ur * 3, (d.s % 5) * 0.7)); else q4.setFromEuler(e3.set(0, (d.s % 4) * 0.4, 0));
                        const fd = fy(d.z);
                        m4.compose(v3.set(d.x, y + fd, d.z), q4, s3.set(vis, vis, vis));
                        gumMesh.setMatrixAt(n, m4); gumMesh.setColorAt(n, STONE[d.c]);
                        const k = u < land ? Math.min(1, u / land) : Math.max(0, 1 - (u - land) * 2.5), r = GUM.hit * (0.55 + 0.45 * Math.min(1, u / land));
                        m4.makeScale(r, 1, r).setPosition(d.x, fd + 0.08, d.z);
                        shMesh.setMatrixAt(n, m4); shK[n] = k;
                        n++;
                    }
                }
                gumMesh.count = n; shMesh.count = n;
                if (n) { gumMesh.instanceMatrix.needsUpdate = true; gumMesh.instanceColor.needsUpdate = true; shMesh.instanceMatrix.needsUpdate = true; shG.attributes.aK.needsUpdate = true; }
            }
            // keycap walls: standing (rattling just after you bounce off), smashed (its keys flying, in the shader), gone, growing back
            if (wallMesh) {
                if (slide(wWalls, camZ, R_WALLS)) {
                    for (let i = wWalls.lo; i < wWalls.hi; i++) { wallMesh.setColorAt(i - wWalls.lo, walls[i].c); aB[i - wWalls.lo] = walls[i].fxAt; }
                    if (wallMesh.instanceColor) wallMesh.instanceColor.needsUpdate = true;
                    aBA.needsUpdate = true;
                }
                for (let i = wWalls.lo; i < wWalls.hi; i++) {
                    const w = walls[i], since = lt - w.burstAt, up = since > 6, back = Math.min(1, Math.max(0, (since - 6) * 3)), wob = Math.max(0, 1 - (lt - w.wobT) * 1.5);
                    // (with the camera in it, it's not drawn: no see-through dither in its shader, so the nearest wall hides the ones
                    // behind it before they're shaded; while its keys fly it's drawn whole, the shader moving them)
                    const k = since >= 0 && since < FLY + 0.1 ? 1 : up && Math.abs(w.o.z - camZ) > JWALL.d / 2 + 3 ? (w.burstAt > 0 ? back : 1) : 0, sq = 1 + Math.sin(lt * 24) * 0.05 * wob;
                    m4.compose(v3.set(Math.sin(lt * 31) * 0.25 * wob, w.f ?? (w.f = fy(w.o.z)), w.o.z), q4.identity(), s3.set(k, k * sq, k));
                    wallMesh.setMatrixAt(i - wWalls.lo, m4);
                }
                setN(wallMesh, wWalls.hi - wWalls.lo);
            }
            // crumbling keys: a broken one comes back after a while (wherever the camera is); the ones near it drawn, still or moving
            for (const ti of tiles) if (ti.state !== 0 && lt - ti.hitAt >= TILE.shake + TILE.back + 0.4) ti.state = 0;
            const tMoved = slide(wTiles, camZ, R_TILES);
            let tAny = tMoved;
            if (tMoved) { for (let i = wTiles.lo; i < wTiles.hi; i++) tileMesh.setColorAt(i - wTiles.lo, KC[tiles[i].ci]); if (tileMesh.instanceColor) tileMesh.instanceColor.needsUpdate = true; }
            let cAny = false;
            for (let i = wTiles.lo; i < wTiles.hi; i++) {
                const ti = tiles[i];
                if (!tMoved && ti.state === 0 && !ti.moved) continue;
                tileMesh.setMatrixAt(i - wTiles.lo, tileAt(ti, lt)); tAny = true;
                if (ti.state !== 0 || ti.moved) { tileMesh.setColorAt(i - wTiles.lo, tileCol(ti, lt)); cAny = true; }
                ti.moved = ti.state !== 0;
            }
            tileMesh.count = wTiles.hi - wTiles.lo;
            if (tAny && tileMesh.count) tileMesh.instanceMatrix.needsUpdate = true;
            if (cAny && tileMesh.instanceColor) tileMesh.instanceColor.needsUpdate = true;
            // flicker keys: each row there, shaking and flickering as the wave comes, gone (sunk away) while it goes through, back up after
            if (blinks.length) {
                const bMoved = slide(wBlinks, camZ, R_BLINKS);
                for (let i = wBlinks.lo; i < wBlinks.hi; i++) {
                    const b = blinks[i], u = blinkPhase(b.o, b.ri, t), on = u < b.o.on;
                    let y = b.f + 0.2, sc = 1, rx = 0, rz = 0, fl = 0;
                    if (on) {
                        if (u < 0.22) { const k2 = u / 0.22; y -= 2.4 * (1 - k2); sc = k2; }
                        if (u > b.o.on - BLINK.warn) { const w2 = (u - (b.o.on - BLINK.warn)) / BLINK.warn; rx = Math.sin(lt * 71 + b.x) * 0.07 * w2; rz = Math.cos(lt * 57 + b.z) * 0.07 * w2; fl = w2; y -= 0.15 * w2; if (Math.floor(lt * 30 + b.z) % 3 === 0) sc *= 0.9; }
                    } else { const v = u - b.o.on; y -= Math.min(3, v * 14); sc = Math.max(0, 1 - v * 5); }
                    q4.setFromEuler(e3.set(rx, 0, rz));
                    blinkMesh.setMatrixAt(i - wBlinks.lo, m4.compose(v3.set(b.x, y, b.z), q4, s3.set(sc, sc, sc)));
                    blinkMesh.setColorAt(i - wBlinks.lo, tc.copy(KC[b.ci]).lerp((Math.floor(lt * 18 + b.x * 0.3) & 1) ? FLASH : FLASH2, fl * 0.8));
                }
                blinkMesh.count = wBlinks.hi - wBlinks.lo;
                if (blinkMesh.count) { blinkMesh.instanceMatrix.needsUpdate = true; if (blinkMesh.instanceColor) blinkMesh.instanceColor.needsUpdate = true; }
                void bMoved;
            }
            for (const m of meshes) m.visible = warm || m.count > 0;
        },
        // the Stretcher: on, where its reach is (x, y on the floor, z), its facing (0 north), the time, and what it's doing
        // ('burst' rising out of the floor, 'run', 'bite'); off: hidden
        chaser(on, x, y, z, ry, t, mode) { if (scorp) scorp.set(on, x, y, z, ry, t, mode); },
        scorpion: () => scorp,
        showAll(on) { warm = !!on; for (const m of meshes) m.visible = warm || m.count > 0; if (scorp) scorp.warm(warm); },
        dispose() { for (const m of meshes) { group.remove(m); m.dispose(); } for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); if (scorp) scorp.dispose(); },
    };
    fx.update(CU.uNow.value, 0, 0);
    return fx;
}
// where the rolling eyeballs of a stage are now (for the keycap floor: they press the keys down as they go): calls fn(x, z) for each
export function eachBall(fx, t, k, fn) { for (const b of fx.balls) if (b.k === k) fn(b.x, ballZ(b.o, b.i, t)); }
