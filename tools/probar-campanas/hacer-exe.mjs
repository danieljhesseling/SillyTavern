#!/usr/bin/env node
/**
 * Hace `ProbarCampañas.exe` en la carpeta del juego (J16.6 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * Compila `lanzador.cs` con el csc.exe del .NET Framework 4, que viene con Windows: no hay que
 * instalar nada. El icono (un dado azul) se dibuja aquí mismo.
 *
 * Uso:
 *   node tools/probar-campanas/hacer-exe.mjs               # el .exe, en la carpeta del juego
 *   node tools/probar-campanas/hacer-exe.mjs --escritorio  # y un acceso directo en el escritorio
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, crc32 } from 'node:zlib';
import { EXE_NAME, desktopShortcut } from './windows.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** El compilador de C# que trae Windows (.NET Framework 4). */
function cscPath() {
    const windir = process.env.WINDIR || process.env.SystemRoot || 'C:\\Windows';
    return [
        join(windir, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'),
        join(windir, 'Microsoft.NET', 'Framework', 'v4.0.30319', 'csc.exe'),
    ].find(p => existsSync(p)) ?? '';
}

/**
 * Un PNG con los píxeles dados (RGBA, de arriba abajo).
 *
 * @param {number} size
 * @param {Uint8Array} rgba
 * @returns {Buffer}
 */
function png(size, rgba) {
    const chunk = (/** @type {string} */ type, /** @type {Buffer} */ data) => {
        const head = Buffer.alloc(8);
        head.writeUInt32BE(data.length, 0);
        head.write(type, 4, 'ascii');
        const crc = Buffer.alloc(4);
        crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])) >>> 0, 0);
        return Buffer.concat([head, data, crc]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0);
    ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8; // bits por canal
    ihdr[9] = 6; // RGBA
    const rows = Buffer.alloc(size * (size * 4 + 1));
    for (let y = 0; y < size; y++) {
        rows[y * (size * 4 + 1)] = 0;
        Buffer.from(rgba.buffer, rgba.byteOffset + y * size * 4, size * 4).copy(rows, y * (size * 4 + 1) + 1);
    }
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0)),
    ]);
}

/**
 * El dado del icono, del tamaño pedido: un cuadrado azul redondeado con cinco puntos blancos
 * (el mismo dibujo que el icono de la ventana, en `app.html`).
 *
 * @param {number} size
 * @returns {Uint8Array}
 */
function dice(size) {
    const out = new Uint8Array(size * size * 4);
    const pips = [[11, 11], [21, 11], [16, 16], [11, 21], [21, 21]];
    const inBox = (/** @type {number} */ x, /** @type {number} */ y) => {
        const r = 6;
        const cx = Math.min(Math.max(x, 3 + r), 29 - r);
        const cy = Math.min(Math.max(y, 3 + r), 29 - r);
        return x >= 3 && x <= 29 && y >= 3 && y <= 29 && (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
    };
    const SS = 4;
    for (let py = 0; py < size; py++) {
        for (let px = 0; px < size; px++) {
            let box = 0;
            let pip = 0;
            for (let sy = 0; sy < SS; sy++) {
                for (let sx = 0; sx < SS; sx++) {
                    const x = ((px + (sx + 0.5) / SS) / size) * 32;
                    const y = ((py + (sy + 0.5) / SS) / size) * 32;
                    if (!inBox(x, y)) continue;
                    box++;
                    if (pips.some(([cx, cy]) => (x - cx) ** 2 + (y - cy) ** 2 <= 2.6 ** 2)) pip++;
                }
            }
            const cover = box / (SS * SS);
            const white = box ? pip / box : 0;
            const i = (py * size + px) * 4;
            out[i] = Math.round(0x3b + (255 - 0x3b) * white);
            out[i + 1] = Math.round(0x6f + (255 - 0x6f) * white);
            out[i + 2] = Math.round(0xd8 + (255 - 0xd8) * white);
            out[i + 3] = Math.round(255 * cover);
        }
    }
    return out;
}

/**
 * Un .ico con varios tamaños, cada uno en PNG (Windows lo entiende desde Vista).
 *
 * @param {number[]} sizes
 * @returns {Buffer}
 */
function ico(sizes) {
    const images = sizes.map(s => png(s, dice(s)));
    const head = Buffer.alloc(6 + 16 * sizes.length);
    head.writeUInt16LE(0, 0);
    head.writeUInt16LE(1, 2);
    head.writeUInt16LE(sizes.length, 4);
    let offset = head.length;
    sizes.forEach((s, i) => {
        const at = 6 + i * 16;
        head[at] = s >= 256 ? 0 : s;
        head[at + 1] = s >= 256 ? 0 : s;
        head.writeUInt16LE(1, at + 4);
        head.writeUInt16LE(32, at + 6);
        head.writeUInt32LE(images[i].length, at + 8);
        head.writeUInt32LE(offset, at + 12);
        offset += images[i].length;
    });
    return Buffer.concat([head, ...images]);
}

const csc = cscPath();
if (!csc) {
    console.log('No encuentro csc.exe (el compilador de C# del .NET Framework 4, que viene con Windows).');
    process.exit(1);
}
const work = mkdtempSync(join(tmpdir(), 'probar-campanas-exe-'));
const icon = join(work, 'icono.ico');
writeFileSync(icon, ico([16, 24, 32, 48, 64, 256]));
const out = join(ROOT, EXE_NAME);
const said = spawnSync(csc, [
    '/nologo', '/target:winexe', '/optimize+', '/codepage:65001',
    `/win32icon:${icon}`, '/reference:System.Windows.Forms.dll', `/out:${out}`, join(HERE, 'lanzador.cs'),
], { encoding: 'utf8', windowsHide: true });
rmSync(work, { recursive: true, force: true });
if (said.status !== 0) {
    console.log(`csc.exe no ha podido compilar el lanzador:\n${said.stdout ?? ''}${said.stderr ?? ''}`);
    process.exit(1);
}
console.log(`Hecho: ${out} (${Math.round(statSync(out).size / 1024)} KB)`);
if (process.argv.includes('--escritorio')) {
    const link = desktopShortcut(ROOT);
    console.log(link.ok ? `Y en el escritorio: ${link.path}` : `El acceso directo no: ${link.error}`);
    if (!link.ok) process.exit(1);
}
