import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const T = THREE;
export const V3 = THREE.Vector3;
const elCache = new Map();
export const $ = (s) => { let e = elCache.get(s); if (!e || !e.isConnected) { e = document.querySelector(s); if (e && /^#[\w-]+$/.test(s)) elCache.set(s, e); } return e; };
export const hexCss = (h) => '#' + h.toString(16).padStart(6, '0');

// ----- the graphics chip -----
// Its name, read once from a throwaway context before the game's own exists (asking the game's context
// later makes it wait for the GPU)
export const GPU_NAME = (() => {
    try {
        const c = document.createElement('canvas'), gl = c.getContext('webgl2', { powerPreference: 'high-performance' }) || c.getContext('webgl');
        if (!gl) return '';
        const x = gl.getExtension('WEBGL_debug_renderer_info'), name = String(x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
        const lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
        return name;
    } catch (e) { return ''; }
})();
// software renderers, older integrated chips and phone chips (they start on Low)
export function weakGPUName(name) {
    name = String(name || '').toLowerCase();
    if (/swiftshader|llvmpipe|softpipe|software|basic render|mali|adreno|powervr|videocore/.test(name)) return true;
    // Intel's older integrated chips (HD Graphics, Iris before Xe, UHD 6xx) and AMD's small Vega / R-series ones
    if (/intel/.test(name) && /(^|[^u])hd graphics|iris\(r\) (plus|pro)?\s*graphics [0-9]|iris graphics|uhd graphics 6\d\d/.test(name)) return true;
    if (/radeon\(tm\) (r[2-5]|vega [3-8])\b|radeon r[2-5] graphics/.test(name)) return true;
    return false;
}
// a graphics chip that shares the computer's memory (Intel's, AMD's APUs): fine for the game, but every pixel
// counts, so Medium draws at the window's own pixel size rather than the screen's scaled-up one
export const INTEGRATED_GPU = /intel|radeon\(tm\) graphics|radeon graphics|vega \d+ graphics/i.test(GPU_NAME);
export const WEAK_PC = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
const TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
// The quality the game starts on: your choice in Settings, else Low on phones and weak PCs (fx.js)
export const START_QUALITY = (() => {
    let q = '';
    try { q = localStorage.getItem('lde1_quality') || ''; } catch (e) { /* none saved */ }
    return q || (TOUCH || WEAK_PC || weakGPUName(GPU_NAME) ? 'low' : 'medium');
})();

// ----- renderer, scene, camera, lights -----
export const canvas = $('#view');
// A PC or laptop starting on Low draws without multisampling: on an old integrated chip it costs a fifth
// or more of the frame. (It can only be chosen when the context is made.) A phone keeps it: Low already
// draws a phone's screen at a low resolution.
export const renderer = new T.WebGLRenderer({ canvas, antialias: TOUCH || START_QUALITY !== 'low', powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
renderer.shadowMap.enabled = true;
// Shader error checks cost extra blocking GPU calls per shader; only in development
renderer.debug.checkShaderErrors = import.meta.env.DEV || !!import.meta.env.VITE_QA;
// PCFShadowMap: three r186 removed PCFSoft and switches it at the first shadow frame, which
// recompiles every material at once (a long freeze when the game starts)
renderer.shadowMap.type = T.PCFShadowMap;
renderer.toneMapping = T.NoToneMapping;

export const scene = new T.Scene();
// the far haze: things a long way down the Keyline fade into the sector's air (colour and distance follow the mood)
scene.fog = new T.Fog(0xdceaf2, 300, 1300);
scene.background = new T.Color(0x2a8ae8);

// ----- sky: the sky over Site K, all in one dome that follows the camera and is drawn last. A gradient from the hazy glow round the
// horizon up to the zenith, fat cartoon clouds drifting over (painted from one small tiling texture of soft blobs: bright tops, shaded
// bellies; at night in the Void Wing the same sheet tinted violet: a nebula), the sun's disc and glare; at night stars and a great
// glowing planet. Only uniforms change, never the shader.
function cloudTile() {
    const N = 512, c = document.createElement('canvas'); c.width = c.height = N;
    const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, N, N);
    let s = 7;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const blob = (cx, cy, r, a) => {
        for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
            const px = cx + ox, py = cy + oy;
            if (px + r < 0 || px - r > N || py + r < 0 || py - r > N) continue;
            const g = x.createRadialGradient(px, py, r * 0.1, px, py, r);
            g.addColorStop(0, 'rgba(255,255,255,' + a + ')'); g.addColorStop(0.55, 'rgba(255,255,255,' + (a * 0.6) + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
            x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
        }
    };
    // clusters of puffs (a cloud each), wider than tall
    for (let k = 0; k < 26; k++) {
        const cx = rnd() * N, cy = rnd() * N, R = 26 + rnd() * 40;
        for (let j = 0; j < 9; j++) blob(cx + (rnd() - 0.5) * R * 2.6, cy + (rnd() - 0.5) * R * 0.9, R * (0.4 + rnd() * 0.6), 0.32 + rnd() * 0.3);
    }
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.colorSpace = T.NoColorSpace;
    t.generateMipmaps = true;
    t.anisotropy = 4;
    return t;
}
// the sun: high behind your right shoulder as you run north
const SUN_DIR = new T.Vector3(0.55, 0.68, 0.48).normalize();
const skyU = {
    uTime: { value: 0 }, uSun: { value: SUN_DIR }, uNoise: { value: cloudTile() }, uLow: { value: 0 },
    uZen: { value: new T.Color() }, uHor: { value: new T.Color() }, uNad: { value: new T.Color() },
    // the clouds: their lit tops, their shaded bellies, how much of the sky they cover; the stars; the sun disc's strength and colour
    uCloA: { value: new T.Color() }, uCloB: { value: new T.Color() }, uCloK: { value: 0.5 }, uStarK: { value: 0 }, uSunK: { value: 1 }, uSunC: { value: new T.Color() },
    // a moon: where, the tangent of its radius, its colour, how much it glows round it
    uMD: { value: new T.Vector3(0, 1, 0) }, uMR: { value: 0 }, uMC: { value: new T.Color() }, uMG: { value: 0 },
};
const skyMat = new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false, toneMapped: false,
    uniforms: skyU,
    vertexShader: `varying vec3 vDir;
        void main() { vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uSun; uniform sampler2D uNoise; uniform float uLow;
        uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uNad; uniform vec3 uCloA; uniform vec3 uCloB; uniform float uCloK; uniform float uStarK; uniform float uSunK; uniform vec3 uSunC;
        uniform vec3 uMD; uniform float uMR; uniform vec3 uMC; uniform float uMG;
        varying vec3 vDir;
        float hash3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        void main() {
            vec3 d = normalize(vDir);
            float h = d.y;
            // the hazy glow round the horizon, deeper up to the zenith; under the horizon the haze over the grounds
            vec3 col = h > 0.0 ? mix(uHor, uZen, pow(min(1.0, h * 1.25), 0.62)) : mix(uHor, uNad, min(1.0, -h * 6.0));
            // the sun's warm glow low in the sky towards it
            float s = max(dot(d, uSun), 0.0);
            col += uSunC * (pow(s, 6.0) * 0.16 + pow(s, 40.0) * 0.18) * uSunK;
            // stars (night only): a layer of big soft ones that twinkle, a layer of fine dust (not on Low)
            if (uStarK > 0.01 && h > -0.02) {
                vec3 sp = d * 110.0, sc = floor(sp); float sh = hash3(sc);
                if (sh > 0.955) {
                    float tw = 0.72 + 0.28 * sin(uTime * (1.5 + sh * 3.0) + sh * 90.0);
                    col += mix(vec3(1.0, 0.92, 0.8), vec3(0.75, 0.88, 1.0), fract(sh * 37.0)) * smoothstep(0.36, 0.0, length(fract(sp) - 0.5)) * tw * uStarK * 1.2 * smoothstep(-0.02, 0.25, h);
                }
                if (uLow < 0.5) {
                    vec3 sp2 = d * 260.0, sc2 = floor(sp2); float sh2 = hash3(sc2);
                    if (sh2 > 0.972) col += vec3(0.9, 0.94, 1.0) * smoothstep(0.42, 0.0, length(fract(sp2) - 0.5)) * uStarK * 0.7 * smoothstep(0.0, 0.3, h);
                }
            }
            // the moon: a lit ball, a glow round it
            float mc = dot(d, uMD);
            if (uMR > 0.0 && mc > 0.0) {
                vec3 mq = d / mc - uMD; float mr = length(mq) / uMR;
                col += uMC * exp(-max(0.0, mr - 1.0) * 1.6) * uMG * 0.35;
                if (mr < 1.0) {
                    float crat = textureLod(uNoise, mq.xy / uMR * 0.11 + 0.4, 0.0).r;
                    vec3 mn = normalize(mq / uMR - uMD * sqrt(1.0 - mr * mr));
                    float ml = 0.55 + 0.45 * smoothstep(-0.3, 0.6, dot(mn, normalize(vec3(-0.5, 0.6, 0.6))));
                    col = mix(col, uMC * (0.86 + 0.22 * crat) * ml, smoothstep(1.0, 0.94, mr));
                }
            }
            // the clouds: on a sheet over the sky (bigger towards the zenith, smaller and flatter near the horizon), drifting
            if (h > 0.0 && uCloK > 0.01) {
                vec2 cuv = d.xz / (h + 0.18) * 0.16 + vec2(uTime * 0.004, uTime * 0.0016);
                vec2 gx = dFdx(cuv), gy = dFdy(cuv);
                float n1 = textureGrad(uNoise, cuv, gx, gy).r, n2 = 0.55;
                if (uLow < 0.5) n2 = textureGrad(uNoise, cuv * 2.3 + vec2(0.37, 0.11), gx * 2.3, gy * 2.3).r;
                float dens = n1 * (0.62 + 0.6 * n2) + (uCloK - 0.5) * 0.5;
                float cov = smoothstep(0.42, 0.62, dens) * smoothstep(0.02, 0.16, h);
                // the bellies shaded, the tops lit (by how far into the cloud: the edges are its top here), a rim of sun through it
                float body = smoothstep(0.5, 0.95, dens);
                vec3 cc = mix(uCloA, uCloB, body * 0.75);
                cc += uSunC * pow(s, 8.0) * 0.25 * (1.0 - body);
                col = mix(col, cc, cov * 0.96);
            }
            // the sun: a white-hot disc and its glare (over the clouds)
            col += uSunC * (pow(s, 2200.0) * 2.4 + pow(s, 160.0) * 0.35) * uSunK;
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
        }`,
});
const skyDome = new T.Mesh(new T.SphereGeometry(4000, 32, 16), skyMat);
// drawn after everything solid, on the far plane (xyww) with the depth test on: only the pixels where the
// sky actually shows run its shader, not the whole screen
skyDome.renderOrder = 100;
// QA only (__qa.legacy): the sky drawn first over the whole screen, to measure against
export function skyLegacy(on) { skyDome.renderOrder = on ? -10 : 100; skyMat.depthTest = !on; }
skyDome.frustumCulled = false;
scene.add(skyDome);
// (Low: one layer of cloud and of stars; set by fx.js with the quality)
export function skyLow(on) { skyU.uLow.value = on ? 1 : 0; }
export const SUN_DIRECTION = SUN_DIR;

// ----- the grounds round Site K: concrete yards out to the facility's fences, flat round the Atrium and along the Keyline (just under
// the course's floor), rising into rolling hills the further out it goes (grass in Hazard Halls, bio-moss in the Bio Lab, snow in the
// Cryo Vault, dark rock in the Void Wing). One grid that follows the camera, its inner part on a fixed lattice (it steps with the
// camera, never swims), its outer rings stretching out to the haze; its height and its slopes worked out in the vertex shader.
// Lambert: lit like everything else, the sun's shadows on it close by -----
export const GROUND_Y = -1.3;
// (uSand: the yards' concrete, uSand2: the land beyond, uDune: how high its hills roll)
const groundU = { uSand: { value: new T.Color(0xd8d6cc) }, uSand2: { value: new T.Color(0x86c85a) }, uDune: { value: 1 }, uGO: { value: new T.Vector2() } };
const GROUND_GLSL = `
uniform vec2 uGO; uniform float uDune;
// how far out of the flat ground round the Atrium (x -132..132, z -2..160) and along the Keyline and the race course (x -50..50, north of z 40)
float gOut(vec2 p) {
    float ax = abs(p.x);
    float dC = p.y < 40.0 ? max(0.0, ax - 50.0) : 1e4;
    vec2 q = vec2(ax - 132.0, max(-2.0 - p.y, p.y - 160.0));
    float dP = length(max(q, 0.0));
    return min(dC, dP);
}
float gH(vec2 p) {
    float d = gOut(p), k = smoothstep(0.0, 90.0, d);
    float dn = sin(p.x * 0.021 + sin(p.y * 0.013) * 2.2) * 0.5 + 0.5;
    dn = dn * dn * (0.7 + 0.3 * sin(p.y * 0.031 + p.x * 0.007));
    float big = sin(p.x * 0.0061 + 1.3) * sin(p.y * 0.0047 + 0.4) * 0.5 + 0.5;
    return ${GROUND_Y.toFixed(2)} + k * (1.8 + (dn * (5.0 + d * 0.03) + big * min(40.0, d * 0.07)) * uDune);
}`;
function groundGeo(N, M, S, R) {
    // index -N..N each way: uniform spacing S out to M, then stretching out to R
    const B = (R - S * N) / ((N - M) * (N - M)), f = (i) => { const a = Math.abs(i), sg = Math.sign(i); return sg * (a <= M ? a * S : S * a + B * (a - M) * (a - M)); };
    const n = 2 * N + 1, pos = new Float32Array(n * n * 3), idx = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const o = (j * n + i) * 3; pos[o] = f(i - N); pos[o + 1] = 0; pos[o + 2] = f(j - N); }
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const a = j * n + i, b = a + 1, c = a + n, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.BufferAttribute(new Float32Array(n * n * 3).fill(0), 3));
    g.setIndex(idx);
    g.boundingSphere = new T.Sphere(new T.Vector3(), R * 1.5);
    return g;
}
const GROUND_LOW = START_QUALITY === 'low', GROUND_S = GROUND_LOW ? 12 : 8;
const groundMat = new T.MeshLambertMaterial({ color: 0xffffff });
groundMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, groundU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + GROUND_GLSL + '\nvarying vec3 vGW; varying float vGK;')
        .replace('#include <beginnormal_vertex>', `vec2 gp = position.xz + uGO;
float gh = gH(gp), ge = 2.5;
vec3 objectNormal = normalize(vec3(gH(gp - vec2(ge, 0.0)) - gH(gp + vec2(ge, 0.0)), 2.0 * ge, gH(gp - vec2(0.0, ge)) - gH(gp + vec2(0.0, ge))));
#ifdef USE_TANGENT
vec3 objectTangent = vec3(1.0, 0.0, 0.0);
#endif`)
        .replace('#include <begin_vertex>', 'vec3 transformed = vec3(position.x, gh, position.z);\nvGW = vec3(gp.x, gh, gp.y); vGK = smoothstep(0.0, 40.0, gOut(gp));');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uSand; uniform vec3 uSand2; varying vec3 vGW; varying float vGK;')
        .replace('#include <color_fragment>', `#include <color_fragment>
// near: concrete yard slabs (seams every 16 studs, each slab its own tone, a painted line now and then); out on the hills: the land,
// two tones in broad patches, speckled close up, a little darker in the hollows
vec2 cell = floor(vGW.xz / 16.0), sg = abs(fract(vGW.xz / 16.0) - 0.5);
float ch = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
float seam = smoothstep(0.475, 0.495, max(sg.x, sg.y)) * (1.0 - smoothstep(60.0, 220.0, length(vViewPosition)));
vec3 yard = uSand * (0.93 + 0.08 * ch) * (1.0 - 0.22 * seam);
float stripe = step(0.985, fract(vGW.x * 0.0125 + 0.5)) * step(0.5, fract(vGW.z * 0.025));
yard = mix(yard, vec3(1.0, 0.82, 0.18), stripe * 0.75 * (1.0 - vGK));
float gn = sin(vGW.x * 0.045 + sin(vGW.z * 0.03) * 1.7) * sin(vGW.z * 0.037 - vGW.x * 0.011);
vec3 land = uSand2 * (0.88 + 0.16 * gn);
float sp = fract(sin(dot(floor(vGW.xz * 1.3), vec2(27.1, 61.7))) * 9137.31);
land *= 1.0 - 0.07 * step(0.7, sp) * (1.0 - smoothstep(30.0, 120.0, length(vViewPosition)));
land = mix(land * 0.88, land, smoothstep(-1.3, 6.0, vGW.y));
vec3 sand = mix(yard, land, smoothstep(0.15, 0.6, vGK));
diffuseColor.rgb = sand;`)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.06;');
};
groundMat.customProgramCacheKey = () => 'lde-ground';
const ground = new T.Mesh(groundGeo(GROUND_LOW ? 30 : 42, GROUND_LOW ? 16 : 24, GROUND_S, 2200), groundMat);
ground.frustumCulled = false; ground.receiveShadow = true; ground.castShadow = false; ground.renderOrder = -1;
ground.matrixAutoUpdate = false;
scene.add(ground);
// the ground follows the camera in steps of its lattice
function placeGround(pos) {
    const gx = Math.round(pos.x / GROUND_S) * GROUND_S, gz = Math.round(pos.z / GROUND_S) * GROUND_S;
    if (gx === groundU.uGO.value.x && gz === groundU.uGO.value.y && ground.userData.placed) return;
    ground.userData.placed = true;
    groundU.uGO.value.set(gx, gz);
    ground.position.set(gx, 0, gz); ground.updateMatrix(); ground.updateMatrixWorld();
}
// the ground's height at x, z (the same formula as its shader, for whoever puts things on it)
export function groundAt(x, z) {
    const ax = Math.abs(x), dC = z < 40 ? Math.max(0, ax - 50) : 1e4, qx = Math.max(0, ax - 132), qz = Math.max(0, Math.max(-2 - z, z - 160)), d = Math.min(dC, Math.hypot(qx, qz));
    const sm = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
    const k = sm(0, 90, d);
    let dn = Math.sin(x * 0.021 + Math.sin(z * 0.013) * 2.2) * 0.5 + 0.5;
    dn = dn * dn * (0.7 + 0.3 * Math.sin(z * 0.031 + x * 0.007));
    const big = Math.sin(x * 0.0061 + 1.3) * Math.sin(z * 0.0047 + 0.4) * 0.5 + 0.5;
    return GROUND_Y + k * (1.8 + (dn * (5 + d * 0.03) + big * Math.min(40, d * 0.07)) * groundU.uDune.value);
}

// (near at 0.8, not 0.5: the depth buffer's precision far off is 1.6 times better, so faces close together don't flicker down the road)
export const camera = new T.PerspectiveCamera(70, 1, 0.8, 4200);
// the window's size, read only when it changes: reading innerWidth/innerHeight in the frame loop can force the page to lay itself out
// again right after the HUD changed a number (every step now)
export const VIEW = { w: innerWidth, h: innerHeight, portrait: innerWidth < innerHeight };
function resize() {
    const w = innerWidth, h = innerHeight;
    VIEW.w = w; VIEW.h = h; VIEW.portrait = w < h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 85 : 70;
    camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// No image-based environment map, no reflections: building one (PMREM blur shaders) froze slow PCs
// for seconds at load. A sky / ground hemisphere light gives the soft fill, the sun adds direction
// and crisp shadows on top, and a little ambient keeps the shade from going dull.
export const hemi = new T.HemisphereLight(0xeaf4ff, 0xd6d0a8, 1.1);
export const ambient = new T.AmbientLight(0xffffff, 0.45);
scene.add(hemi, ambient);
export const sun = new T.DirectionalLight(0xfff4ea, 1.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 1, far: 420 });
sun.shadow.bias = -0.0008;
sun.shadow.normalBias = 0.04;
sun.shadow.radius = 2;
scene.add(sun, sun.target);

// ----- moods: each sector's sky, haze, grounds and light colours. The light rig itself is the top games' (hemisphere 1.1, ambient
// 0.45, sun 1.5) everywhere, so the keys and the runners are bright and readable; a mood only tints it. -----
// [zenith, horizon, under the horizon, cloud tops, cloud bellies, cloud cover, fog, hemi sky, hemi ground (the floor's bounce), sun
// colour, fog near, fog far, stars, sun disc, yard concrete, the land beyond, hills, night (0 day .. 1 night), moon: [x, y, z, tan r,
// colour, glow]]
const M = (zen, hor, nad, cloA, cloB, cloK, fog, sky, ground, sunC, near, far, starK, sunK, sand, sand2, dune, night, moon) => ({ zen, hor, nad, cloA, cloB, cloK, fog, sky, ground, sun: sunC, near, far, starK, sunK, sand, sand2, dune, night, moon, hemi: 1.1, sunI: 1.5, amb: 0.45 });
export const MOODS = {
    // Hazard Halls: a bright, clear blue day, big puffy clouds, fresh green grass past the yards, crisp noon light
    hazard: M(0x2a86f0, 0xcfeaf8, 0xd8e6ea, 0xffffff, 0xc8d8ec, 0.5, 0xdceaf2, 0xeaf4ff, 0xd6d0a8, 0xfff6e6, 320, 1350, 0, 1, 0xd8d6cc, 0x86c85a, 0.7, 0, null),
    // Bio Lab: a candy-pink sunset, violet up high, rosy clouds, a pale moon rising, lavender bio-moss on the hills
    biolab: M(0x6a58d8, 0xffb4d4, 0xe8b8d0, 0xfff0f8, 0xe890c0, 0.5, 0xf4c6dc, 0xfff0f8, 0xe0a8c8, 0xffe2da, 280, 1250, 0, 1.05, 0xe8dce4, 0xc898d8, 0.9, 0, [0.42, 0.3, -0.86, 0.06, 0xfff0fa, 0.3]),
    // Cryo Vault: a pale icy haze, a soft cold sun, thick white clouds, snow on the hills
    cryo: M(0x5aa8e8, 0xe8f6ff, 0xeef6fa, 0xffffff, 0xd4e4f2, 0.62, 0xe8f2fa, 0xf0f8ff, 0xd8e8f4, 0xf4f8ff, 260, 1200, 0, 0.8, 0xe4eef4, 0xf6faff, 1.1, 0, null),
    // The Void Wing: a deep violet night, stars, a violet nebula drifting over, a great glowing planet, dark rock hills
    void: M(0x080620, 0x3a1e6a, 0x1e143c, 0x9a5ad8, 0x3a1a6a, 0.42, 0x2e1e58, 0xb4a4f0, 0x5a4a9a, 0xc8c0ff, 260, 1150, 1.3, 0.0, 0x4a3e72, 0x2e2452, 1.1, 0.6, [-0.32, 0.42, -0.85, 0.11, 0xd8f4ff, 1]),
};
const moodNow = { zen: new T.Color(), hor: new T.Color(), nad: new T.Color(), cloA: new T.Color(), cloB: new T.Color(), fog: new T.Color(), sky: new T.Color(), ground: new T.Color(), sunC: new T.Color(), sand: new T.Color(), sand2: new T.Color(), hemi: 1.1, sunI: 1.5, amb: 0.45, night: 0, near: 140, far: 520, cloK: 0.5, starK: 0, sunK: 1, dune: 1 };
let moodName = 'hazard', moodK = 1, fogK = 1;
const tmpMood = new T.Color();
function applyMood(m, k) {
    for (const key of ['zen', 'hor', 'nad', 'cloA', 'cloB', 'fog', 'sky', 'ground', 'sand', 'sand2']) moodNow[key].lerp(tmpMood.set(m[key]), k);
    moodNow.sunC.lerp(tmpMood.set(m.sun), k);
    for (const key of ['hemi', 'sunI', 'amb', 'near', 'far', 'cloK', 'starK', 'sunK', 'night', 'dune']) moodNow[key] += (m[key] - moodNow[key]) * k;
    skyU.uZen.value.copy(moodNow.zen); skyU.uHor.value.copy(moodNow.hor); skyU.uNad.value.copy(moodNow.nad);
    skyU.uCloA.value.copy(moodNow.cloA); skyU.uCloB.value.copy(moodNow.cloB); skyU.uCloK.value = moodNow.cloK; skyU.uStarK.value = moodNow.starK;
    skyU.uSunK.value = moodNow.sunK; skyU.uSunC.value.copy(moodNow.sunC);
    groundU.uSand.value.copy(moodNow.sand); groundU.uSand2.value.copy(moodNow.sand2); groundU.uDune.value = moodNow.dune;
    scene.fog.color.copy(moodNow.fog); scene.fog.near = moodNow.near * fogK; scene.fog.far = moodNow.far * fogK;
    scene.background.copy(moodNow.zen);
    hemi.color.copy(moodNow.sky); hemi.groundColor.copy(moodNow.ground); hemi.intensity = moodNow.hemi;
    sun.color.copy(moodNow.sunC); sun.intensity = moodNow.sunI; ambient.intensity = moodNow.amb;
}
// the sector's moon: set at once (a sector changes behind a fade)
function applyMoon(m) {
    const mo = m.moon;
    skyU.uMR.value = mo ? mo[3] : 0;
    if (mo) { skyU.uMD.value.set(mo[0], mo[1], mo[2]).normalize(); skyU.uMC.value.set(mo[4]); skyU.uMG.value = mo[5] || 0; }
}
applyMood(MOODS.hazard, 1); applyMoon(MOODS.hazard);
// how far the haze reaches
export function setFogScale(k) { fogK = k || 1; scene.fog.near = moodNow.near * fogK; scene.fog.far = moodNow.far * fogK; }
// Fades the sky and the light to a mood over a second or so (instantly when it loads)
export function setMood(name, now) {
    if (!MOODS[name]) name = 'hazard';
    applyMoon(MOODS[name]);
    if (now) { moodName = name; moodK = 1; applyMood(MOODS[name], 1); return; }
    if (name !== moodName) { moodName = name; moodK = 0; }
}
export const moodFar = () => moodNow.far;
// how dark it is (0 day .. 1 night): bright days, and the Void Wing's night
export const nightLevel = () => moodNow.night;
export function updateSky(pos, t, dt) {
    skyU.uTime.value = t;
    skyDome.position.copy(pos);
    placeGround(pos);
    if (moodK < 1) {
        moodK = Math.min(1, moodK + (dt || 0.016) * 0.9);
        applyMood(MOODS[moodName], moodK >= 1 ? 1 : Math.min(1, (dt || 0.016) * 3));
    }
}

// ----- materials & textures -----
export const UNIT = new T.BoxGeometry(1, 1, 1);
// Glowing parts are drawn unlit and a little brighter than their colour (there is no bloom)
export const NEON_BOOST = 1.25;
const matCache = new Map();
// The bright, soft Roblox look under the top games' light rig (the lights stay hemisphere
// 1.1, ambient 0.45, sun 1.5): every lit surface also gives back a share of its own colour, so the
// colours come out saturated and the shade never goes dull.
export const SELF_LIT = 0.3;
export const SELF_LIT_GLSL = '\ntotalEmissiveRadiance += diffuseColor.rgb * ' + SELF_LIT.toFixed(2) + ';';
export function selfLit(m) {
    if (m.userData.selfLit) return m;
    m.userData.selfLit = true;
    const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey.call(m);
    m.onBeforeCompile = (sh, r) => {
        prev.call(m, sh, r);
        sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>' + SELF_LIT_GLSL);
    };
    // its own program key: the wrapper's source is the same for every material it wraps
    m.customProgramCacheKey = () => prevKey + '|sl';
    return m;
}
// Matte, non-reflective plastic (Lambert): cheap to draw and no specular gloss or reflections.
// Takes MeshStandardMaterial-style parameters and drops the ones a matte material doesn't have.
export function matte(p) {
    p = { ...(p || {}) };
    for (const k of ['roughness', 'metalness', 'clearcoat', 'clearcoatRoughness', 'sheen', 'sheenColor', 'sheenRoughness', 'envMapIntensity']) delete p[k];
    return selfLit(new T.MeshLambertMaterial(p));
}
// Flat plastic in one colour (Roblox-style), matte; o.neon: unlit and a touch brighter
export function mat(color, o) {
    o = o || {};
    const key = color + '|' + (o.neon ? 1 : 0) + '|' + (o.opacity || 1) + '|' + (o.side || 0) + '|' + (o.emissive || 0) + '|' + (o.boost || 0);
    let m = matCache.get(key);
    if (!m) {
        m = o.neon ? new T.MeshBasicMaterial({ color }) : selfLit(new T.MeshLambertMaterial({ color }));
        if (o.neon) m.color.multiplyScalar(NEON_BOOST * (o.boost || 1));
        if (o.emissive) { m.emissive = new T.Color(o.emissive); m.emissiveIntensity = o.ei ?? 0.5; }
        if (o.opacity && o.opacity < 1) { m.transparent = true; m.opacity = o.opacity; m.depthWrite = false; }
        if (o.side) m.side = T.DoubleSide;
        matCache.set(key, m);
    }
    return m;
}
export function texFrom(cv, repeat) {
    const t = new T.CanvasTexture(cv);
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 4;
    if (repeat) t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
}
// A text texture by its content: the same label is drawn and uploaded to the GPU once and shared
// by every sign that shows it. Never dispose these.
const sharedTexs = new Map();
export function sharedTex(key, draw) {
    let t = sharedTexs.get(key);
    if (!t) { t = texFrom(draw()); sharedTexs.set(key, t); }
    return t;
}

// ----- Roblox studs -----
// One texture tile is 8 x 8 studs (a stud is one world unit: the world boxes use a tile of 8). Like the
// reference's plastic: each stud a flat square with a faint seam round it and a small rounded square
// sunk into its middle; a height field turned into a normal map, so the insets catch the sun and the
// sky light from any angle.
const STUD_TEX = (() => {
    const N = 256, C = 32, HALF = 7.5, RAD = 3, BEVEL = 2.2;
    const h = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const qx = Math.abs(x % C + 0.5 - C / 2) - (HALF - RAD), qy = Math.abs(y % C + 0.5 - C / 2) - (HALF - RAD);
        const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - RAD;
        h[y * N + x] = d <= 0 ? 0 : Math.min(1, d / BEVEL);
    }
    const albedo = document.createElement('canvas'); albedo.width = albedo.height = N;
    const normal = document.createElement('canvas'); normal.width = normal.height = N;
    const ai = albedo.getContext('2d').createImageData(N, N), ni = normal.getContext('2d').createImageData(N, N);
    const at = (x, y) => h[((y + N) % N) * N + ((x + N) % N)];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = (y * N + x) * 4, v = at(x, y);
        const lx = x % C, ly = y % C, edge = lx < 1 || ly < 1;
        const g = edge ? 222 : 236 + v * 19;
        ai.data[i] = ai.data[i + 1] = ai.data[i + 2] = g; ai.data[i + 3] = 255;
        const dx = (at(x + 1, y) - at(x - 1, y)) * 2.4, dy = (at(x, y + 1) - at(x, y - 1)) * 2.4;
        const len = Math.hypot(dx, dy, 1);
        ni.data[i] = Math.round((-dx / len * 0.5 + 0.5) * 255);
        ni.data[i + 1] = Math.round((dy / len * 0.5 + 0.5) * 255);
        ni.data[i + 2] = Math.round((1 / len * 0.5 + 0.5) * 255);
        ni.data[i + 3] = 255;
    }
    albedo.getContext('2d').putImageData(ai, 0, 0);
    normal.getContext('2d').putImageData(ni, 0, 0);
    const map = texFrom(albedo), nrm = new T.CanvasTexture(normal);
    nrm.colorSpace = T.NoColorSpace;
    for (const t of [map, nrm]) { t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); }
    return { map, nrm };
})();
export const STUDS = STUD_TEX;
// Studded plastic for the merged world boxes: one material for every colour (the colour is in the
// vertices), sharing the stud textures, so the whole world needs only a couple of materials
export function studVCMaterial() {
    let m = matCache.get('studvc');
    if (!m) {
        // (Low goes without the normal map: a matrix worked out per pixel, on most of the screen)
        m = matte(START_QUALITY === 'low' ? { color: 0xffffff, vertexColors: true, map: STUD_TEX.map } : { color: 0xffffff, vertexColors: true, map: STUD_TEX.map, normalMap: STUD_TEX.nrm, normalScale: new T.Vector2(0.7, 0.7) });
        matCache.set('studvc', m);
    }
    return m;
}
// Studded plastic in one colour for a single mesh (o.rx / o.ry: tile repeats on plain 0..1 UVs)
export function studMaterial(color, o) {
    o = o || {};
    const rx = Math.max(1, Math.round(o.rx || 1)), ry = Math.max(1, Math.round(o.ry || 1));
    const key = 'stud|' + color + '|' + rx + '|' + ry;
    let m = matCache.get(key);
    if (!m) {
        const map = STUD_TEX.map.clone(), nrm = STUD_TEX.nrm.clone();
        for (const t of [map, nrm]) { t.repeat.set(rx, ry); t.needsUpdate = true; }
        m = matte({ color, map, normalMap: nrm, normalScale: new T.Vector2(0.7, 0.7) });
        matCache.set(key, m);
    }
    return m;
}

// ----- world collections -----
// solids: { min, max, shape?, mat, zone, ... } â€” boxes, plus round shapes (dome / cyl) with their
// own surface tests (see main.js)
export const solids = [];
export const triggers = []; // { min, max, enter, inside, zone }
export const prompts = [];  // { pos, r, label(), act(), zone }
export const tickers = [];  // per-frame callbacks (dt, t)

export function aabb(x, y, z, sx, sy, sz) {
    return { min: new V3(x - sx / 2, y - sy / 2, z - sz / 2), max: new V3(x + sx / 2, y + sy / 2, z + sz / 2) };
}
export function solidBox(x, y, z, sx, sy, sz, o) {
    const c = aabb(x, y, z, sx, sy, sz);
    Object.assign(c, { zone: -1, mat: 'block' }, o || {});
    solids.push(c);
    return c;
}

// ----- text -----
// Picks the biggest font size (up to px) at which `text`, with its outline (strokeK x the size),
// fits inside maxW pixels; sets it on the canvas and returns it. Every sign uses this, so no
// letters are ever cut off at a board's edge, whatever font actually loaded.
export function fitFont(x, text, maxW, px, weight, family, strokeK) {
    const f = (p) => `${weight} ${p}px ${family}`, k = strokeK || 0;
    x.font = f(px);
    const w = x.measureText(text).width;
    if (w + px * k <= maxW) return px;
    // the width grows with the size: jump straight to the size that fits (one pixel at a time took up
    // to ~100 measures for a long label), then step down if the rounding needs it
    px = Math.max(8, Math.floor(px * maxW / (w + px * k)));
    x.font = f(px);
    while (px > 8 && x.measureText(text).width + px * k > maxW) { px -= 1; x.font = f(px); }
    return px;
}
export function textCanvas(lines, W) { return paintLines(document.createElement('canvas'), lines, W); }
// how tall lines of lettering are, drawn W wide
export function linesHeight(lines) { let H = 20; for (const l of lines) H += l.px * 1.2; return Math.ceil(H); }
// draws lines onto a canvas (resized to fit them; cleared when it already has that size)
function paintLines(cv, lines, W) {
    const H = linesHeight(lines);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const x = cv.getContext('2d');
    x.clearRect(0, 0, W, H);
    drawLines(x, lines, W);
    return cv;
}
// the lettering itself, into a context as it stands (its transform puts it where it goes: a sign's cell of an atlas)
export function drawLines(x, lines, W) {
    const pad = 10;
    let y = pad;
    for (const l of lines) {
        const iw = l.ic ? l.px * 0.95 : 0;
        // f: 'chunky': the big cartoon lettering of the signs and the +1s
        const chunky = l.f === 'chunky';
        const px = fitFont(x, l.t, W - 28 - iw, l.px, chunky ? 400 : l.w || 700, chunky ? '"Russo One", Fredoka, sans-serif' : 'Fredoka, "Arial Rounded MT Bold", sans-serif', l.s ? 0.28 : 0);
        x.textAlign = 'center'; x.textBaseline = 'middle';
        const cy = y + l.px * 0.62;
        let cx = W / 2;
        // an icon drawn before the words (never an emoji: a glyph's first draw stalls the frame)
        if (l.ic) { const tw = x.measureText(l.t).width, s = px * 0.86; cx = W / 2 + (s + px * 0.12) / 2; drawIcon(x, l.ic, cx - tw / 2 - px * 0.12 - s / 2, cy, s); }
        if (l.s) {
            x.lineJoin = 'round'; x.strokeStyle = l.s;
            // chunky: a drop shadow under a thick outline
            if (chunky) { x.lineWidth = Math.max(6, px * 0.3); x.strokeText(l.t, cx, cy + px * 0.07); }
            x.lineWidth = Math.max(4, px * (chunky ? 0.26 : 0.22)); x.strokeText(l.t, cx, cy);
        }
        if (l.g) {
            const g = x.createLinearGradient(0, cy - px / 2, 0, cy + px / 2);
            g.addColorStop(0, l.g[0]); g.addColorStop(1, l.g[1]);
            x.fillStyle = g;
        } else x.fillStyle = l.c || '#fff';
        x.fillText(l.t, cx, cy);
        y += l.px * 1.2;
    }
}
// The game's own icons, drawn: 'speed' (a cyan bolt), 'bolt' (a gold one), 'crown' (a Win), 'shoe', 'kb', 'coin'
export function drawIcon(x, kind, cx, cy, s) {
    x.save();
    x.translate(cx, cy);
    x.lineJoin = 'round'; x.lineCap = 'round';
    if (kind === 'speed') {
        // Speed: a cyan lightning bolt, outlined dark
        const p = [[0.12, -0.5], [-0.3, 0.06], [-0.02, 0.06], [-0.12, 0.5], [0.32, -0.08], [0.04, -0.08], [0.16, -0.5]];
        x.beginPath(); p.forEach(([a, b], i) => (i ? x.lineTo(a * s, b * s) : x.moveTo(a * s, b * s))); x.closePath();
        x.lineWidth = s * 0.16; x.strokeStyle = '#06203a'; x.stroke();
        const g = x.createLinearGradient(0, -s / 2, 0, s / 2); g.addColorStop(0, '#d8fbff'); g.addColorStop(1, '#3ad8ff');
        x.fillStyle = g; x.fill();
    } else if (kind === 'kb') {
        // a little keyboard: a dark case and rows of bright keys
        const u = s / 10;
        x.fillStyle = '#1a1030'; x.beginPath(); x.roundRect(-5 * u, -3.3 * u, 10 * u, 6.6 * u, 1.2 * u); x.fill();
        x.fillStyle = '#3a3c58'; x.beginPath(); x.roundRect(-4.4 * u, -2.8 * u, 8.8 * u, 5.6 * u, 0.8 * u); x.fill();
        const C = ['#ff5a7a', '#ffe02a', '#46ec50', '#3ad8ff'];
        for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) { x.fillStyle = C[(i + j) % 4]; x.beginPath(); x.roundRect((-4 + i * 2.05) * u, (-2.4 + j * 1.7) * u, 1.75 * u, 1.4 * u, 0.3 * u); x.fill(); }
    } else if (kind === 'bolt') {
        const p = [[0.12, -0.5], [-0.3, 0.06], [-0.02, 0.06], [-0.12, 0.5], [0.32, -0.08], [0.04, -0.08], [0.16, -0.5]];
        x.beginPath(); p.forEach(([a, b], i) => (i ? x.lineTo(a * s, b * s) : x.moveTo(a * s, b * s))); x.closePath();
        x.lineWidth = s * 0.16; x.strokeStyle = '#3a2400'; x.stroke();
        const g = x.createLinearGradient(0, -s / 2, 0, s / 2); g.addColorStop(0, '#fff6a0'); g.addColorStop(1, '#ffb21e');
        x.fillStyle = g; x.fill();
    } else if (kind === 'shoe') {
        // a red sneaker, side on: sole, body, toe cap, laces
        const u = s / 10;
        x.lineWidth = u * 0.9; x.strokeStyle = '#3a0a14';
        x.beginPath(); x.moveTo(-4.6 * u, 1.2 * u); x.lineTo(-4.4 * u, -3 * u); x.quadraticCurveTo(-3 * u, -3.8 * u, -1.6 * u, -2.6 * u); x.lineTo(1.4 * u, -0.4 * u); x.quadraticCurveTo(4.6 * u, 0 * u, 4.8 * u, 1.6 * u); x.lineTo(4.8 * u, 2.6 * u); x.lineTo(-4.6 * u, 2.6 * u); x.closePath();
        x.fillStyle = '#ff3a4a'; x.fill(); x.stroke();
        x.fillStyle = '#ffffff'; x.fillRect(-4.6 * u, 1.6 * u, 9.4 * u, 1.3 * u); x.strokeRect(-4.6 * u, 1.6 * u, 9.4 * u, 1.3 * u);
        x.strokeStyle = '#ffffff'; x.lineWidth = u * 0.6;
        for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo((-2.2 + i * 1.1) * u, (-1.9 + i * 0.7) * u); x.lineTo((-1.2 + i * 1.1) * u, (-2.6 + i * 0.7) * u); x.stroke(); }
    } else if (kind === 'crown') {
        const u = s / 10;
        x.beginPath(); x.moveTo(-4.6 * u, 3 * u); x.lineTo(-4.8 * u, -2.6 * u); x.lineTo(-2.2 * u, 0); x.lineTo(0, -3.8 * u); x.lineTo(2.2 * u, 0); x.lineTo(4.8 * u, -2.6 * u); x.lineTo(4.6 * u, 3 * u); x.closePath();
        x.lineWidth = u * 1.1; x.strokeStyle = '#5a2a00'; x.stroke();
        const g = x.createLinearGradient(0, -4 * u, 0, 3 * u); g.addColorStop(0, '#fff6a0'); g.addColorStop(1, '#ffb21e'); x.fillStyle = g; x.fill();
        x.fillStyle = '#ff3a5a'; for (const px of [-2.4, 0, 2.4]) { x.beginPath(); x.arc(px * u, 1.4 * u, 0.7 * u, 0, Math.PI * 2); x.fill(); }
    } else {
        const r = s * 0.46;
        x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2);
        x.lineWidth = s * 0.12; x.strokeStyle = '#5a0a3a'; x.stroke();
        const g = x.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r); g.addColorStop(0, '#ffd0f0'); g.addColorStop(0.55, '#ff5ac0'); g.addColorStop(1, '#d8208a');
        x.fillStyle = g; x.fill();
        x.beginPath();
        const zx = [-0.22, 0.22, -0.22, 0.22, -0.22];
        zx.forEach((a, i) => { const b = -0.24 + i * 0.12; if (i) x.lineTo(a * s, b * s); else x.moveTo(a * s, b * s); });
        x.lineWidth = s * 0.09; x.strokeStyle = '#ffffff'; x.stroke();
    }
    x.restore();
}
// shared: a fixed label whose texture can be shared with others (see sharedTex); its own
// texture is made only when the text changes (set)
export function billboard(lines, worldW, W, pos, parent, shared) {
    W = W || 512;
    const map = shared ? sharedTex('bb|' + W + '|' + JSON.stringify(lines), () => textCanvas(lines, W)) : texFrom(textCanvas(lines, W));
    const cv = map.image;
    const sp = new T.Sprite(new T.SpriteMaterial({ map, transparent: true, depthWrite: false, toneMapped: false }));
    sp.scale.set(worldW, worldW * cv.height / cv.width, 1);
    if (pos) sp.position.copy(pos);
    sp.userData.ownTex = !shared;
    sp.userData.set = (nl) => {
        const c2 = textCanvas(nl, W);
        if (sp.userData.ownTex) sp.material.map.dispose();
        sp.userData.ownTex = true;
        sp.material.map = texFrom(c2);
        sp.material.needsUpdate = true;
        sp.scale.set(worldW, worldW * c2.height / c2.width, 1);
        if (!sp.matrixAutoUpdate) sp.updateMatrix();
    };
    (parent || scene).add(sp);
    return sp;
}
export function textPlane(lines, worldW, W, pos, look, parent) {
    const map = sharedTex('tp|' + (W || 512) + '|' + JSON.stringify(lines), () => textCanvas(lines, W || 512));
    const cv = map.image;
    const h = worldW * cv.height / cv.width;
    const m = new T.Mesh(new T.PlaneGeometry(worldW, h), new T.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false }));
    m.position.copy(pos);
    if (look) m.lookAt(look);
    (parent || scene).add(m);
    return m;
}

// ----- blocky fallback body (used until / unless the Bloxity avatar loads) -----
function buildHair(part, c) {
    part(1.3, 0.35, 1.3, 0, 5.33, -0.02, c);
    part(1.3, 0.75, 0.3, 0, 4.95, -0.5, c);
    part(1.3, 0.16, 0.2, 0, 5.16, 0.56, c);
}
export function buildRig(d) {
    const g = new T.Group();
    const part = (sx, sy, sz, x, y, z, c, parent) => {
        const m = new T.Mesh(UNIT, mat(c)); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; (parent || g).add(m); return m;
    };
    part(2, 2, 1, 0, 3, 0, d.shirt);
    part(2.02, 0.12, 1.02, 0, 2.06, 0, d.shorts);
    const head = new T.Group(); g.add(head);
    part(1.2, 1.2, 1.2, 0, 4.6, 0, d.skin, head);
    for (const sx of [-0.26, 0.26]) {
        part(0.26, 0.24, 0.04, sx, 4.72, 0.605, 0xffffff, head);
        part(0.13, 0.18, 0.04, sx + (sx > 0 ? -0.04 : 0.04), 4.71, 0.625, 0x1a1420, head);
    }
    part(0.36, 0.07, 0.04, 0, 4.34, 0.64, 0x6b2a2a, head);
    buildHair((sx, sy, sz, x, y, z, c) => part(sx, sy, sz, x, y, z, c, head), d.hair ?? 0x3a2618);
    const legs = [], arms = [];
    for (const side of [-0.5, 0.5]) {
        const p = new T.Group(); p.position.set(side, 2, 0); g.add(p);
        part(1, 0.9, 1, 0, -0.45, 0, d.shorts, p);
        part(0.98, 1.1, 0.98, 0, -1.45, 0, d.socks, p);
        part(1.05, 0.42, 1.34, 0, -1.84, 0.12, 0x141418, p);
        legs.push(p);
    }
    for (const side of [-1.5, 1.5]) {
        const p = new T.Group(); p.position.set(side, 3.9, 0); g.add(p);
        part(1, 0.8, 1, 0, -0.4, 0, d.shirt, p);
        part(0.98, 1.2, 0.98, 0, -1.4, 0, d.skin, p);
        arms.push(p);
    }
    g.userData.legs = legs; g.userData.arms = arms; g.userData.head = head;
    return g;
}
export function animRig(g, phase, amt) {
    const s = Math.sin(phase) * amt;
    const u = g.userData;
    u.legs[0].rotation.set(s, 0, 0); u.legs[1].rotation.set(-s, 0, 0);
    u.arms[0].rotation.set(-s * 0.9, 0, 0); u.arms[1].rotation.set(s * 0.9, 0, 0);
}
export function airPose(g) {
    const u = g.userData;
    u.legs[0].rotation.set(0.5, 0, 0); u.legs[1].rotation.set(-0.3, 0, 0);
    u.arms[0].rotation.set(-2.6, 0, 0); u.arms[1].rotation.set(-2.6, 0, 0);
}
// Hands up on the truss, alternating as you climb
export function climbPose(g, phase) {
    const u = g.userData, s = Math.sin(phase);
    u.arms[0].rotation.set(-2.7 + s * 0.4, 0, 0); u.arms[1].rotation.set(-2.7 - s * 0.4, 0, 0);
    u.legs[0].rotation.set(-0.5 - s * 0.4, 0, 0); u.legs[1].rotation.set(-0.5 + s * 0.4, 0, 0);
}
// Holding a tool out in front (right arm)
export function holdPose(g) { g.userData.arms[1].rotation.set(-1.45, 0, 0); }

// ----- floating text -----
// At most a dozen at once, each a sprite from a pool: its canvas is redrawn and its texture refreshed
// (no new canvas, texture or material per harvest). A new one rising where another still is goes
// above it instead of on top of it.
const floaters = [], floatFree = [];
function dropFloater(f) { scene.remove(f.sp); floatFree.push(f); }
// pop: a comic word that bursts in big and settles ("SQUISH!"); icon: 'bolt' / 'coin' before the text
// The numbers are chunky cartoon lettering with a sheen: white to gold (green ones: lime to green)
const FLOAT_GRAD = { '#ffffff': ['#ffffff', '#ffd23a'], '#7dff6b': ['#eaffc8', '#3ee03a'], '#ffe24a': ['#fff8c0', '#ffb81e'] };
// the same number again ("+1.5" a hundred times) takes the texture it was drawn into before: no canvas drawn, nothing
// sent to the graphics card (a few dozen kept, the oldest let go)
const floatTex = new Map();
function floatTexture(text, color, icon) {
    const key = text + '|' + color + '|' + (icon || '');
    let e = floatTex.get(key);
    if (e) { floatTex.delete(key); floatTex.set(key, e); return e; }
    const cv = textCanvas([{ t: text, c: color, g: FLOAT_GRAD[color], s: '#1a1030', px: 84, ic: icon, f: 'chunky' }], 384);
    e = { t: texFrom(cv), k: cv.height / cv.width };
    floatTex.set(key, e);
    if (floatTex.size > 48) { const [k0, old] = floatTex.entries().next().value; if (!floaters.some((f) => f.sp.material.map === old.t)) { old.t.dispose(); floatTex.delete(k0); } }
    return e;
}
// ----- the numbers ("+1", "+1.5K") from one sheet of glyphs: every number on screen in ONE draw, nothing painted or uploaded
// when a new one pops (a step's number every step costs a few dozen floats written, not a canvas, a texture and a draw call) -----
// The sheet is painted once, behind the loading screen, as soon as the lettering's font is in: two rows of outlines (drawn first, so
// a glyph's outline never covers its neighbour's colour), then the colours (white to gold, lime to green, cream to gold, and a white
// one tinted to any other colour). Each glyph is a quad facing the camera, two per glyph (outline, colour).
const GL_CH = '0123456789.+-,KMBTQaiSxpOcNoDe', GL_IC = ['speed', 'bolt'], GL_CELL = 64, GL_COLS = 16, GL_PX = 44, GL_ROWS = 10;
const GL_FILL = { '#ffffff': 0, '#7dff6b': 1, '#ffe24a': 2 }, GL_GRADS = [['#ffffff', '#ffd23a'], ['#eaffc8', '#3ee03a'], ['#fff8c0', '#ffb81e'], ['#ffffff', '#ffffff']];
const GL_RE = new RegExp('^[' + GL_CH.replace(/[-.+]/g, '\\$&') + ']{1,14}$');
const GL_MAX = 480;              // glyph quads at once (a dozen and a half numbers of a dozen glyphs, outline and colour)
const glyphs = { ready: false, adv: new Map(), list: [], mesh: null, n: 0 };
const glyphTmp = new T.Color();
function glyphCell(i, row) { return [(i % GL_COLS) * GL_CELL / 1024, 1 - (row + Math.floor(i / GL_COLS) + 1) * GL_CELL / (GL_ROWS * GL_CELL)]; }
function paintGlyphs() {
    if (glyphs.ready) return;
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = GL_ROWS * GL_CELL;
    const x = cv.getContext('2d'), px = GL_PX;
    x.font = '400 ' + px + 'px "Russo One", Fredoka, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    const all = [...GL_CH, ...GL_IC];
    all.forEach((ch, i) => {
        const ic = GL_IC.includes(ch), cx = (i % GL_COLS) * GL_CELL + GL_CELL / 2, cyOf = (row) => (row + Math.floor(i / GL_COLS)) * GL_CELL + GL_CELL / 2;
        glyphs.adv.set(ch, ic ? px * 0.98 : x.measureText(ch).width);
        if (!ic) {
            // the outline layer: a drop shadow under a thick dark outline (as the signs' chunky lettering)
            const cy = cyOf(0);
            x.strokeStyle = '#1a1030'; x.lineWidth = Math.max(6, px * 0.3); x.strokeText(ch, cx, cy + px * 0.07);
            x.lineWidth = Math.max(4, px * 0.26); x.strokeText(ch, cx, cy);
        }
        for (let v = 0; v < 4; v++) {
            const cy = cyOf(2 + v * 2);
            if (ic) { drawIcon(x, ch, cx, cy, px * 0.86); continue; }
            const g = x.createLinearGradient(0, cy - px / 2, 0, cy + px / 2); g.addColorStop(0, GL_GRADS[v][0]); g.addColorStop(1, GL_GRADS[v][1]);
            x.fillStyle = g; x.fillText(ch, cx, cy);
        }
    });
    const tex = new T.CanvasTexture(cv);
    tex.minFilter = T.LinearMipmapLinearFilter; tex.magFilter = T.LinearFilter; tex.generateMipmaps = true;
    const g = new T.InstancedBufferGeometry();
    const q = new T.PlaneGeometry(1, 1);
    g.setIndex(q.index); g.setAttribute('position', q.attributes.position);
    const att = (name, n) => { const a = new T.InstancedBufferAttribute(new Float32Array(GL_MAX * n), n); a.setUsage(T.DynamicDrawUsage); g.setAttribute(name, a); return a; };
    glyphs.aAnchor = att('aAnchor', 3); glyphs.aGlyph = att('aGlyph', 4); glyphs.aTint = att('aTint', 4); glyphs.aSize = att('aSize', 1);
    g.instanceCount = 0;
    const m = new T.ShaderMaterial({
        uniforms: { map: { value: tex }, uCell: { value: new T.Vector2(GL_CELL / 1024, 1 / GL_ROWS) } },
        vertexShader: 'attribute vec3 aAnchor; attribute vec4 aGlyph; attribute vec4 aTint; attribute float aSize; uniform vec2 uCell; varying vec2 vUv; varying vec4 vTint;\n' +
            'void main() { vec4 mv = modelViewMatrix * vec4(aAnchor, 1.0); mv.xy += (aGlyph.xy + position.xy) * aSize; gl_Position = projectionMatrix * mv;\n' +
            ' vUv = aGlyph.zw + (position.xy + 0.5) * uCell; vTint = aTint; }',
        fragmentShader: 'uniform sampler2D map; varying vec2 vUv; varying vec4 vTint;\n' +
            'void main() { vec4 c = texture2D(map, vUv); if (c.a * vTint.a < 0.01) discard; gl_FragColor = vec4(c.rgb * vTint.rgb, c.a * vTint.a); }',
        transparent: true, depthWrite: false, depthTest: false, toneMapped: false, fog: false,
    });
    const mesh = new T.Mesh(g, m);
    mesh.frustumCulled = false; mesh.renderOrder = 12;
    scene.add(mesh);              // always in the scene (nothing drawn while empty): the warm-up compiles it with everything else
    glyphs.mesh = mesh; glyphs.geo = g;
    renderer.initTexture(tex);
    glyphs.ready = true;
}
// once the lettering's font is in (never paint the sheet in a fallback font); a slow font gives up after 6 s and uses what there is
if (document.fonts && document.fonts.load) Promise.race([document.fonts.load('400 44px "Russo One"'), new Promise((r) => setTimeout(r, 6000))]).then(() => paintGlyphs(), () => paintGlyphs());
else setTimeout(paintGlyphs, 0);
export const glyphsReady = () => glyphs.ready;
// a number from the sheet: the same rise, pop and fade as a sprite's (updateGlyphs)
function glyphNumber(text, color, pos, size, pop, icon) {
    const fill = GL_FILL[color] ?? 3, chars = icon ? [icon, ...text] : [...text];
    if (glyphs.list.length >= 18) glyphs.list.shift();
    // the em's height in the world as the sprite lettering had it (84 px lettering on a 384 px wide canvas, `size` wide)
    const em = (size || 5) * 0.219, cellW = em * GL_CELL / GL_PX;
    let w = 0; for (const c of chars) w += glyphs.adv.get(c) + (GL_IC.includes(c) ? GL_PX * 0.12 : 0);
    const cells = []; let pen = -w / 2;
    for (const c of chars) {
        const a = glyphs.adv.get(c) + (GL_IC.includes(c) ? GL_PX * 0.12 : 0), i = GL_CH.indexOf(c) >= 0 ? GL_CH.indexOf(c) : GL_CH.length + GL_IC.indexOf(c);
        cells.push({ ox: (pen + a / 2) / GL_CELL, i, ic: GL_IC.includes(c) }); pen += a;
    }
    const h = em * 1.25, f = { x: pos.x, y: pos.y, z: pos.z, cells, fill, cellW, h, t: 1.15, pop: !!pop };
    for (let k = 0; k < 6; k++) {
        let hit = null;
        for (const o of glyphs.list) if (Math.abs(o.x - f.x) < w / GL_CELL * cellW * 0.6 && Math.abs(o.z - f.z) < 3 && Math.abs(o.y - f.y) < (h + o.h) * 0.5) { hit = o; break; }
        if (!hit) break;
        f.y = hit.y + (h + hit.h) * 0.55;
    }
    glyphTmp.set(color && color[0] === '#' ? color : '#ffffff');
    f.tint = fill === 3 ? [glyphTmp.r, glyphTmp.g, glyphTmp.b] : [1, 1, 1];
    glyphs.list.push(f);
}
function updateGlyphs(dt) {
    if (!glyphs.ready) return;
    const L = glyphs.list, A = glyphs.aAnchor.array, G = glyphs.aGlyph.array, C = glyphs.aTint.array, S = glyphs.aSize.array;
    let n = 0;
    for (let i = L.length - 1; i >= 0; i--) { const f = L[i]; f.t -= dt; f.y += dt * (1 + 5 * Math.max(0, f.t)); if (f.t <= 0) L.splice(i, 1); }
    // outlines of every number first, then their colours (a later number's outline never covers an earlier one's colour either)
    for (let pass = 0; pass < 2; pass++) for (const f of L) {
        const age = 1.15 - f.t, over = f.pop ? 0.45 : 0.22, a = Math.min(1, f.t / 0.35);
        const k = age < 0.09 ? 0.3 + age / 0.09 * (0.7 + over) : age < 0.24 ? 1 + over - (age - 0.09) / 0.15 * over : 1;
        for (const c of f.cells) {
            if (pass === 0 && c.ic) continue;
            if (n >= GL_MAX) break;
            const [u, v] = glyphCell(c.i, pass === 0 ? 0 : 2 + f.fill * 2);
            A[n * 3] = f.x; A[n * 3 + 1] = f.y; A[n * 3 + 2] = f.z;
            G[n * 4] = c.ox; G[n * 4 + 1] = 0; G[n * 4 + 2] = u; G[n * 4 + 3] = v;
            const tt = pass === 0 || c.ic ? null : f.tint;
            C[n * 4] = tt ? tt[0] : 1; C[n * 4 + 1] = tt ? tt[1] : 1; C[n * 4 + 2] = tt ? tt[2] : 1; C[n * 4 + 3] = a;
            S[n] = f.cellW * k;
            n++;
        }
    }
    if (n || glyphs.geo.instanceCount) {
        for (const [att, w] of [[glyphs.aAnchor, 3], [glyphs.aGlyph, 4], [glyphs.aTint, 4], [glyphs.aSize, 1]]) { att.clearUpdateRanges(); att.addUpdateRange(0, Math.max(1, n) * w); att.needsUpdate = true; }
    }
    glyphs.geo.instanceCount = n;
}
// how many word pops may float at once (each one its own sprite, draw and texture; the numbers go on the sheet above)
let floatCap = 12;
export function setFloatCap(n) { floatCap = Math.max(2, n | 0); }
export function floatText(text, color, pos, size, pop, icon) {
    if (glyphs.ready && GL_RE.test(text) && (!icon || GL_IC.includes(icon))) { glyphNumber(text, color, pos, size, pop, icon); return; }
    if (floaters.length >= floatCap) dropFloater(floaters.shift());
    const tx = floatTexture(text, color, icon);
    let f = floatFree.pop();
    if (f) f.sp.material.map = tx.t;
    else {
        const sp = new T.Sprite(new T.SpriteMaterial({ map: tx.t, transparent: true, depthWrite: false, depthTest: false, toneMapped: false }));
        sp.renderOrder = 12;
        f = { sp, base: new T.Vector3() };
    }
    const w = size || 5, h = w * tx.k;
    f.sp.position.copy(pos);
    for (let k = 0; k < 6; k++) {
        let hit = null;
        for (const o of floaters) if (Math.abs(o.sp.position.x - f.sp.position.x) < w * 0.6 && Math.abs(o.sp.position.z - f.sp.position.z) < w * 0.6 && Math.abs(o.sp.position.y - f.sp.position.y) < (h + o.h) * 0.5) { hit = o; break; }
        if (!hit) break;
        f.sp.position.y = hit.sp.position.y + (h + hit.h) * 0.55;
    }
    f.sp.scale.set(w, h, 1); f.base.set(w, h, 1); f.h = h;
    f.sp.material.opacity = 1;
    f.t = 1.15; f.pop = !!pop;
    f.sp.scale.set(w * 0.3, h * 0.3, 1);
    scene.add(f.sp);
    floaters.push(f);
}
// every number pops in (overshoots, settles), drifts up slowing down, and fades at the end; a big one pops harder
export function updateEffects(dt) {
    updateGlyphs(dt);
    for (let i = floaters.length - 1; i >= 0; i--) {
        const f = floaters[i];
        f.t -= dt;
        const age = 1.15 - f.t, over = f.pop ? 0.45 : 0.22;
        f.sp.position.y += dt * (1 + 5 * Math.max(0, f.t));
        f.sp.material.opacity = Math.min(1, f.t / 0.35);
        const k = age < 0.09 ? 0.3 + age / 0.09 * (0.7 + over) : age < 0.24 ? 1 + over - (age - 0.09) / 0.15 * over : 1;
        f.sp.scale.set(f.base.x * k, f.base.y * k, 1);
        if (f.t <= 0) { dropFloater(f); floaters.splice(i, 1); }
    }
}

export function lerpAngle(a, b, k) {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return a + d * k;
}

// Merges every mesh under root into one mesh per material (static props): many draw calls become few
export function mergeChildren(root) {
    root.updateMatrixWorld(true);
    const inv = new T.Matrix4().copy(root.matrixWorld).invert(), m4 = new T.Matrix4();
    const buckets = new Map(), done = [];
    root.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || o.userData.keep) return;
        const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        const keepColor = !!(o.material.vertexColors && g.attributes.color);
        for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name) && !(keepColor && name === 'color')) g.deleteAttribute(name);
        if (!g.attributes.uv) g.setAttribute('uv', new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        g.applyMatrix4(m4.multiplyMatrices(inv, o.matrixWorld));
        if (!buckets.has(o.material)) buckets.set(o.material, { list: [], shadow: false });
        const b = buckets.get(o.material);
        b.list.push(g); b.shadow = b.shadow || o.castShadow;
        done.push(o);
    });
    for (const o of done) o.parent.remove(o);
    for (const [material, b] of buckets) {
        const mesh = new T.Mesh(mergeGeometries(b.list), material);
        mesh.castShadow = b.shadow;
        mesh.receiveShadow = true;
        root.add(mesh);
        for (const g of b.list) g.dispose();
    }
}
