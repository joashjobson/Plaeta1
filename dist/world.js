// Plaeta's own world: a pixel-art planet drawn live on a canvas, used on the website's front page and the app's first-run
// screen. It follows real physics in a simple way:
// - one distant sun lights everything from the same direction, so the planet and its moon show the same phase;
// - the planet spins west to east (its near side moves left to right) about a tilted axis, with ice at the poles,
//   cloud belts where real ones form (the equator and mid-latitudes, clear subtropics), a blue atmosphere on the lit
//   limb and a sun glint on the sea;
// - the moon is tidally locked (the same face always points at the planet), orbits the same way the planet spins, in
//   the planet's equatorial plane, hides behind the planet, casts its shadow on the planet when it passes in front and
//   goes dark when it passes through the planet's shadow.
// Usage: <canvas data-world width="260" height="260"></canvas> plus this file as a module, or mountWorld(canvas).

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const norm = v => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// view space: x right, y down, z toward the viewer
const SUN = norm([-0.58, -0.4, 0.71]);
const HALF = norm([SUN[0], SUN[1], SUN[2] + 1]); // halfway between the sun and the viewer, for the sea's glint
// the spin axis: north tipped 14 degrees toward the viewer, then leaning 20 degrees to the left
const AXIS = (() => {
  const b = 14 * Math.PI / 180, g = -20 * Math.PI / 180;
  const n = [0, -Math.cos(b), Math.sin(b)];
  return norm([n[0] * Math.cos(g) - n[1] * Math.sin(g), n[0] * Math.sin(g) + n[1] * Math.cos(g), n[2]]);
})();
const E1 = norm([AXIS[1], -AXIS[0], 0]);
const E2 = [E1[1] * AXIS[2] - E1[2] * AXIS[1], E1[2] * AXIS[0] - E1[0] * AXIS[2], E1[0] * AXIS[1] - E1[1] * AXIS[0]];

// 4x4 ordered dither, the pixel-art way to blend light into shadow
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);

// seeded 3D value noise, sampled on the sphere so the maps have no seam
function hash(x, y, z, s) {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(z, 0x9e3779b1) ^ Math.imul(s, 0x85ebca77);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise(x, y, z, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const f = t => t * t * (3 - 2 * t);
  const u = f(x - xi), v = f(y - yi), w = f(z - zi);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash(xi + dx, yi + dy, zi + dz, s);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v), l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
function fbm(p, k, oct, s) {
  let a = 0.5, t = 0, n = 0;
  for (let i = 0; i < oct; i++) { t += a * noise(p[0] * k + 11.3 * i, p[1] * k - 7.1 * i, p[2] * k + 3.7 * i, s + i); n += a; a *= 0.5; k *= 2.03; }
  return t / n;
}

// the planet's surface and clouds, as longitude-latitude maps
const PAL = {
  deep: hex('#1d4a8c'), sea: hex('#2b66ad'), shelf: hex('#3f8cc4'), coast: hex('#6fb4d6'),
  sand: hex('#dcc48e'), dry: hex('#c3ab6c'), grass: hex('#89a65a'), green: hex('#5f8f4e'), forest: hex('#3f6f44'),
  tundra: hex('#8f9a7e'), rock: hex('#93836d'), peak: hex('#b9ad99'), ice: hex('#eef4f9'),
};
function planetMaps(W, H, seed) {
  const col = new Uint8ClampedArray(W * H * 3), sea = new Uint8Array(W * H), cloud = new Float32Array(W * H);
  for (let j = 0; j < H; j++) {
    const lat = (0.5 - (j + 0.5) / H) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat), al = Math.abs(lat) * 180 / Math.PI;
    for (let i = 0; i < W; i++) {
      const lon = (i + 0.5) / W * TAU, p = [cl * Math.cos(lon), sl, cl * Math.sin(lon)], k = j * W + i;
      const e = fbm(p, 1.6, 6, seed) + 0.18 * (fbm(p, 0.7, 2, seed + 40) - 0.5);
      const m = fbm(p, 2.4, 4, seed + 80);
      const SEA = 0.52;
      let c;
      if (al + (e - 0.5) * 30 > 74) c = PAL.ice; // polar caps, ragged at the edge
      else if (e < SEA) { sea[k] = 1; c = e < SEA - 0.1 ? PAL.deep : e < SEA - 0.045 ? PAL.sea : e < SEA - 0.015 ? PAL.shelf : PAL.coast; }
      else {
        const h = e - SEA;
        // deserts sit near 25 degrees, where dry air sinks; wetter land near the equator and in the mid-latitudes
        const wet = m + 0.22 * Math.cos((al - 2) * Math.PI / 40) * (al < 40 ? 1 : 0) - 0.24 * Math.exp(-((al - 25) ** 2) / 90) + (al > 45 ? 0.08 : 0);
        if (h > 0.14) c = h > 0.19 ? PAL.peak : PAL.rock;
        else if (al > 60) c = PAL.tundra;
        else if (wet < 0.38) c = PAL.sand;
        else if (wet < 0.45) c = PAL.dry;
        else if (wet < 0.52) c = PAL.grass;
        else if (wet < 0.6) c = PAL.green;
        else c = PAL.forest;
      }
      col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2];
      // cloud belts: the tropics' storm band at the equator and the storm tracks near 55 degrees; clear near 25
      const belt = 0.55 * Math.exp(-(al * al) / 60) + 0.45 * Math.exp(-((al - 55) ** 2) / 160) - 0.25 * Math.exp(-((al - 25) ** 2) / 70);
      const q = fbm([p[0] * 1.0, p[1] * 2.2, p[2] * 1.0], 2.2, 5, seed + 120) + belt * 0.32;
      cloud[k] = q > 0.68 ? 0.95 : q > 0.635 ? 0.55 : q > 0.61 ? 0.22 : 0;
    }
  }
  return { W, H, col, sea, cloud };
}
function moonMap(W, H, seed) {
  const col = new Uint8ClampedArray(W * H * 3);
  const craters = [];
  let q = 0; const rnd = () => hash(q++, 5, 9, seed);
  for (let n = 0; n < 22; n++) { const z = rnd() * 2 - 1, a = rnd() * TAU, r = Math.sqrt(1 - z * z); craters.push([r * Math.cos(a), z, r * Math.sin(a), 0.06 + rnd() * rnd() * 0.22]); }
  for (let j = 0; j < H; j++) {
    const lat = (0.5 - (j + 0.5) / H) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
    for (let i = 0; i < W; i++) {
      const lon = (i + 0.5) / W * TAU, p = [cl * Math.cos(lon), sl, cl * Math.sin(lon)];
      let v = 0.62 + 0.25 * (fbm(p, 3, 4, seed) - 0.5);
      if (fbm(p, 1.3, 3, seed + 9) > 0.56) v -= 0.17; // dark lava plains
      let cr = 0;
      for (const c of craters) {
        const d = Math.acos(clamp(p[0] * c[0] + p[1] * c[1] + p[2] * c[2], -1, 1)) / c[3];
        if (d < 0.75) cr = -0.1; else if (d < 1 && cr >= 0) cr = 0.08; // a dark floor inside a bright rim
      }
      v += cr;
      v = Math.round(clamp(v) * 6) / 6;
      const k = (j * W + i) * 3;
      col[k] = 30 + v * 190; col[k + 1] = 30 + v * 186; col[k + 2] = 38 + v * 182;
    }
  }
  return { W, H, col };
}

const NIGHT = hex('#1f2547');
let MAPS = null;
const maps = () => MAPS || (MAPS = { planet: planetMaps(512, 256, 7), moon: moonMap(96, 48, 3) });

// shade one sphere into the buffer. c: centre [x, y, z] in canvas pixels; r: radius; spin: turn about the axis
function sphere(buf, Wc, Hc, c, r, map, spin, o) {
  const x0 = Math.max(0, Math.floor(c[0] - r - 2)), x1 = Math.min(Wc - 1, Math.ceil(c[0] + r + 2));
  const y0 = Math.max(0, Math.floor(c[1] - r - 2)), y1 = Math.min(Hc - 1, Math.ceil(c[1] + r + 2));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const dx = (x + 0.5 - c[0]) / r, dy = (y + 0.5 - c[1]) / r, d2 = dx * dx + dy * dy;
    const k = (y * Wc + x) * 4, bay = BAYER[(y & 3) * 4 + (x & 3)];
    if (d2 > 1) {
      // a thin blue atmosphere just beyond the lit edge
      if (o.atmo && d2 < (1 + 2.2 / r) ** 2) {
        const l = dx * SUN[0] + dy * SUN[1];
        if (l > 0.05 && bay < 0.35 + l * 0.6) { buf[k] = 168; buf[k + 1] = 204; buf[k + 2] = 255; buf[k + 3] = 150; }
      }
      continue;
    }
    const n = [dx, dy, Math.sqrt(1 - d2)];
    const lat = Math.asin(clamp(dot(n, AXIS), -1, 1));
    const lon = Math.atan2(dot(n, E2), dot(n, E1));
    const u = (((lon - spin) / TAU) % 1 + 1) % 1, v = 0.5 - lat / Math.PI;
    const ti = Math.min(map.H - 1, Math.floor(v * map.H)) * map.W + Math.min(map.W - 1, Math.floor(u * map.W));
    let cr = map.col[ti * 3], cg = map.col[ti * 3 + 1], cb = map.col[ti * 3 + 2];
    if (map.cloud) {
      const cu = (((lon - spin * 0.94 - 0.6) / TAU) % 1 + 1) % 1;
      const a = map.cloud[Math.min(map.H - 1, Math.floor(v * map.H)) * map.W + Math.min(map.W - 1, Math.floor(cu * map.W))];
      if (a && bay < a + 0.04) { cr = 250; cg = 252; cb = 255; }
    }
    let lit = dot(n, SUN);
    // is this point in another body's shadow? (a ray toward the sun hits the other sphere; the edge is dithered)
    if (o.shadowOf && lit > 0) {
      const S = [c[0] + n[0] * r, c[1] + n[1] * r, c[2] + n[2] * r], q = o.shadowOf;
      const D = [q.c[0] - S[0], q.c[1] - S[1], q.c[2] - S[2]], t = dot(D, SUN);
      if (t > 0) { const m = Math.sqrt(Math.max(0, dot(D, D) - t * t)) / q.r; if (m < 0.85 + bay * 0.3) lit = Math.min(lit, 0.04); }
    }
    // light falls off across a soft twilight band, dithered into a few steps
    const day = clamp(lit * 2.4 + 0.18);
    const lv = clamp(Math.floor(day * 4 + bay) / 4);
    const b = 0.8 + 0.32 * clamp(lit);
    let r2 = cr * b, g2 = cg * b, b2 = cb * b;
    if (map.sea && map.sea[ti] && !(map.cloud && cr === 250)) {
      const g = Math.pow(clamp(dot(n, HALF)), 220);
      if (g > 0.55 + bay * 0.4) { r2 = 255; g2 = 248; b2 = 222; } else { r2 += g * 110; g2 += g * 105; b2 += g * 80; }
    }
    if (o.atmo) { const rim = Math.pow(1 - n[2], 3) * clamp(lit + 0.35); r2 += (160 - r2) * rim * 0.75; g2 += (200 - g2) * rim * 0.75; b2 += (255 - b2) * rim * 0.75; }
    const nr = NIGHT[0] * 0.85 + cr * 0.06, ng = NIGHT[1] * 0.85 + cg * 0.06, nb = NIGHT[2] * 0.85 + cb * 0.06;
    buf[k] = nr + (r2 - nr) * lv; buf[k + 1] = ng + (g2 - ng) * lv; buf[k + 2] = nb + (b2 - nb) * lv; buf[k + 3] = 255;
  }
}

function orbitDots(buf, Wc, Hc, C, a, behind, planetR) {
  const steps = Math.round(a * 2.2);
  for (let i = 0; i < steps; i += 1) {
    if (i % 3) continue;
    const th = i / steps * TAU, P = [a * (Math.cos(th) * E1[0] + Math.sin(th) * E2[0]), a * (Math.cos(th) * E1[1] + Math.sin(th) * E2[1]), a * (Math.cos(th) * E1[2] + Math.sin(th) * E2[2])];
    if ((P[2] < 0) !== behind) continue;
    if (behind && P[0] * P[0] + P[1] * P[1] < planetR * planetR) continue;
    const x = Math.floor(C[0] + P[0]), y = Math.floor(C[1] + P[1]);
    if (x < 0 || y < 0 || x >= Wc || y >= Hc) continue;
    const k = (y * Wc + x) * 4;
    buf[k] = 90; buf[k + 1] = 118; buf[k + 2] = 200; buf[k + 3] = behind ? 70 : 120;
  }
}

// draws the scene at time t (seconds)
export function drawWorld(ctx, t, opt = {}) {
  const Wc = ctx.canvas.width, Hc = ctx.canvas.height, M = maps();
  const R = opt.radius || Math.round(Wc * 0.37), C = [Wc / 2, Hc / 2, 0];
  const day = opt.day || 36, month = opt.month || 110;
  const spin = t / day * TAU, th = 1.15 + t / month * TAU;
  const img = ctx.createImageData(Wc, Hc), buf = img.data;
  const moon = opt.moon !== false;
  const a = Math.round(Wc * 0.455), mr = Math.max(4, Math.round(Wc * 0.042));
  const mc = [C[0] + a * (Math.cos(th) * E1[0] + Math.sin(th) * E2[0]), C[1] + a * (Math.cos(th) * E1[1] + Math.sin(th) * E2[1]), a * (Math.cos(th) * E1[2] + Math.sin(th) * E2[2])];
  const planet = () => sphere(buf, Wc, Hc, C, R, M.planet, spin, { atmo: true, shadowOf: moon ? { c: mc, r: mr } : null });
  // tidally locked: the moon turns once per orbit, keeping one face toward the planet
  const moonDraw = () => sphere(buf, Wc, Hc, mc, mr, M.moon, th, { shadowOf: { c: C, r: R } });
  if (moon && opt.orbit !== false) orbitDots(buf, Wc, Hc, C, a, true, R);
  if (moon && mc[2] < 0) moonDraw();
  planet();
  if (moon && opt.orbit !== false) orbitDots(buf, Wc, Hc, C, a, false, R);
  if (moon && mc[2] >= 0) moonDraw();
  ctx.putImageData(img, 0, 0);
}

// animates a canvas until stop() is called; draws one still frame for people who prefer less motion
export function mountWorld(canvas, opt = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const t0 = performance.now() - (opt.start || 8) * 1000;
  let raf = 0, last = 0, on = true, alive = true;
  const frame = now => {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    if (!on || now - last < 50) return; // about 20 frames a second is plenty for pixel art
    last = now;
    drawWorld(ctx, (now - t0) / 1000, opt);
  };
  let io = null;
  // building the maps takes a moment, so let the page's text paint first, then fade the world in
  const begin = setTimeout(() => {
    if (!alive) return;
    drawWorld(ctx, (performance.now() - t0) / 1000, opt);
    canvas.classList.add('world-on');
    if (still) return;
    raf = requestAnimationFrame(frame);
    if (typeof IntersectionObserver === 'function') { io = new IntersectionObserver(es => { on = es[0].isIntersecting; }); io.observe(canvas); }
  }, 30);
  return () => { alive = false; clearTimeout(begin); cancelAnimationFrame(raf); if (io) io.disconnect(); };
}

if (typeof document !== 'undefined') document.querySelectorAll('canvas[data-world]').forEach(c => mountWorld(c));
