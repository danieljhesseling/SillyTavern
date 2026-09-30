#!/usr/bin/env node
/**
 * J20.7 de ROADMAP_SIN_CONEXION: el juego como una app del móvil.
 *
 *   node tools/app-movil.mjs          escribe el manifiesto, los iconos y el nombre del iPhone
 *   node tools/app-movil.mjs --check  falla si algo no está al día
 *
 * Lo que escribe:
 *
 * - `public/juego.webmanifest`, de `APP_INFO` (`public/scripts/game-engine/ui/app-mode.js`):
 *   el nombre, los colores, los iconos y la entrada (`/?juego`).
 * - El icono del iPhone (180 × 180), en `public/img/game-engine/app/`, reducido del icono del
 *   juego (`pixel/app/icono-512.png`, hecho con PixelLab). Los de Android son los del juego
 *   tal cual (`pixel/app/`). Si faltara el icono del juego, hace también unos de repuesto con
 *   el guerrero de las clases (`pixel/clases/guerrero.png`, 64 × 64) ampliado sin suavizar,
 *   píxel a píxel. Cuando cambie el icono del juego, se vuelve a pasar.
 * - En `public/index.html`, el nombre bajo el icono del iPhone (`apple-mobile-web-app-title`).
 *
 * Y `--check` mira además que `index.html` enlaza el manifiesto y el icono del iPhone.
 *
 * Lee y escribe los PNG con `node:zlib`, sin librerías: son imágenes pequeñas y de un solo tipo.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import zlib from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');

/** El icono del juego, si ya está hecho. */
export const ART_ICON = join(PUBLIC, 'img/game-engine/pixel/app/icono-512.png');
/** Y el que se usa mientras no. */
export const FALLBACK_ICON = join(PUBLIC, 'img/game-engine/pixel/clases/guerrero.png');

/** @typedef {{width: number, height: number, data: Uint8Array}} Rgba */

// ---------------------------------------------------------------- PNG, lo justo

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** @type {Uint32Array|null} */
let crcTable = null;
/** @param {Buffer} bytes @returns {number} */
function crc32(bytes) {
    if (typeof zlib.crc32 === 'function') return zlib.crc32(bytes) >>> 0;
    if (!crcTable) {
        crcTable = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            crcTable[n] = c >>> 0;
        }
    }
    let c = 0xffffffff;
    for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

/**
 * Un PNG de 8 bits por canal (RGBA, RGB, gris o con paleta), sin entrelazar, a RGBA.
 *
 * @param {Buffer} file
 * @returns {Rgba}
 */
export function decodePng(file) {
    if (!file.subarray(0, 8).equals(SIGNATURE)) throw new Error('no es un PNG');
    let at = 8;
    let width = 0, height = 0, depth = 0, type = 0, interlace = 0;
    /** @type {Buffer|null} */
    let palette = null;
    /** @type {Buffer|null} */
    let alpha = null;
    /** @type {Buffer[]} */
    const idat = [];
    while (at < file.length) {
        const length = file.readUInt32BE(at);
        const kind = file.toString('latin1', at + 4, at + 8);
        const body = file.subarray(at + 8, at + 8 + length);
        if (kind === 'IHDR') {
            width = body.readUInt32BE(0);
            height = body.readUInt32BE(4);
            depth = body[8];
            type = body[9];
            interlace = body[12];
        } else if (kind === 'PLTE') palette = body;
        else if (kind === 'tRNS') alpha = body;
        else if (kind === 'IDAT') idat.push(body);
        else if (kind === 'IEND') break;
        at += 12 + length;
    }
    const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
    if (depth !== 8 || !channels || interlace) throw new Error(`PNG no soportado (profundidad ${depth}, tipo ${type}, entrelazado ${interlace})`);
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const stride = width * channels;
    const pixels = Buffer.alloc(stride * height);
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)];
        const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
        const out = pixels.subarray(y * stride, (y + 1) * stride);
        const up = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null;
        for (let i = 0; i < stride; i++) {
            const a = i >= channels ? out[i - channels] : 0;
            const b = up ? up[i] : 0;
            const c = up && i >= channels ? up[i - channels] : 0;
            let value = line[i];
            if (filter === 1) value += a;
            else if (filter === 2) value += b;
            else if (filter === 3) value += (a + b) >> 1;
            else if (filter === 4) {
                const p = a + b - c;
                const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
                value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
            }
            out[i] = value & 0xff;
        }
    }
    const data = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
        const src = i * channels;
        let r, g, b, o = 255;
        if (type === 6) [r, g, b, o] = [pixels[src], pixels[src + 1], pixels[src + 2], pixels[src + 3]];
        else if (type === 2) [r, g, b] = [pixels[src], pixels[src + 1], pixels[src + 2]];
        else if (type === 0) r = g = b = pixels[src];
        else if (type === 4) [r, g, b, o] = [pixels[src], pixels[src], pixels[src], pixels[src + 1]];
        else {
            const index = pixels[src];
            if (!palette) throw new Error('PNG con paleta y sin paleta');
            [r, g, b] = [palette[index * 3], palette[index * 3 + 1], palette[index * 3 + 2]];
            o = alpha && index < alpha.length ? alpha[index] : 255;
        }
        data.set([r, g, b, o], i * 4);
    }
    return { width, height, data };
}

/**
 * RGBA a PNG. Cada fila con el filtro que menos ocupa de los dos sencillos.
 *
 * @param {Rgba} image
 * @returns {Buffer}
 */
export function encodePng(image) {
    const stride = image.width * 4;
    const raw = Buffer.alloc((stride + 1) * image.height);
    for (let y = 0; y < image.height; y++) {
        const row = image.data.subarray(y * stride, (y + 1) * stride);
        const base = y * (stride + 1);
        // Filtro 1 (la resta con el de la izquierda): las zonas lisas se quedan en ceros.
        raw[base] = 1;
        for (let i = 0; i < stride; i++) raw[base + 1 + i] = (row[i] - (i >= 4 ? row[i - 4] : 0)) & 0xff;
    }
    /** @param {string} kind @param {Buffer} body */
    const chunk = (kind, body) => {
        const head = Buffer.alloc(8);
        head.writeUInt32BE(body.length, 0);
        head.write(kind, 4, 'latin1');
        const crc = Buffer.alloc(4);
        crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
        return Buffer.concat([head, body, crc]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(image.width, 0);
    ihdr.writeUInt32BE(image.height, 4);
    ihdr.set([8, 6, 0, 0, 0], 8);
    return Buffer.concat([SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---------------------------------------------------------------- Dibujo

/** @param {string} hex @returns {[number, number, number, number]} */
function rgba(hex, opacity = 255) {
    const n = Number.parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, opacity];
}

/** @param {number} width @param {number} height @param {[number, number, number, number]} color @returns {Rgba} */
function canvas(width, height, color) {
    const data = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) data.set(color, i * 4);
    return { width, height, data };
}

/** Pone un color encima de un píxel, con su transparencia. */
function blend(/** @type {Rgba} */ dst, /** @type {number} */ x, /** @type {number} */ y, /** @type {ArrayLike<number>} */ c) {
    if (x < 0 || y < 0 || x >= dst.width || y >= dst.height || !c[3]) return;
    const i = (y * dst.width + x) * 4;
    const a = c[3] / 255;
    const under = dst.data[i + 3] / 255;
    const out = a + under * (1 - a);
    for (let k = 0; k < 3; k++) dst.data[i + k] = Math.round((c[k] * a + dst.data[i + k] * under * (1 - a)) / (out || 1));
    dst.data[i + 3] = Math.round(out * 255);
}

/**
 * Una imagen ampliada `factor` veces sin suavizar (cada píxel, un cuadrado), en `x`, `y`.
 *
 * @param {Rgba} dst
 * @param {Rgba} src
 * @param {number} factor Entero.
 * @param {number} x
 * @param {number} y
 */
function blitNearest(dst, src, factor, x, y) {
    for (let sy = 0; sy < src.height; sy++) {
        for (let sx = 0; sx < src.width; sx++) {
            const c = src.data.subarray((sy * src.width + sx) * 4, (sy * src.width + sx) * 4 + 4);
            if (!c[3]) continue;
            for (let dy = 0; dy < factor; dy++) {
                for (let dx = 0; dx < factor; dx++) blend(dst, x + sx * factor + dx, y + sy * factor + dy, c);
            }
        }
    }
}

/**
 * Una imagen a otro tamaño, con la media de lo que cae en cada píxel: para reducir el icono
 * grande sin que se rompa. La transparencia pesa: un borde transparente no oscurece.
 *
 * @param {Rgba} src
 * @param {number} width
 * @param {number} height
 * @returns {Rgba}
 */
function resizeArea(src, width, height) {
    const out = { width, height, data: new Uint8Array(width * height * 4) };
    const fx = src.width / width;
    const fy = src.height / height;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let r = 0, g = 0, b = 0, a = 0, weight = 0;
            const x0 = x * fx, x1 = (x + 1) * fx, y0 = y * fy, y1 = (y + 1) * fy;
            for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy++) {
                const wy = Math.min(y1, sy + 1) - Math.max(y0, sy);
                for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx++) {
                    const w = (Math.min(x1, sx + 1) - Math.max(x0, sx)) * wy;
                    const i = (Math.min(sy, src.height - 1) * src.width + Math.min(sx, src.width - 1)) * 4;
                    const o = src.data[i + 3] / 255;
                    r += src.data[i] * o * w; g += src.data[i + 1] * o * w; b += src.data[i + 2] * o * w; a += o * w; weight += w;
                }
            }
            const i = (y * width + x) * 4;
            if (a > 0) out.data.set([Math.round(r / a), Math.round(g / a), Math.round(b / a), Math.round((a / weight) * 255)], i);
        }
    }
    return out;
}

/** Un marco cuadrado, como los de las ventanas del juego: `thick` de grueso, a `inset` del borde. */
function frame(/** @type {Rgba} */ dst, /** @type {number} */ inset, /** @type {number} */ thick, /** @type {[number, number, number, number]} */ color) {
    for (let y = inset; y < dst.height - inset; y++) {
        for (let x = inset; x < dst.width - inset; x++) {
            const edge = x < inset + thick || y < inset + thick || x >= dst.width - inset - thick || y >= dst.height - inset - thick;
            if (edge) blend(dst, x, y, color);
        }
    }
}

/**
 * El icono sobre el fondo del juego, a `size` píxeles, con el dibujo en el centro ocupando
 * más o menos `fill` del ancho.
 *
 * Si el dibujo es pequeño (pixel art), se amplía por un número entero y sin suavizar: cada
 * píxel del dibujo es un cuadrado. Si ya es grande (el icono del juego), se reduce con la media.
 *
 * @param {Rgba} art
 * @param {{size: number, fill: number, background: string, frame?: boolean}} options
 * @returns {Rgba}
 */
export function composeIcon(art, { size, fill, background, frame: withFrame = false }) {
    const out = canvas(size, size, rgba(background));
    if (withFrame) {
        // El dorado de las ventanas (`--gs-gold-line`), fino y un poco hacia dentro.
        const thick = Math.max(2, Math.round(size / 96));
        frame(out, Math.round(size * 0.05), thick, rgba('#d6b46a', 110));
    }
    const target = Math.max(1, Math.round(size * fill));
    if (art.width <= target) {
        const factor = Math.max(1, Math.floor(target / art.width));
        const w = art.width * factor;
        const h = art.height * factor;
        blitNearest(out, art, factor, Math.floor((size - w) / 2), Math.floor((size - h) / 2));
    } else {
        const scaled = resizeArea(art, target, Math.round(target * (art.height / art.width)));
        blitNearest(out, scaled, 1, Math.floor((size - scaled.width) / 2), Math.floor((size - scaled.height) / 2));
    }
    return out;
}

// ---------------------------------------------------------------- Lo que se escribe

/** @returns {Promise<typeof import('../public/scripts/game-engine/ui/app-mode.js')>} */
async function appMode() {
    return import(pathToFileURL(join(PUBLIC, 'scripts/game-engine/ui/app-mode.js')).href);
}

/**
 * Los iconos que usa el manifiesto: los del juego si están los tres; si no, los de repuesto.
 *
 * @returns {Promise<{art: boolean, icons: ReadonlyArray<import('../public/scripts/game-engine/ui/app-mode.js').AppIcon>}>}
 */
export async function iconSet() {
    const { ART_ICONS, FALLBACK_ICONS } = await appMode();
    const art = ART_ICONS.every(icon => existsSync(join(PUBLIC, icon.src)));
    return { art, icons: art ? ART_ICONS : FALLBACK_ICONS };
}

/**
 * El manifiesto, en texto, tal y como se escribe.
 *
 * @returns {Promise<string>}
 */
export async function manifestText() {
    const { buildWebManifest, APP_INFO } = await appMode();
    return `${JSON.stringify(buildWebManifest(APP_INFO, (await iconSet()).icons), null, 4)}\n`;
}

/**
 * Los iconos que hay que hacer con lo que hay ahora en disco.
 *
 * - Con el icono del juego: solo el del iPhone (180), reducido del de 512 con la media, sobre
 *   el fondo del propio icono.
 * - Sin él: los tres de repuesto y el del iPhone, con el guerrero de las clases ampliado
 *   píxel a píxel sobre el fondo del juego, con aire alrededor y el marco dorado.
 *
 * @returns {Promise<{source: string, icons: {file: string, image: Rgba}[]}>}
 */
export async function buildIcons() {
    const { APP_INFO, APPLE_ICON } = await appMode();
    const { art: whole, icons: set } = await iconSet();
    const source = whole ? ART_ICON : FALLBACK_ICON;
    const art = decodePng(readFileSync(source));
    // El fondo del icono del juego es el de su esquina: el del iPhone sale igual.
    const corner = whole ? `#${[...art.data.subarray(0, 3)].map(v => v.toString(16).padStart(2, '0')).join('')}` : APP_INFO.theme;
    /** @type {{file: string, image: Rgba}[]} */
    const icons = [];
    if (!whole) {
        for (const icon of set) {
            const maskable = icon.purpose === 'maskable';
            // Máscara: lo importante, dentro del círculo del centro (el 80 %) y sin marco, que se recorta.
            icons.push({ file: join(PUBLIC, icon.src), image: composeIcon(art, { size: icon.size, fill: maskable ? 0.62 : 0.75, background: APP_INFO.theme, frame: !maskable }) });
        }
    }
    // El del iPhone: sin transparencias y sin marco (el iPhone ya redondea las esquinas).
    icons.push({ file: join(PUBLIC, APPLE_ICON.src), image: composeIcon(art, { size: APPLE_ICON.size, fill: whole ? 1 : 0.72, background: corner }) });
    return { source, icons };
}

/**
 * Lo que no está al día: el manifiesto, los iconos (que estén y midan lo que dicen) y lo que
 * enlaza `index.html`.
 *
 * @returns {Promise<string[]>}
 */
export async function checkApp() {
    const { APP_INFO, APPLE_ICON, MANIFEST_FILE } = await appMode();
    /** @type {string[]} */
    const problems = [];
    const manifestPath = join(PUBLIC, MANIFEST_FILE);
    if (!existsSync(manifestPath)) problems.push(`falta ${MANIFEST_FILE}`);
    else if (readFileSync(manifestPath, 'utf8').replace(/\r\n/g, '\n') !== await manifestText()) problems.push(`${MANIFEST_FILE} no es el que sale de APP_INFO y de los iconos que hay`);
    for (const icon of [...(await iconSet()).icons, APPLE_ICON]) {
        const path = join(PUBLIC, icon.src);
        if (!existsSync(path)) {
            problems.push(`falta el icono ${icon.src}`);
            continue;
        }
        const image = decodePng(readFileSync(path));
        if (image.width !== icon.size || image.height !== icon.size) problems.push(`${icon.src} mide ${image.width}×${image.height}, no ${icon.size}×${icon.size}`);
    }
    const html = readFileSync(join(PUBLIC, 'index.html'), 'utf8');
    const has = (/** @type {RegExp} */ pattern) => pattern.test(html);
    const quote = (/** @type {string} */ s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!has(new RegExp(`<link rel="manifest"[^>]*href="${quote(MANIFEST_FILE)}"`))) problems.push(`index.html no enlaza ${MANIFEST_FILE}`);
    if (!has(new RegExp(`<link rel="apple-touch-icon"[^>]*href="${quote(APPLE_ICON.src)}"`))) problems.push('index.html no enlaza el icono del iPhone');
    if (!has(new RegExp(`<meta name="apple-mobile-web-app-title" content="${quote(APP_INFO.shortName)}">`))) problems.push('el nombre del iPhone en index.html no es APP_INFO.shortName');
    return problems;
}

/**
 * Pone el nombre corto en `index.html` (lo que sale bajo el icono en el iPhone). Solo cambia
 * esa línea, y solo si ya está.
 *
 * @param {string} shortName
 * @returns {boolean} Si ha cambiado algo.
 */
function writeAppleTitle(shortName) {
    const path = join(PUBLIC, 'index.html');
    const html = readFileSync(path, 'utf8');
    const next = html.replace(/(<meta name="apple-mobile-web-app-title" content=")[^"]*(">)/, (_, a, b) => `${a}${shortName}${b}`);
    if (next === html) return false;
    writeFileSync(path, next);
    return true;
}

async function main() {
    if (process.argv.includes('--check')) {
        const problems = await checkApp();
        for (const problem of problems) console.log(`FALTA  ${problem}`);
        console.log(problems.length ? `\n${problems.length} cosa(s) sin hacer: node tools/app-movil.mjs` : 'La app está al día.');
        process.exit(problems.length ? 1 : 0);
    }
    const { APP_INFO, MANIFEST_FILE } = await appMode();
    writeFileSync(join(PUBLIC, MANIFEST_FILE), await manifestText());
    const { source, icons } = await buildIcons();
    for (const { file, image } of icons) {
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, encodePng(image));
    }
    const renamed = writeAppleTitle(APP_INFO.shortName);
    console.log(`Escrito ${MANIFEST_FILE} y ${icons.length} icono(s), desde ${source.replace(ROOT, '').replace(/\\/g, '/')}.${renamed ? ' Nombre del iPhone al día en index.html.' : ''}`);
    if (source === FALLBACK_ICON) console.log('Todavía no está el icono del juego (pixel/app/icono-192, icono-512 e icono-maskable-512): se usa el del guerrero. Cuando llegue, vuelve a pasar esto.');
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
    await main();
}
