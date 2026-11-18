// The HUD's icons, drawn: glossy, chunky lab art (SVG with gradients, a dark outline and a white shine), made once at load and set
// as CSS classes (.ic-spin, .ic-rebirth...). The menu never shows an emoji. Every pet and Egg has its picture made here too, and
// palLook says which extra parts a pet has (pals.js builds the same ones in 3D).
const O = '#24120a';
const f = (n) => +n.toFixed(1);
const svg = (body, defs) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`;
const stops = (s) => s.map((c, i) => `<stop offset='${f(i / (s.length - 1))}' stop-color='${c}'/>`).join('');
const grad = (id, s, x2, y2) => `<linearGradient id='${id}' x1='0' y1='0' x2='${x2 ?? 0}' y2='${y2 ?? 1}'>${stops(s)}</linearGradient>`;
const shine = (cx, cy, rx, ry, rot, o) => `<ellipse cx='${cx}' cy='${cy}' rx='${rx}' ry='${ry}' fill='#fff' opacity='${o || 0.55}'${rot ? ` transform='rotate(${rot} ${cx} ${cy})'` : ''}/>`;
const hex = (c) => '#' + (c >>> 0).toString(16).padStart(6, '0');
// a colour (0xRRGGBB) toward white (t > 0) or black (t < 0); how light one is (0..1)
const tint = (c, t) => { const k = Math.abs(t), w = t > 0 ? 255 : 0, ch = (s) => Math.round(((c >> s) & 255) * (1 - k) + w * k); return hex((ch(16) << 16) | (ch(8) << 8) | ch(0)); };
const lum = (c) => (0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255)) / 255;
const uri = (s) => 'data:image/svg+xml,' + encodeURIComponent(s.replace(/\s*\n\s*/g, ''));
const pt = (cx, cy, r, a) => f(cx + r * Math.cos(a)) + ' ' + f(cy + r * Math.sin(a));
// a star with n points (radii R, r), a four-point sparkle
const star = (cx, cy, R, r, n) => { let d = ''; for (let i = 0; i < (n || 5) * 2; i++) d += (i ? 'L' : 'M') + pt(cx, cy, i % 2 ? r : R, -Math.PI / 2 + i * Math.PI / (n || 5)); return d + 'Z'; };
const sparkle = (x, y, s, c) => `<path d='M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z' fill='${c || '#fff'}' stroke='${O}' stroke-width='1.5' stroke-linejoin='round'/>`;
// a thick outlined stroke along a path (an arrow's shaft, a cord)
const band = (d, w, c) => `<g fill='none' stroke-linecap='round' stroke-linejoin='round'><path d='${d}' stroke='${O}' stroke-width='${w + 3.5}'/><path d='${d}' stroke='${c}' stroke-width='${w}'/></g>`;
const ink = (w) => `stroke='${O}' stroke-width='${w}' stroke-linejoin='round'`;
const GOLD = grad('y', ['#fff6a0', '#ffb21e']);

// the Lucky Wheel: royal blue, cream, red and gold, a studded purple rim, a red pennant pointing at the prize
function wheel() {
    const C = ['#22b8b0', '#fff0c8', '#e8642a', '#ffd23a', '#22b8b0', '#fff0c8', '#e8642a', '#ffd23a'];
    let p = '', s = '', b = '';
    for (let i = 0; i < 8; i++) {
        const a0 = i / 8 * Math.PI * 2 - Math.PI / 2, a1 = a0 + Math.PI / 4;
        p += `<path d='M32 35L${pt(32, 35, 21, a0)}A21 21 0 0 1 ${pt(32, 35, 21, a1)}Z' fill='${C[i]}'/>`;
        s += `M32 35L${pt(32, 35, 21, a0)}`;
    }
    for (let i = 0; i < 12; i++) b += `<circle cx='${f(32 + 24.6 * Math.cos(i * Math.PI / 6))}' cy='${f(35 + 24.6 * Math.sin(i * Math.PI / 6))}' r='1.9' fill='${i % 2 ? '#fff' : '#ffe24a'}'/>`;
    return svg(`<circle cx='32' cy='35' r='27.5' fill='url(#r)' stroke='${O}' stroke-width='3.5'/>${b}<circle cx='32' cy='35' r='21' fill='${O}'/>${p}
        <path d='${s}' fill='none' stroke='${O}' stroke-width='1.6'/><circle cx='32' cy='35' r='21' fill='none' stroke='${O}' stroke-width='2.5'/>
        ${shine(24, 26, 10, 4.5, -30, 0.45)}<circle cx='32' cy='35' r='6' fill='url(#y)' stroke='${O}' stroke-width='3'/>
        <path d='M23.5 1.5L40.5 1.5L40.5 8L32 17L23.5 8Z' fill='url(#g)' stroke='${O}' stroke-width='3' stroke-linejoin='round'/>${shine(28, 5, 2.6, 1.4)}`,
    grad('r', ['#f0b878', '#a8541e']) + GOLD + grad('g', ['#ff7a8a', '#c8102e']));
}

// ----- treasure chests -----
// a chest, its lid a little open: its wood or metal (c1), the bands and lid rim (c2), light spilling from the gap (c3, or gold where c3
// is dark), a lock on the front. o: planks (wood), rivets, a gem on the lid, a crown on it, crystal facets, glint (1, 2: sparkles),
// steel (a silver lock, on a gold chest)
const LID = 'M5 27L5 18C5 8.5 16 5 32 5C48 5 59 8.5 59 18L59 27Z', BOX = 'M7 35L57 35L57 55C57 58 55 60 52 60L12 60C9 60 7 58 7 55Z';
function chest(c1, c2, c3, o) {
    o = o || {};
    const Lc = lum(c3) > 0.45 ? c3 : 0xffe066, L = hex(Lc), B = hex(c2), BL = tint(c2, 0.35), dk = tint(c1, -0.38);
    const bands = (y0, y1) => `<rect x='12.5' y='${y0}' width='7' height='${y1 - y0}' fill='${B}'/><rect x='44.5' y='${y0}' width='7' height='${y1 - y0}' fill='${B}'/><path d='M14 ${y0}V${y1}M46 ${y0}V${y1}' stroke='${BL}' stroke-width='1.5'/>`;
    const rv = (ys) => o.rivets ? ys.map((y) => `<circle cx='16' cy='${y}' r='1.5' fill='${BL}' stroke='${O}' stroke-width='1'/><circle cx='48' cy='${y}' r='1.5' fill='${BL}' stroke='${O}' stroke-width='1'/>`).join('') : '';
    let box = '', lid = '', top = '';
    if (o.planks) { box += `<path d='M7 44H57M7 52.5H57' stroke='${dk}' stroke-width='1.8'/>`; lid += `<path d='M5 19.5C16 15.5 48 15.5 59 19.5M7 11.5C18 8 46 8 57 11.5' fill='none' stroke='${dk}' stroke-width='1.8'/>`; }
    if (o.facets) box += `<path d='M7 48L20 35M21 60L37 35M38 60L57 41' stroke='#fff' stroke-opacity='.45' stroke-width='2'/>`;
    box += bands(35, 60) + rv([40, 47.5, 55]);
    lid += bands(2, 27) + rv([10.5, 18]) + `<rect x='4' y='22' width='56' height='5' fill='${B}'/><path d='M5 23.2H59' stroke='${BL}' stroke-width='1.4'/>`;
    if (o.gem) { const G = o.gem === 'c2' ? c2 : c1; top += `<path d='M32 6.5L38.5 12.5L32 19L25.5 12.5Z' fill='${tint(G, 0.25)}' ${ink(2.5)}/><path d='M32 6.5L32 19M25.5 12.5H38.5' stroke='#fff' stroke-opacity='.4' stroke-width='1.2'/>${shine(30, 10.5, 1.8, 1.1, -40, 0.8)}`; }
    if (o.crown) top += `<path d='M24 19L23 8.5L27.5 12.5L32 6L36.5 12.5L41 8.5L40 19Z' fill='url(#y)' ${ink(2.5)}/><circle cx='32' cy='15' r='1.7' fill='#ff3a5a' stroke='${O}' stroke-width='1'/>`;
    const sp = o.glint > 1 ? sparkle(57, 7, 6, '#fffbe0') + sparkle(6, 44, 4) + sparkle(60, 50, 3.5) : o.glint ? sparkle(57, 7, 5.5, '#fffbe0') + sparkle(6, 44, 3.5) : sparkle(57, 8, 4.5, '#fffbe0');
    return svg(`<ellipse cx='32' cy='30' rx='31.5' ry='11' fill='${L}' opacity='.3'/><rect x='7' y='25' width='50' height='12' fill='${L}'/>
        <path d='${BOX}' fill='url(#b)'/><g clip-path='url(#cb)'>${box}</g><path d='${BOX}' fill='none' ${ink(4)}/>
        <path d='${LID}' fill='url(#l)'/><g clip-path='url(#cl)'>${lid}</g><path d='${LID}' fill='none' ${ink(4)}/>
        <ellipse cx='32' cy='31' rx='27' ry='5.5' fill='${L}' opacity='.4'/><path d='M9.5 31H54.5' stroke='#fff' stroke-opacity='.9' stroke-width='1.8' stroke-linecap='round'/>
        <path d='M26 24L38 24L38 37C38 40.5 35.5 42.5 32 44C28.5 42.5 26 40.5 26 37Z' fill='url(#${o.steel ? 's' : 'y'})' ${ink(3)}/>
        <circle cx='32' cy='31.5' r='2.5' fill='${O}'/><path d='M30.7 32.5L33.3 32.5L34 38L30 38Z' fill='${O}'/>${shine(29, 27, 1.8, 1.1)}
        ${top}${shine(15, 9.5, 6, 2.2, -12)}<rect x='9.5' y='38.5' width='2.6' height='17' rx='1.3' fill='#fff' opacity='.3'/>${sp}`,
    grad('b', [tint(c1, 0.18), hex(c1), tint(c1, -0.25)]) + grad('l', [tint(c1, 0.42), tint(c1, 0.04)]) + GOLD + grad('s', ['#ffffff', '#9aa6b8'])
        + `<clipPath id='cb'><path d='${BOX}'/></clipPath><clipPath id='cl'><path d='${LID}'/></clipPath>`);
}
// each chest's look, by its id (any other: planks)
const CHEST = { wood: { planks: 1 }, iron: { rivets: 1 }, silver: { rivets: 1, glint: 1 }, gold: { rivets: 1, glint: 1, steel: 1 }, ruby: { gem: 1, glint: 1 },
    emerald: { gem: 1, glint: 1 }, crystal: { gem: 'c2', facets: 1, glint: 2 }, royal: { crown: 1, rivets: 1, glint: 2 } };

// ----- Eggs -----
// an egg of its shell colour (c1), a pattern in c2 (o.k: label, goo, cells, hazard, frost, atom, star, eye; and the older speck,
// spine, wave, zig, royal, sun), a glow under it in c3;
// o: glint (0..2: sparkles), crown
const EGG = 'M32 4C45 4 55 22 55 38C55 52 45 60 32 60C19 60 9 52 9 38C9 22 19 4 32 4Z';
function egg(c1, c2, c3, o) {
    o = o || {};
    const B = hex(c2), BL = tint(c2, 0.35), L = hex(lum(c3) > 0.45 ? c3 : 0xffffff), k = o.k || 'speck';
    let pat = '';
    if (k === 'speck') pat = [[20, 22, 2.8], [38, 15, 2.1], [45, 30, 3.2], [24, 41, 2.4], [40, 47, 2.8], [15, 33, 1.7], [31, 29, 1.9], [49, 41, 1.6], [29, 53, 1.8]].map(([x, y, r]) => `<circle cx='${x}' cy='${y}' r='${r}' fill='${B}'/>`).join('');
    else if (k === 'spine') pat = [[18, 26], [30, 18], [42, 26], [24, 38], [38, 38], [18, 50], [32, 50], [46, 48]].map(([x, y]) => `<path d='M${x - 2.6} ${y + 2}L${x} ${y - 2.4}L${x + 2.6} ${y + 2}' fill='none' stroke='${B}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/>`).join('') + `<circle cx='32' cy='8' r='4.2' fill='#ff7ab0' ${ink(1.6)}/><circle cx='32' cy='8' r='1.6' fill='#fff07a'/>`;
    else if (k === 'wave') pat = `<path d='M2 28Q9 22 16 28T30 28T44 28T58 28T72 28M2 42Q9 36 16 42T30 42T44 42T58 42T72 42' fill='none' stroke='${B}' stroke-width='4.5' stroke-linecap='round'/><path d='M2 35Q9 31 16 35T30 35T44 35T58 35T72 35' fill='none' stroke='${BL}' stroke-width='1.6'/>`;
    else if (k === 'zig') pat = `<path d='M2 33L10 26L18 33L26 26L34 33L42 26L50 33L58 26L66 33' fill='none' stroke='${B}' stroke-width='5' stroke-linejoin='round'/><rect x='2' y='43' width='60' height='4' fill='${B}'/><rect x='2' y='17' width='60' height='3' fill='${B}'/>`;
    else if (k === 'label') {
        // a specimen label: a white band with a barcode and a coloured tag, a stripe over it
        let bars = ''; for (const [x, w] of [[12, 1.4], [14.6, 2.6], [18.4, 1], [20.6, 1.8], [23.6, 3], [27.8, 1.2], [30.2, 2]]) bars += `<rect x='${x}' y='33' width='${w}' height='8' fill='${O}'/>`;
        pat = `<rect x='2' y='15' width='60' height='4' fill='${B}'/><rect x='2' y='30' width='60' height='14' fill='#ffffff'/><path d='M2 30H62M2 44H62' stroke='${O}' stroke-width='1.6'/>${bars}<rect x='37' y='33' width='15' height='8' rx='2' fill='${B}' stroke='${O}' stroke-width='1.2'/>`;
    } else if (k === 'goo') {
        // goo dripping over the top, bubbles rising under it
        pat = `<path d='M2 2H62V18Q58 18 57 24Q56 30 53 24Q51 18 46 19Q44 28 41 33Q38 28 37 20Q33 18 30 20Q29 26 26 26Q23 26 22 20Q18 18 14 20Q13 30 10 30Q7 30 7 22Q5 18 2 18Z' fill='${B}' stroke='${O}' stroke-width='2'/><path d='M8 12Q20 9 30 12' fill='none' stroke='${BL}' stroke-width='2' stroke-linecap='round'/>`
            + [[20, 42, 3.2], [36, 48, 2.4], [44, 38, 3.6], [28, 54, 2], [15, 52, 1.8]].map(([x, y, r]) => `<circle cx='${x}' cy='${y}' r='${r}' fill='${BL}' stroke='${B}' stroke-width='1.4'/>`).join('');
    } else if (k === 'cells') {
        // cells under a microscope: each a membrane and a nucleus
        pat = [[20, 24, 6], [41, 19, 5], [44, 41, 7], [21, 46, 5.5], [31, 34, 3.5], [52, 28, 3]].map(([x, y, r]) => `<circle cx='${x}' cy='${y}' r='${r}' fill='${BL}' stroke='${B}' stroke-width='2'/><circle cx='${x + r * 0.15}' cy='${y - r * 0.1}' r='${f(r * 0.38)}' fill='${B}'/>`).join('');
    } else if (k === 'hazard') {
        // a band of hazard stripes, a warning sign over it
        let st = ''; for (let x = -16; x < 66; x += 10) st += `<path d='M${x} 44L${x + 8} 28L${x + 13} 28L${x + 5} 44Z' fill='${hex(c1)}'/>`;
        pat = `<rect x='0' y='28' width='64' height='16' fill='${B}'/>${st}<path d='M0 28H64M0 44H64' stroke='${O}' stroke-width='1.6'/>
            <path d='M32 8L41 22H23Z' fill='${B}' stroke='${O}' stroke-width='1.5' stroke-linejoin='round'/><path d='M32 12.5V17.5' stroke='${hex(c1)}' stroke-width='2.2' stroke-linecap='round'/><circle cx='32' cy='19.6' r='1.1' fill='${hex(c1)}'/>`;
    } else if (k === 'frost') {
        // an ice cap with icicles, snowflakes on the shell
        const flake = (x, y, r) => `<path d='M${x - r} ${y}H${x + r}M${f(x - r / 2)} ${f(y - r * 0.87)}L${f(x + r / 2)} ${f(y + r * 0.87)}M${f(x - r / 2)} ${f(y + r * 0.87)}L${f(x + r / 2)} ${f(y - r * 0.87)}' stroke='${B}' stroke-width='2' stroke-linecap='round'/>`;
        pat = `<path d='M2 2H62V16L57 22L53 16L48 25L44 16L39 21L34 16L29 24L25 16L20 22L15 16L10 23L6 16L2 18Z' fill='${B}' stroke='${O}' stroke-width='1.6' stroke-linejoin='round'/>` + flake(20, 36, 5) + flake(42, 32, 6) + flake(30, 50, 4) + flake(48, 48, 3.5);
    } else if (k === 'atom') {
        // the radiation sign: three blades round a core, a band under it
        let bl = ''; for (const a of [-Math.PI / 2, Math.PI / 6, Math.PI * 5 / 6]) { const a0 = a - 0.52, a1 = a + 0.52; bl += `<path d='M${pt(32, 33, 6, a0)}L${pt(32, 33, 15, a0)}A15 15 0 0 1 ${pt(32, 33, 15, a1)}L${pt(32, 33, 6, a1)}A6 6 0 0 0 ${pt(32, 33, 6, a0)}Z' fill='${B}' stroke='${O}' stroke-width='1.6' stroke-linejoin='round'/>`; }
        pat = bl + `<circle cx='32' cy='33' r='3.6' fill='${B}' stroke='${O}' stroke-width='1.6'/><rect x='2' y='51' width='60' height='4' fill='${B}'/>`;
    } else if (k === 'eye') {
        // an anomaly: one big eye staring out, glitch bars either side
        pat = `<rect x='4' y='22' width='12' height='3' fill='${B}'/><rect x='48' y='44' width='13' height='3' fill='${B}'/><rect x='6' y='46' width='8' height='2.4' fill='#ffffff' opacity='.7'/><rect x='50' y='18' width='9' height='2.4' fill='#ffffff' opacity='.7'/>
            <path d='M15 34Q32 18 49 34Q32 50 15 34Z' fill='#ffffff' ${ink(2.4)}/><circle cx='32' cy='34' r='7.4' fill='${B}' stroke='${O}' stroke-width='1.6'/><circle cx='32' cy='34' r='3.4' fill='${O}'/><circle cx='34.4' cy='31.4' r='1.7' fill='#fff'/>`;
    }
    else if (k === 'scarab') pat = `<rect x='2' y='44' width='60' height='5' fill='${B}'/><ellipse cx='32' cy='32' rx='8' ry='10' fill='${B}' ${ink(2)}/><circle cx='32' cy='20.5' r='4.2' fill='${B}' ${ink(2)}/><path d='M32 23V41M24.5 27L18 23M39.5 27L46 23M24 34H17M40 34H47M25 39L19 44M39 39L45 44' fill='none' stroke='${O}' stroke-width='2' stroke-linecap='round'/><path d='M24 25Q32 20 40 25' fill='none' stroke='${BL}' stroke-width='1.4'/>`;
    else if (k === 'royal') pat = [10, 18, 26, 34, 42, 50].map((x) => `<rect x='${x}' y='2' width='4' height='26' fill='${B}'/>`).join('') + `<rect x='2' y='29' width='60' height='9' fill='url(#y)'/><path d='M2 29H62M2 38H62' stroke='${O}' stroke-width='1.6'/><circle cx='20' cy='33.5' r='2.2' fill='${B}'/><circle cx='32' cy='33.5' r='2.6' fill='#e8283a'/><circle cx='44' cy='33.5' r='2.2' fill='${B}'/>`;
    else if (k === 'star') pat = `<path d='${star(22, 24, 4.6, 2)}' fill='${B}'/><path d='${star(42, 38, 5.4, 2.3)}' fill='${B}'/><path d='${star(26, 46, 3, 1.3)}' fill='${BL}'/><path d='${star(40, 16, 2.6, 1.1)}' fill='${BL}'/><path d='${star(14, 36, 2.2, 1)}' fill='${BL}'/><path d='M38 26A7 7 0 1 0 48 31A5.5 5.5 0 1 1 38 26Z' fill='#fff4c8' opacity='.85'/>`;
    else if (k === 'sun') { let r = ''; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; r += `<path d='M${pt(32, 34, 10, a - 0.13)}L${pt(32, 34, 19, a)}L${pt(32, 34, 10, a + 0.13)}Z' fill='${B}'/>`; } pat = r + `<circle cx='32' cy='34' r='9' fill='url(#y)' ${ink(2)}/>`; }
    const sp = o.glint > 1 ? sparkle(57, 9, 6, '#fffbe0') + sparkle(6, 46, 4) + sparkle(59, 50, 3.5) : o.glint ? sparkle(57, 9, 5.5, '#fffbe0') + sparkle(6, 46, 3.5) : sparkle(57, 10, 4.5, '#fffbe0');
    const top = o.crown ? `<path d='M22 11L21 1L26.5 5L32 0L37.5 5L43 1L42 11Z' fill='url(#y)' ${ink(2.5)}/><circle cx='32' cy='6.5' r='1.7' fill='#ff3a5a' stroke='${O}' stroke-width='1'/>` : '';
    return svg(`<ellipse cx='32' cy='59.5' rx='22' ry='4' fill='${L}' opacity='.45'/>
        <path d='${EGG}' fill='url(#b)'/><g clip-path='url(#ce)'>${pat}</g><path d='${EGG}' fill='none' ${ink(4)}/>
        ${top}${shine(22, 17, 4.5, 8, 28, 0.55)}<circle cx='17.5' cy='32' r='1.6' fill='#fff' opacity='.5'/>${sp}`,
    grad('b', [tint(c1, 0.32), hex(c1), tint(c1, -0.24)]) + GOLD + `<clipPath id='ce'><path d='${EGG}'/></clipPath>`);
}
// each egg's look, by its id
const CAPS = { rookie: { k: 'label' }, lunar: { k: 'goo', glint: 1 }, comet: { k: 'cells', glint: 1 }, solar: { k: 'hazard', glint: 1 }, plasma: { k: 'frost', glint: 1 }, nebula: { k: 'atom', glint: 2 }, quantum: { k: 'star', glint: 2 }, galactic: { k: 'eye', glint: 2, crown: 1 } };
const capsule = egg;

// ----- pets -----
// what a pet has beyond its ears, horn, tail and spines (pals.js builds the same parts): the birds (by name) a beak and wings; the
// spiny ones with a tail and a horn (dragons, wyverns, gargoyles, kirin) wings; the legendary ones (and a Crowned one) a crown; a
// pair of horns is a stag's antlers, or swept-back horns on the spiny (dragons) and the floppy-eared (rams, goats)
const BIRD = /\b(owl|owlet|raven|crow|penguin|griffin|gryphon|phoenix|hawk|eagle|falcon|parrot|duck|duckling|chick|swan)s?\b/i;
export function palLook(a) {
    const beak = BIRD.test((a && a.name) || '');
    return { beak, wing: beak || !!(a.spike && a.tail && a.horn), crown: (a.tier | 0) >= 4 || /crown/i.test(a.name || ''), hornB: a.horn === 2 && !!(a.spike || a.ear === 2), ant: !!a.ant };
}
// a pet: a round critter in its colours (lighter on top, a shine), big eyes lit in its accent colour, a blush, and its parts: ears
// (1 pointed, 2 floppy, 3 long), a spiral horn, antlers or swept-back horns, spines, wings, a tail (1 a puff, 2 a long one with a
// tuft or a spade), a beak, a crown
const BODY = 'M32 15C47 15 57 28 57 43C57 55 46 60 32 60C18 60 7 55 7 43C7 28 17 15 32 15Z';
// (a wing: three feathers fanned up and out from the shoulder, outlined as one shape)
const PWING = `<ellipse cx='12' cy='15' rx='4.4' ry='11' transform='rotate(-20 12 15)'/><ellipse cx='7.5' cy='22' rx='4.2' ry='10' transform='rotate(-42 7.5 22)'/><ellipse cx='6.5' cy='30' rx='3.8' ry='7.5' transform='rotate(-64 6.5 30)'/>`;
function critter(a) {
    const K = palLook(a), C1 = hex(a.c1), C2 = hex(a.c2), ol = ink(3), M = `transform='matrix(-1 0 0 1 64 0)'`, antl = a.horn === 2;
    let back = '', top = '', hornUp = '', defs = grad('g', [tint(a.c1, 0.38), C1, tint(a.c1, -0.18)]) + `<g id='e'><ellipse cx='22.5' cy='36' rx='5.6' ry='6.6' fill='${O}'/><ellipse cx='22.5' cy='38.6' rx='3.7' ry='3.5' fill='${C2}'/><circle cx='24.4' cy='33.4' r='2.2' fill='#fff'/><circle cx='20.4' cy='37.6' r='1' fill='#fff'/></g>`;
    if (K.wing) {
        defs += grad('wg', [tint(a.c2, 0.15), C1], 1, 0);
        const w = `<g stroke='${O}' stroke-width='5'>${PWING}</g><g fill='url(#wg)'>${PWING}</g><path d='M15 25L9.5 9M14 28L3.5 17.5' stroke='${tint(a.c1, -0.25)}' stroke-width='1.4' stroke-linecap='round'/>`;
        back += w + `<g ${M}>${w}</g>`;
    }
    // spines: a crest of three peeking over the head
    if (a.spike) { defs += grad('sp', [tint(a.c2, 0.35), tint(a.c2, -0.2)]); back += `<path d='M25 19L32 1.5L39 19ZM16.5 23L19.5 6L29 17.5ZM47.5 23L44.5 6L35 17.5Z' fill='url(#sp)' ${ol}/>`; }
    if (a.tail === 1) back += `<circle cx='53' cy='52' r='6.5' fill='${tint(a.c2, 0.1)}' ${ol}/>`;
    else if (a.tail === 2) {
        const d = 'M46 54C59 58 64 47 59 38';
        back += `<path d='${d}' fill='none' stroke='${O}' stroke-width='8.5' stroke-linecap='round'/><path d='${d}' fill='none' stroke='${C1}' stroke-width='4.5' stroke-linecap='round'/>`;
        back += a.spike && !K.beak ? `<path d='M59 28.5L63.5 35.5L59 41.5L54.5 35.5Z' fill='${C2}' ${ol}/>` : `<circle cx='59' cy='37' r='4.8' fill='${tint(a.c2, 0.15)}' ${ol}/>`;
    }
    // (under antlers the pointed ears stand out sideways, a stag's; long ones sweep out, or give way to swept-back horns)
    if (a.ear === 1 && antl) back += `<path id='p' d='M12 32L0 15L24 20Z' fill='${C1}' ${ol}/><use href='#p' ${M}/><path d='M12.6 26.4L5 18L19 20.6ZM51.4 26.4L59 18L45 20.6Z' fill='${tint(a.c2, 0.25)}'/>`;
    else if (a.ear === 1) back += `<path id='p' d='M13 32L9 5L31 19Z' fill='${C1}' ${ol}/><use href='#p' ${M}/><path d='M15.6 26L13 11.5L25.6 19.6ZM48.4 26L51 11.5L38.4 19.6Z' fill='${tint(a.c2, 0.25)}'/>`;
    else if (a.ear === 2) back += `<ellipse id='p' cx='10' cy='35' rx='7' ry='14' transform='rotate(16 10 35)' fill='${C2}' ${ol}/><use href='#p' ${M}/>`;
    else if (a.ear === 3 && !K.hornB) { const r = antl ? -38 : -10; back += `<ellipse id='p' cx='21' cy='12' rx='6.5' ry='14' transform='rotate(${r} 21 12)' fill='${C1}' ${ol}/><use href='#p' ${M}/><ellipse id='i' cx='21' cy='13' rx='3' ry='9.5' transform='rotate(${r} 21 13)' fill='${tint(a.c2, 0.2)}'/><use href='#i' ${M}/>`; }
    if (a.horn === 1) {
        defs += grad('h1', [tint(a.c2, 0.62), tint(a.c2, 0.2), tint(a.c2, 0.45)], 1, 0);
        // (through a crown, in front of it)
        hornUp = `<path d='M25.5 20L32 0.5L38.5 20Z' fill='url(#h1)' ${ol}/><path d='M27.6 15.4L36.6 12.4M29.3 10L35 8M30.8 5L33.6 4' stroke='${tint(a.c2, -0.3)}' stroke-width='2' stroke-linecap='round'/>`;
        if (!K.crown) { back += hornUp; hornUp = ''; }
    } else if (K.hornB) {
        defs += grad('hb', [tint(a.c2, 0.4), tint(a.c2, -0.15)]) + `<path id='hp' d='M16.5 23C14 13 9 7 2 3.5C12 2.5 22 8 27 18Z'/>`;
        back += `<use href='#hp' fill='url(#hb)' ${ol}/><use href='#hp' ${M} fill='url(#hb)' ${ol}/><path d='M11 9.5L15.5 7.5M15.5 15L20.5 12.5M53 9.5L48.5 7.5M48.5 15L43.5 12.5' stroke='${tint(a.c2, -0.35)}' stroke-width='1.6' stroke-linecap='round'/>`;
    } else if (antl) {
        const h = tint(a.c2, -0.08);
        defs += `<path id='h' d='M26 20C25 14 21 10 13 7.5M21 11.6L21.5 3.5M16 9L13 2.5M24.5 15.5L17.5 14.5'/>`;
        back += `<g fill='none' stroke-linecap='round' stroke-linejoin='round'><use href='#h' stroke='${O}' stroke-width='7.5'/><use href='#h' ${M} stroke='${O}' stroke-width='7.5'/><use href='#h' stroke='${h}' stroke-width='4'/><use href='#h' ${M} stroke='${h}' stroke-width='4'/></g>`;
    }
    // antennae: two stalks from the top of the head, a ball of light on each
    if (K.ant) back += `<g fill='none' stroke-linecap='round'><path d='M25 19Q21 9 14 6M39 19Q43 9 50 6' stroke='${O}' stroke-width='5.6'/><path d='M25 19Q21 9 14 6M39 19Q43 9 50 6' stroke='${tint(a.c1, -0.15)}' stroke-width='2.6'/></g><circle cx='13.5' cy='5.8' r='4.2' fill='${tint(a.c2, 0.3)}' ${ol}/><circle cx='50.5' cy='5.8' r='4.2' fill='${tint(a.c2, 0.3)}' ${ol}/><circle cx='12.4' cy='4.6' r='1.3' fill='#fff' opacity='.8'/><circle cx='49.4' cy='4.6' r='1.3' fill='#fff' opacity='.8'/>`;
    if (K.crown) top += `<path d='M21.5 19.5L20.5 8L26.5 13L32 5L37.5 13L43.5 8L42.5 19.5Z' fill='url(#y)' ${ol}/><path d='M22.5 16H41.5' stroke='#c8780a' stroke-width='1.6'/><circle cx='32' cy='12.6' r='2' fill='#ff3a5a' stroke='${O}' stroke-width='1.1'/><circle cx='26' cy='16.6' r='1.3' fill='#3ab4ff'/><circle cx='38' cy='16.6' r='1.3' fill='#3ab4ff'/>${shine(24, 12, 1.4, 2.6, -10, 0.7)}${hornUp}`;
    const face = K.beak ? `<path d='M26.5 41.5L37.5 41.5L32 50.5Z' fill='url(#bk)' ${ink(2.5)}/><path d='M29 43.3H35' stroke='#fff' stroke-opacity='.55' stroke-width='1.4' stroke-linecap='round'/>`
        : `<path d='M28 47Q30 50 32 47Q34 50 36 47' fill='none' stroke='${O}' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/><ellipse cx='32' cy='43.4' rx='2.3' ry='1.6' fill='${O}'/>`;
    if (K.beak) defs += grad('bk', ['#ffd86a', '#ff9a1a']);
    if (K.crown) defs += GOLD;
    return svg(`${back}<path d='${BODY}' fill='url(#g)' stroke='${O}' stroke-width='3.5'/><ellipse cx='32' cy='50.5' rx='14' ry='7.5' fill='${tint(a.c2, 0.15)}'/>
        <ellipse cx='15' cy='45' rx='4.5' ry='2.8' fill='#ff4a8a' opacity='.4'/><ellipse cx='49' cy='45' rx='4.5' ry='2.8' fill='#ff4a8a' opacity='.4'/>
        <use href='#e'/><use href='#e' x='19'/>${face}
        ${shine(21, 24, 7, 3, -30, 0.5)}<circle cx='13.6' cy='31' r='1.6' fill='#fff' opacity='.55'/>${top}`, defs);
}

// ----- boots -----
// a boot, side on (toe to the right), in one of four styles: a leather boot (a scalloped cuff, a buckled strap), plate (greaves and
// sabatons: a knee plate, lames across the foot, rivets), linen wraps (low, criss-cross straps), a hi-top kick (a collar, laces, a
// chunky keycap sole); c1 the leather or metal, c2 the trims. A glowing pair has a glowing sole and runes, a winged pair a wing at the heel
const BOOT = { wraps: 'wrap', iron: 'plate', knight: 'plate', frost: 'plate', dragon: 'plate', keystone: 'plate', clicky: 'kick', keycap: 'kick', rune: 'kick', royal: 'kick' };
const SHAPE = {
    boot: 'M15 13L37 13L36 33C41 35 49 36 54 38.5C58 40.5 60 43.5 60 47.5L60 50L10 50L10 45C10 39 12 35 13.5 31Z',
    wrap: 'M16 25L36 25L36 34C41 36 49 37 54 39.5C58 41.5 60 44 60 47.5L60 50L10 50L10 45.5C10 40 13 36 14.5 32Z',
    kick: 'M14 12L35 12L35.5 30C41 33 50 34 55 36.5C59 38.5 60.5 42 60.5 46L60.5 48L9.5 48L9.5 42C9.5 34 12 26 14 12Z',
};
const SOLE = {
    heel: 'M9 46.5L61 46.5L61 50.5C61 53 59.5 54.5 57 54.5L25 54.5L24 58L11 58L10 54.5C9 53.5 9 52 9 50.5Z',
    flat: 'M9 46.5L61 46.5L61 50.5C61 53 59.5 54.5 57 54.5L13 54.5C10.5 54.5 9 53 9 50.5Z',
    kick: 'M7 44L62 44L62 52C62 55 60 57 57 57L12 57C9 57 7 55 7 52Z',
};
// (the wing: three feathers fanned back from the ankle, outlined as one shape)
const FEATHERS = `<ellipse cx='10' cy='20.1' rx='9.5' ry='3.7' transform='rotate(198 10 20.1)'/><ellipse cx='11.9' cy='16.6' rx='9.5' ry='3.7' transform='rotate(222 11.9 16.6)'/><ellipse cx='15.1' cy='14.3' rx='9.5' ry='3.5' transform='rotate(246 15.1 14.3)'/>`;
function boot(G, pair) {
    const st = BOOT[G.id] || 'boot', glow = G.glow > 0, gc = lum(G.c2) > 0.4 ? G.c2 : G.c1, c2 = hex(G.c2), shape = SHAPE[st === 'plate' ? 'boot' : st], sole = SOLE[st === 'wrap' ? 'flat' : st === 'kick' ? 'kick' : 'heel'];
    const soleC = glow ? gc : st === 'kick' ? 0xf4f2ea : st === 'plate' ? 0x3a3e4a : 0x4a2c1c, dk = tint(G.c1, -0.4);
    let det = '', over = '';
    if (st === 'boot') {
        det += `<path d='M38 35.5C44 37.5 50 38.5 55 41' fill='none' stroke='${dk}' stroke-width='1.4' stroke-dasharray='2.4 2'/>`;
        over += `<path d='M11.5 6L40.5 6L39 19Q36 22.5 33 19Q30 22.5 27 19Q24 22.5 21 19Q18 22.5 15 19L13 19Z' fill='url(#c)' ${ink(3)}/>${shine(16, 9.5, 3.5, 1.5)}
            <path d='M12.8 33L36.3 31.5L36.6 37.5L12.2 39Z' fill='${tint(G.c2, -0.18)}' ${ink(2.5)}/><rect x='21' y='31.2' width='7.5' height='7.6' rx='1.2' fill='none' stroke='${O}' stroke-width='4.4'/><rect x='21' y='31.2' width='7.5' height='7.6' rx='1.2' fill='none' stroke='#ffd23a' stroke-width='2.2'/>`;
    } else if (st === 'plate') {
        det += `<path d='M13 26H37M12.4 33H36.4' stroke='${O}' stroke-width='2'/><path d='M41 35.5C43 39 43 43 42 46.5M47.5 37C49.5 40 49.5 43.5 48.5 46.5M53.5 39C55.5 41.5 55.5 44 54.5 46.5' fill='none' stroke='${O}' stroke-width='2' stroke-linecap='round'/>
            <rect x='17.5' y='21' width='3' height='24' rx='1.5' fill='#fff' opacity='.45'/><path d='M40 41C46 41 52 42 57 45' stroke='#fff' stroke-opacity='.45' stroke-width='2' stroke-linecap='round' fill='none'/>`;
        over += `<path d='M10.5 14C10.5 3.5 41.5 3.5 41.5 14L39.5 20L12.5 20Z' fill='url(#c)' ${ink(3)}/><path d='M26 6.5V19' stroke='${tint(G.c2, 0.45)}' stroke-width='2'/>${shine(17, 9, 3.5, 1.6, -20)}
            ${[[16, 15.5], [36, 15.5], [16, 29.5], [33, 29.5]].map(([x, y]) => `<circle cx='${x}' cy='${y}' r='1.6' fill='${tint(G.c2, 0.4)}' stroke='${O}' stroke-width='1'/>`).join('')}`;
    } else if (st === 'wrap') {
        det += `<g fill='none' stroke-linecap='round'><path d='M14 31L37 40M14 40L37 31M12 45L30 50.5M26 50.5L42 41' stroke='${O}' stroke-width='5.5'/><path d='M14 31L37 40M14 40L37 31M12 45L30 50.5M26 50.5L42 41' stroke='${c2}' stroke-width='3'/></g>`;
        over += `<rect x='13.5' y='20' width='25' height='8' rx='4' fill='url(#c)' ${ink(3)}/>${shine(18, 22.5, 3, 1.2)}`;
    } else {
        det += `<path d='M47 35.2C54 36.5 60.5 40 60.5 46L46 46Z' fill='${tint(G.c1, 0.55)}' ${ink(2.5)}/>${band('M15 38C24 33 33 34 44 39', 3.5, c2)}
            ${band('M29 20.5L37.5 23.5M29.5 25.5L39 28.5M30.5 30.5L41 33', 2.4, tint(G.c2, 0.25))}`;
        over += `<rect x='11.5' y='6.5' width='26' height='9.5' rx='4.75' fill='url(#c)' ${ink(3)}/>${shine(17, 9.5, 3.5, 1.4)}
            <path d='M7.5 50.5H61.5M21 44.5V56.5M34.5 44.5V56.5M48 44.5V56.5' stroke='${tint(soleC, -0.32)}' stroke-width='1.6'/>`;
        if (G.id === 'royal') over += `<path d='M17 31L16.4 23.5L20 26.5L23.5 21.5L27 26.5L30.6 23.5L30 31Z' fill='url(#y)' ${ink(2)}/>`;
    }
    // a glowing pair: runes lit along the shaft
    if (G.glow >= 0.6) det += `<path d='${st === 'wrap' ? 'M18 44L22 41L26 44' : 'M18 40L22 36.5L26 40M28.5 36L28.5 41'}' fill='none' stroke='${tint(gc, 0.55)}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/>`;
    const wing = G.wing ? `<g transform='translate(-3 9)'><g stroke='${O}' stroke-width='5'>${FEATHERS}</g><g fill='url(#w)'>${FEATHERS}</g><path d='M17 22L5 18M17.5 21L8 12.5M18.5 20L13 9' stroke='${tint(G.c2, 0.1)}' stroke-width='1.5' stroke-linecap='round'/></g>` : '';
    const one = `<path d='${shape}' fill='url(#g)'/><g clip-path='url(#k)'>${det}</g><path d='${shape}' fill='none' ${ink(4)}/>
        <path d='${sole}' fill='${hex(soleC)}' ${ink(3)}/>${glow ? shine(28, 49, 14, 1.2, 0, 0.75) : `<path d='M12 48.5H58' stroke='#fff' stroke-opacity='.3' stroke-width='1.5'/>`}${over}${wing}
        ${shine(st === 'kick' ? 12.5 : 13.5, 38, 1.8, 4.5)}${shine(52, 39.5, 3.5, 1.4, 20)}`;
    const back = pair ? `<g transform='translate(6 -5)'><path d='${shape}' fill='${tint(G.c1, -0.32)}' ${ink(4)}/><path d='${sole}' fill='${tint(soleC, -0.3)}' ${ink(3)}/></g>` : '';
    const halo = glow ? `<ellipse cx='33' cy='57' rx='30' ry='6' fill='${hex(gc)}' opacity='${f(0.25 + G.glow * 0.3)}'/>` : '';
    const sp = G.glow >= 0.85 ? sparkle(58, 8, 5, '#fffbe0') + sparkle(4, 12, 3.5) : '';
    return svg(`${halo}<g transform='${pair ? 'translate(1.5 4.5) scale(.9)' : 'translate(0 3)'}'>${back}${one}</g>${sp}`,
        grad('g', [tint(G.c1, 0.32), hex(G.c1), tint(G.c1, -0.18)]) + grad('c', [tint(G.c2, 0.45), c2, tint(G.c2, -0.12)]) + grad('w', ['#ffffff', tint(G.c2, 0.6)]) + GOLD
        + `<clipPath id='k'><path d='${shape}'/></clipPath>`);
}

const ICONS = {
    spin: wheel(),
    // rebirth: two gold arrows chasing each other round a gold star, on a turquoise orb
    rebirth: svg(`<circle cx='32' cy='32' r='27' fill='url(#b)' stroke='${O}' stroke-width='4'/>
        ${band('M16 32A16 16 0 0 1 40 18M48 32A16 16 0 0 1 24 46', 5.5, '#ffd23a')}<path d='M17.6 30A14.5 14.5 0 0 1 34 17.6M46.4 34A14.5 14.5 0 0 1 30 46.4' fill='none' stroke='#fff6c0' stroke-width='1.6' stroke-linecap='round'/>
        <path d='M34.7 24.3L48.7 23.1L42.7 10.5ZM29.3 39.7L15.3 40.9L21.3 53.5Z' fill='#ffc21e' stroke='${O}' stroke-width='3' stroke-linejoin='round'/>
        <path d='${star(32, 32, 9, 4)}' fill='url(#y)' stroke='${O}' stroke-width='2.5' stroke-linejoin='round'/>
        ${shine(21, 15, 9, 4, -30)}`, grad('b', ['#b8fff4', '#22b8b0', '#0e6a6e']) + GOLD),
    // a present (the daily rewards, FREE!): red with a gold ribbon and bow
    gift: svg(`<rect x='8' y='27' width='48' height='31' rx='4' fill='url(#b)' ${ink(3.5)}/><rect x='5' y='19' width='54' height='11' rx='3.5' fill='url(#l)' ${ink(3.5)}/>
        <rect x='28' y='19' width='8' height='39' fill='url(#y)' stroke='${O}' stroke-width='2.5'/>
        <path d='M32 19C24 5 11 8 15.5 15.5C18.5 19.5 27 19.5 32 19ZM32 19C40 5 53 8 48.5 15.5C45.5 19.5 37 19.5 32 19Z' fill='url(#y)' ${ink(3)}/>
        ${shine(15, 22.5, 5, 1.6)}<rect x='11.5' y='33' width='2.6' height='18' rx='1.3' fill='#fff' opacity='.35'/>${sparkle(57, 8, 4.5, '#fffbe0')}`, grad('b', ['#ff8a6a', '#d8281e']) + grad('l', ['#ffa88a', '#e8402e']) + GOLD),
    // the playtime gifts: a present with a clock on its corner
    giftclock: svg(`<g transform='translate(-3 -2) scale(.9)'><rect x='8' y='27' width='48' height='31' rx='4' fill='url(#b)' ${ink(3.8)}/><rect x='5' y='19' width='54' height='11' rx='3.5' fill='url(#l)' ${ink(3.8)}/>
        <rect x='28' y='19' width='8' height='39' fill='url(#y)' stroke='${O}' stroke-width='2.6'/>
        <path d='M32 19C24 5 11 8 15.5 15.5C18.5 19.5 27 19.5 32 19ZM32 19C40 5 53 8 48.5 15.5C45.5 19.5 37 19.5 32 19Z' fill='url(#y)' ${ink(3.2)}/>${shine(15, 22.5, 5, 1.6)}</g>
        <circle cx='47' cy='47' r='14' fill='url(#c)' ${ink(3.5)}/><circle cx='47' cy='47' r='10' fill='#fffdf4' stroke='${O}' stroke-width='1.5'/><path d='M47 40V47L52 50' fill='none' stroke='${O}' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/>${shine(42, 40, 3, 1.4, -30, 0.8)}`,
    grad('b', ['#ff8a6a', '#d8281e']) + grad('l', ['#ffa88a', '#e8402e']) + GOLD + grad('c', ['#8affa0', '#12b84e'])),
    // an Egg (the first one)
    chest: egg(0xf4f6fa, 0x2ab8b0, 0xe8fffc, CAPS.rookie),
    // the sectors: the lab in a round window of sky: a dome, a tower with its red beacon, hazard stripes along its foot, a cloud
    world: svg(`<circle cx='32' cy='32' r='27' fill='url(#s)'/><g clip-path='url(#cw)'>
        <ellipse cx='16' cy='19' rx='7' ry='3.2' fill='#fff' opacity='.9'/><ellipse cx='21' cy='16.5' rx='5' ry='3.6' fill='#fff' opacity='.9'/>
        <rect x='40' y='15' width='5.5' height='24' fill='url(#m)' stroke='${O}' stroke-width='2'/><circle cx='42.7' cy='12.5' r='3.2' fill='#ff3a3a' stroke='${O}' stroke-width='1.6'/>
        <path d='M8 39A14 14 0 0 1 36 39Z' fill='url(#d)' stroke='${O}' stroke-width='2.4'/><path d='M13 34A9 9 0 0 1 22 28' fill='none' stroke='#fff' stroke-opacity='.7' stroke-width='1.8' stroke-linecap='round'/>
        <rect x='3' y='38' width='58' height='12' fill='url(#b)' stroke='${O}' stroke-width='2.4'/>
        ${[9, 18, 27, 44, 53].map((x) => `<rect x='${x}' y='41.5' width='5' height='4.5' rx='1' fill='#5ae0d0' stroke='${O}' stroke-width='1.2'/>`).join('')}
        <rect x='0' y='50' width='64' height='4.5' fill='#22222c'/>${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<path d='M${i * 9 - 2} 54.5L${i * 9 + 2.5} 50L${i * 9 + 7} 50L${i * 9 + 2.5} 54.5Z' fill='#ffc21a'/>`).join('')}
        <rect x='0' y='54.5' width='64' height='10' fill='#8a96a8'/></g>
        <circle cx='32' cy='32' r='27' fill='none' stroke='${O}' stroke-width='4'/>${shine(18, 17, 6, 2.6, -35, 0.6)}${sparkle(55, 9, 4.5, '#fffbe0')}`,
    grad('s', ['#8ae0ff', '#3aa8e8']) + grad('b', ['#ffffff', '#c8d2de']) + grad('d', ['#e8fffc', '#5ad8c8']) + grad('m', ['#f0f4f8', '#8a96a8'], 1, 0) + GOLD + `<clipPath id='cw'><circle cx='32' cy='32' r='25.5'/></clipPath>`),
    // quests: a lab clipboard with a checklist ticked off, a gold star badge on its corner
    quest: svg(`<rect x='9' y='7' width='44' height='54' rx='5' fill='url(#c)' ${ink(3.5)}/>
        <rect x='14' y='14' width='34' height='42' rx='2' fill='url(#p)' stroke='${O}' stroke-width='2.4'/>
        <rect x='21' y='3' width='20' height='9' rx='3' fill='url(#m)' ${ink(3)}/><circle cx='31' cy='7.5' r='1.8' fill='${O}'/>
        <path d='M18 24L21 27.5L26.5 20.5M18 37.5L21 41L26.5 34' fill='none' stroke='#2a9a3a' stroke-width='3.4' stroke-linecap='round' stroke-linejoin='round'/>
        <path d='M30 24H43M30 37.5H43M19 48.5H37' stroke='#6a7a8a' stroke-width='3' stroke-linecap='round'/>
        <circle cx='50' cy='48' r='10.5' fill='url(#y)' ${ink(3)}/><path d='${star(50, 48.5, 5.6, 2.5)}' fill='#fff6c0' stroke='${O}' stroke-width='1.5' stroke-linejoin='round'/>${shine(14, 11, 4, 1.2)}${shine(46, 43, 2.6, 1.4, -30, 0.7)}`,
    grad('c', ['#5ae0d0', '#1a8a8a']) + grad('p', ['#ffffff', '#e4ecf2']) + grad('m', ['#ffffff', '#c4ccd8', '#6a7488']) + GOLD),
    // settings: a steel gear
    gear: svg(`<g fill='url(#m)' stroke='${O}' stroke-width='3.5' stroke-linejoin='round'>${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<rect x='26' y='3' width='12' height='16' rx='3' transform='rotate(${a} 32 32)'/>`).join('')}<circle cx='32' cy='32' r='20'/></g>
        <circle cx='32' cy='32' r='10.5' fill='url(#y)' stroke='${O}' stroke-width='3'/><circle cx='32' cy='32' r='4.2' fill='${O}'/>
        ${shine(23, 20, 7, 3.2, -35)}${shine(28.5, 27.5, 2.6, 1.3, -35, 0.7)}`, grad('m', ['#ffffff', '#c8d2de', '#5a6878']) + GOLD),
    // the shop: a steel lab basket, a Gem and gold coins peeking over its rim
    shop: svg(`<path d='M14 30Q32 0 50 30' fill='none' stroke='${O}' stroke-width='7.5' stroke-linecap='round'/><path d='M14 30Q32 0 50 30' fill='none' stroke='#5ae0d0' stroke-width='3.6' stroke-linecap='round'/>
        <g stroke='${O}' stroke-width='2.4'><ellipse cx='20' cy='27' rx='8' ry='3.4' fill='url(#y)'/><ellipse cx='44' cy='26' rx='7.5' ry='3.3' fill='url(#y)'/></g>
        <path d='M25 17L39 17L43 22.5L32 34L21 22.5Z' fill='url(#g)' stroke='${O}' stroke-width='2.6' stroke-linejoin='round'/><path d='M21 22.5H43M28 17L32 34L36 17' fill='none' stroke='#fff' stroke-opacity='.5' stroke-width='1.3'/>
        <path d='M6 31H58L52.5 57C52 59.5 50.5 61 48 61H16C13.5 61 12 59.5 11.5 57Z' fill='url(#w)' ${ink(3.5)}/>
        <g clip-path='url(#cb)' stroke='#4a5a6e' stroke-width='1.8'><path d='M6 40H58M6 49H58'/><path d='M18 31V62M28 31V62M38 31V62M48 31V62' stroke-dasharray='4.5 4.5'/></g>
        <rect x='3' y='27.5' width='58' height='7' rx='3.5' fill='url(#r)' ${ink(3)}/>${shine(14, 39, 2, 6, 10, 0.4)}${sparkle(56, 9, 4.5, '#fffbe0')}`,
    grad('w', ['#eef4fa', '#8a9ab0']) + grad('r', ['#7af0e0', '#1a8a8a']) + GOLD + grad('g', ['#e0ffff', '#5ad8ff', '#1a6ae8']) + `<clipPath id='cb'><path d='M6 31H58L52.5 57C52 59.5 50.5 61 48 61H16C13.5 61 12 59.5 11.5 57Z'/></clipPath>`),
    tongue: boot({ id: 'clicky', c1: 0xf4f6fa, c2: 0x2ab8b0, glow: 0, wing: 1 }),
    // pets: a little anomaly dragon, lime with violet horns and spines, wings and a spade tail
    pal: critter({ name: '', c1: 0x8aff3a, c2: 0xb46aff, ear: 0, horn: 2, tail: 2, spike: 1, tier: 3 }),
    // upgrades (the Upgrade Lab): a round-bottomed flask of bubbling goo, sparks flying off it
    work: svg(`<path d='M25.5 21V9H38.5V21L52 50C54.5 55.5 51 60 45.5 60H18.5C13 60 9.5 55.5 12 50Z' fill='url(#g)' ${ink(3.5)}/>
        <path d='M16.6 40H47.4L52 50C54.5 55.5 51 60 45.5 60H18.5C13 60 9.5 55.5 12 50Z' fill='url(#l)' stroke='${O}' stroke-width='2.2'/>
        <path d='M16.6 40Q24 43 32 40T47.4 40' fill='none' stroke='#e8ffb0' stroke-width='2' stroke-linecap='round'/>
        ${[[24, 50, 2.6], [36, 47, 2], [41, 54, 1.6], [30, 33, 2], [34, 25, 1.5]].map(([x, y, r]) => `<circle cx='${x}' cy='${y}' r='${r}' fill='#f4ffd8' stroke='${O}' stroke-width='1.1'/>`).join('')}
        <rect x='22' y='4' width='20' height='6.5' rx='2.5' fill='url(#m)' ${ink(3)}/>${shine(19, 47, 1.8, 5, 25, 0.5)}${sparkle(51, 16, 5, '#e8ffb0')}${sparkle(57, 27, 3.2, '#ffe24a')}`,
    grad('g', ['#ffffff', '#d8eef4']) + grad('l', ['#d8ff8a', '#6ad83a', '#2a8a1a']) + grad('m', ['#ffffff', '#c4ccd8', '#6a7488'])),
    // a Gem: a turquoise-blue jewel
    gem: svg(`<path d='M14 10L50 10L61 26L32 58L3 26Z' fill='url(#g)' stroke='${O}' stroke-width='4' stroke-linejoin='round'/>
        <path d='M3 26L61 26M14 10L22 26L32 58L42 26L50 10M22 26L32 10L42 26' fill='none' stroke='#fff' stroke-opacity='.55' stroke-width='2'/>
        <path d='M14 10L22 26L3 26Z' fill='#fff' opacity='.35'/>${shine(20, 16, 5, 2.5, -20, 0.7)}${sparkle(53, 50, 5.5)}`, grad('g', ['#e8ffff', '#5ad8ff', '#1a6ae8'])),
    // a keycap (the floor's keys): hazard yellow, a +1 on it
    keycap: svg(`<path d='M8 18C8 12 12 9 18 9L46 9C52 9 56 12 56 18L58 51C58 56.5 54.5 59.5 49 59.5L15 59.5C9.5 59.5 6 56.5 6 51Z' fill='url(#k)' stroke='${O}' stroke-width='4' stroke-linejoin='round'/>
        <path d='M15.5 12.5L48.5 12.5C51.5 12.5 53 14.5 53 17.5L51.5 40C51.3 43 49.5 45 46.5 45L17.5 45C14.5 45 12.7 43 12.5 40L11 17.5C11 14.5 12.5 12.5 15.5 12.5Z' fill='url(#t)' stroke='${O}' stroke-width='2.5' stroke-linejoin='round'/>
        <path d='M18.5 29H29.5M24 23.5V34.5M35 25.5L39.5 22.5V35M35.5 35H43.5' fill='none' stroke='#4a2a10' stroke-width='3.8' stroke-linecap='round' stroke-linejoin='round'/>
        ${shine(19, 16.5, 5, 1.6)}`, grad('k', ['#f0c040', '#c88a1a']) + grad('t', ['#fff6c8', '#ffd84a'])),
    // Wins: a gold trophy with handles, a star on it, on a teal base
    trophy: svg(`<path d='M14 14H6C6 26 11 31 18 32M50 14H58C58 26 53 31 46 32' fill='none' stroke='${O}' stroke-width='8' stroke-linecap='round'/>
        <path d='M14 14H6C6 26 11 31 18 32M50 14H58C58 26 53 31 46 32' fill='none' stroke='#ffc21e' stroke-width='4' stroke-linecap='round'/>
        <path d='M13 8H51V22C51 34 42 42 32 42C22 42 13 34 13 22Z' fill='url(#y)' ${ink(3.5)}/><path d='M27 41H37L39 50H25Z' fill='#ffb21e' ${ink(3)}/>
        <rect x='16' y='49' width='32' height='10' rx='2.5' fill='url(#b)' ${ink(3)}/><path d='${star(32, 23, 8, 3.6)}' fill='#fff6c0' stroke='${O}' stroke-width='2' stroke-linejoin='round'/>
        ${shine(19.5, 16, 2.6, 6, 0, 0.6)}${sparkle(56, 7, 4.5, '#fffbe0')}`, GOLD + grad('b', ['#5ae0d0', '#1a8a8a'])),
    // Upgrade: a fat green arrow pointing up
    up: svg(`<path d='M32 4L59 31L44 31L44 59L20 59L20 31L5 31Z' fill='url(#g)' ${ink(4)}/><path d='M32 11L49 27.5' stroke='#fff' stroke-opacity='.6' stroke-width='3' stroke-linecap='round'/>
        ${shine(25.5, 42, 2.4, 9, 0, 0.4)}${sparkle(55, 50, 4.5, '#fffbe0')}`, grad('g', ['#c8ff9a', '#3ad84a', '#168a2a'])),
    // Pets: a little lab mouse, pink ears up
    bag: critter({ name: '', c1: 0xf4f4f8, c2: 0xffb0c8, ear: 1, horn: 0, tail: 2, spike: 0, tier: 0 }),
    // Teleport: a steel security door frame, hazard stripes on its posts, a red lamp over it, a portal swirling in it
    portal: svg(`<path d='M7 61V30C7 15 18 4 32 4C46 4 57 15 57 30V61Z' fill='url(#a)' ${ink(3.5)}/>
        <path d='M16.5 61V32C16.5 22 23.5 14.5 32 14.5C40.5 14.5 47.5 22 47.5 32V61Z' fill='url(#p)' stroke='${O}' stroke-width='2.6'/>
        <path d='M29.5 40A2.5 2.5 0 0 1 34.5 40A5.5 5.5 0 0 1 23.5 40A8.5 8.5 0 0 1 40.5 40A11 11 0 0 1 20 40' fill='none' stroke='#e8ffff' stroke-width='2.8' stroke-linecap='round'/>
        <g stroke='${O}' stroke-width='1.2'><rect x='8.5' y='40' width='7' height='13' fill='#ffc21a'/><rect x='48.5' y='40' width='7' height='13' fill='#ffc21a'/></g>
        <path d='M8.5 44.5L15.5 40.5M8.5 49.5L15.5 45.5M10 53L15.5 50M48.5 44.5L55.5 40.5M48.5 49.5L55.5 45.5M50 53L55.5 50' stroke='${O}' stroke-width='2'/>
        <circle cx='32' cy='9.5' r='3' fill='#ff3a3a' stroke='${O}' stroke-width='1.5'/>${shine(12, 22, 2.2, 6, 10, 0.5)}${sparkle(56, 8, 4.5, '#fffbe0')}`,
    grad('a', ['#f0f4f8', '#a8b4c4', '#6a7488']) + `<radialGradient id='p' cy='.62'><stop offset='0' stop-color='#e8ffff'/><stop offset='.55' stop-color='#3ad8e8'/><stop offset='1' stop-color='#1a4ab8'/></radialGradient>`),
    // Sound: a speaker sending out waves; mute: the same with a red cross
    sound: svg(`<path d='M7 23H19L34 9V55L19 41H7Z' fill='url(#s)' ${ink(4)}/>
        <path d='M42 22C46.5 26.5 46.5 37.5 42 42M49 15C57 22 57 42 49 49' fill='none' stroke='${O}' stroke-width='8' stroke-linecap='round'/>
        <path d='M42 22C46.5 26.5 46.5 37.5 42 42M49 15C57 22 57 42 49 49' fill='none' stroke='#fff' stroke-width='4' stroke-linecap='round'/>${shine(14, 27, 3.5, 1.5)}`,
    grad('s', ['#fff4d8', '#ffc858', '#c8781a'])),
    mute: svg(`<path d='M7 23H19L34 9V55L19 41H7Z' fill='url(#s)' ${ink(4)}/>
        <path d='M41 23L58 41M58 23L41 41' stroke='${O}' stroke-width='9' stroke-linecap='round'/><path d='M41 23L58 41M58 23L41 41' stroke='#ff3a5a' stroke-width='5' stroke-linecap='round'/>${shine(14, 27, 3.5, 1.5)}`,
    grad('s', ['#fff4d8', '#d8c8a8', '#8a7a62'])),
    // Treadmill: a steel lab treadmill, a dark belt with teal marks, its handle up behind
    tread: svg(`<path d='M45 8L53 8L51 40' fill='none' stroke='${O}' stroke-width='8' stroke-linecap='round' stroke-linejoin='round'/><path d='M45 8L53 8L51 40' fill='none' stroke='#c8d2de' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'/>
        <rect x='3' y='38' width='58' height='19' rx='9.5' fill='url(#m)' ${ink(4)}/><rect x='9' y='43' width='46' height='9' rx='4.5' fill='#2a2e38'/>
        <path d='M15 47.5H23M29 47.5H37M43 47.5H49' stroke='#5ae0d0' stroke-width='2.8' stroke-linecap='round'/>
        <path d='M10 24C10 21 12 19 15 19L41 19C44 19 46 21 46 24L46 33C46 35 45 36 43 36L13 36C11 36 10 35 10 33Z' fill='url(#k)' ${ink(3)}/><path d='M19 27.5H23.5M21.2 25.2V29.8M29 25.5L31.5 24V31' fill='none' stroke='#4a2a10' stroke-width='2.4' stroke-linecap='round'/>${shine(17, 23, 4.5, 1.4)}`,
    grad('m', ['#e8ecf2', '#a8b4c4', '#5a6878']) + grad('k', ['#fff6c8', '#ffd84a'])),
    // RACE (Purge Run): the lockdown alarm, a red beacon flashing on its hazard-striped base, light rays round it
    race: svg(`<path d='M10 30L3 23M54 30L61 23M8 42H1M56 42H63M15 18L10 9M49 18L54 9' stroke='${O}' stroke-width='6.5' stroke-linecap='round'/>
        <path d='M10 30L3 23M54 30L61 23M8 42H1M56 42H63M15 18L10 9M49 18L54 9' stroke='#ffe24a' stroke-width='3' stroke-linecap='round'/>
        <path d='M16 45C16 27 22 16 32 16C42 16 48 27 48 45Z' fill='url(#r)' ${ink(3.5)}/><path d='M22.5 42C22.5 31 25.5 23 30.5 21.5' stroke='#fff' stroke-opacity='.6' stroke-width='3' stroke-linecap='round' fill='none'/>
        <rect x='10' y='44' width='44' height='8' rx='2.5' fill='url(#m)' ${ink(3)}/>
        <rect x='13' y='51' width='38' height='9' rx='2' fill='#ffc21a' ${ink(3)}/><path d='M19 60L24 51M28 60L33 51M37 60L42 51M46 60L49 54.5' stroke='${O}' stroke-width='2.4'/>`,
    grad('r', ['#ffb0a0', '#ff3a2a', '#a80c12']) + grad('m', ['#f0f4f8', '#8a96a8'])),
    // Codes: a golden ticket
    code: svg(`<path d='M5 17H59V27A5 5 0 0 0 59 37V47H5V37A5 5 0 0 0 5 27Z' fill='url(#t)' ${ink(3.5)}/><path d='M43 20V44' stroke='${O}' stroke-width='2.2' stroke-dasharray='3 3'/>
        <path d='M13 28H34M13 36H27' stroke='#a8501a' stroke-width='3.2' stroke-linecap='round'/><path d='${star(51, 32, 4.5, 2)}' fill='#ff3a5a' stroke='${O}' stroke-width='1.4'/>${shine(13, 21, 5, 1.5)}`,
    grad('t', ['#fff0a0', '#ffb21e'])),
    // a revive: a red heart
    heart: svg(`<path d='M32 57C14 44 5 34 5 21C5 12 12 6 20 6C26 6 30 9 32 14C34 9 38 6 44 6C52 6 59 12 59 21C59 34 50 44 32 57Z' fill='url(#r)' ${ink(4)}/>
        ${shine(18, 17, 6.5, 3.5, -30, 0.6)}`, grad('r', ['#ff9aaa', '#e8183c', '#a00c22'])),
    // x2 Speed: a fat gold lightning bolt
    bolt: svg(`<path d='M39 3L11 37H29L22 61L53 24H35Z' fill='url(#y)' ${ink(4)}/><path d='M35 9L19 31' stroke='#fff' stroke-opacity='.6' stroke-width='2.6' stroke-linecap='round'/>${sparkle(54, 49, 5, '#fffbe0')}${sparkle(9, 52, 3.5)}`, GOLD),
    // STATS: three bars rising, a gold star over the tallest
    stats: svg(`<rect x='5' y='54' width='54' height='6' rx='3' fill='#a8642a' ${ink(2.6)}/><rect x='9' y='34' width='12' height='21' rx='2.5' fill='url(#a)' ${ink(3)}/><rect x='26' y='24' width='12' height='31' rx='2.5' fill='url(#b)' ${ink(3)}/><rect x='43' y='13' width='12' height='42' rx='2.5' fill='url(#c)' ${ink(3)}/>
        <path d='${star(49, 7, 6, 2.6)}' fill='url(#y)' stroke='${O}' stroke-width='2' stroke-linejoin='round'/>${shine(13, 38, 1.4, 4)}${shine(30, 28, 1.4, 5)}${shine(47, 17, 1.4, 6)}`,
    grad('a', ['#ffb0a0', '#e8402e']) + grad('b', ['#ffe08a', '#f0a010']) + grad('c', ['#a8fff0', '#18a89c']) + GOLD),
};
// a pair of boots' picture for the boot shop: its colours and style, a glowing sole, wings on the best; the second boot peeks out behind
export function tongueSvg(G) { return uri(boot(G, true)); }
// a pet's picture: its colours, ears, horns, spines, wings, tail and crown; eyes lit in its accent colour
export function palSvg(a) { return uri(critter(a)); }
// an Egg's picture (the eggs are called JAWBREAKERS in the code): its colours and pattern, the rarest ones sparkling more
export function jawSvg(J) { return uri(capsule(J.c1, J.c2, J.c3, CAPS[J.id] || CAPS.rookie)); }
export function installIcons() {
    const st = document.createElement('style');
    st.textContent = Object.entries(ICONS).map(([k, s]) => `.ic-${k}{background-image:url("${uri(s)}")}`).join('\n');
    document.head.appendChild(st);
}
