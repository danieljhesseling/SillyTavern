#!/usr/bin/env node
/**
 * Compila `MontarAPK.exe` y `CrearAPK.exe` en la raíz del proyecto.
 *
 * Compila `lanzador.cs` con el compilador csc.exe de .NET Framework 4
 * incluido en todas las versiones de Windows (sin necesidad de instalar nada).
 * Dibuja un icono de escudo dorado con un yunque pixel art.
 *
 * Uso:
 *   node tools/montar-apk/hacer-exe.mjs
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync, statSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, crc32 } from 'node:zlib';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/**
 * Busca csc.exe (.NET Framework 4 de Windows).
 */
function cscPath() {
    const windir = process.env.WINDIR || process.env.SystemRoot || 'C:\\Windows';
    return [
        join(windir, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'),
        join(windir, 'Microsoft.NET', 'Framework', 'v4.0.30319', 'csc.exe'),
    ].find(p => existsSync(p)) ?? '';
}

/**
 * Un PNG con los píxeles dados (RGBA).
 */
function png(size, rgba) {
    const chunk = (type, data) => {
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
    ihdr[8] = 8;
    ihdr[9] = 6;
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
 * Dibuja un icono de escudo dorado con un martillo/yunque para el .exe.
 */
function drawIcon(size) {
    const out = new Uint8Array(size * size * 4);
    const S = size;

    for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
            const nx = (x / S) * 32;
            const ny = (y / S) * 32;

            // Escudo
            const inShield = (nx >= 4 && nx <= 28 && ny >= 4 && ny <= 20) ||
                (ny > 20 && ny <= 28 && Math.abs(nx - 16) <= (28 - ny) * 1.5);

            if (inShield) {
                const isBorder = (nx <= 6 || nx >= 26 || ny <= 6 || (ny > 20 && Math.abs(nx - 16) >= (28 - ny) * 1.5 - 2));
                const isAnvil = (ny >= 13 && ny <= 18 && nx >= 9 && nx <= 23) || (ny >= 19 && ny <= 22 && nx >= 13 && nx <= 19);

                const i = (y * S + x) * 4;
                if (isBorder) {
                    out[i] = 243;     // Gold bright
                    out[i + 1] = 212;
                    out[i + 2] = 141;
                    out[i + 3] = 255;
                } else if (isAnvil) {
                    out[i] = 230;     // White/silver metal
                    out[i + 1] = 230;
                    out[i + 2] = 240;
                    out[i + 3] = 255;
                } else {
                    out[i] = 140;     // Crimson background
                    out[i + 1] = 34;
                    out[i + 2] = 48;
                    out[i + 3] = 255;
                }
            }
        }
    }
    return out;
}

/**
 * Genera un .ico con varios tamaños.
 */
function makeIco(sizes) {
    const images = sizes.map(s => png(s, drawIcon(s)));
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
    console.error('❌ No se encontró csc.exe (.NET Framework 4 de Windows).');
    process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), 'montar-apk-exe-'));
const icon = join(work, 'icono.ico');
writeFileSync(icon, makeIco([16, 24, 32, 48, 64, 256]));

const outMontar = join(ROOT, 'MontarAPK.exe');
const outCrear = join(ROOT, 'CrearAPK.exe');

console.log('Compilando MontarAPK.exe con csc.exe...');
const res = spawnSync(csc, [
    '/nologo', '/target:winexe', '/optimize+', '/codepage:65001',
    `/win32icon:${icon}`, '/reference:System.Windows.Forms.dll',
    `/out:${outMontar}`, join(HERE, 'lanzador.cs'),
], { encoding: 'utf8', windowsHide: true });

rmSync(work, { recursive: true, force: true });

if (res.status !== 0) {
    console.error(`❌ csc.exe no pudo compilar:\n${res.stdout ?? ''}${res.stderr ?? ''}`);
    process.exit(1);
}

// También proveer CrearAPK.exe
copyFileSync(outMontar, outCrear);

const kb = Math.round(statSync(outMontar).size / 1024);
console.log(`✅ Creado: ${outMontar} (${kb} KB)`);
console.log(`✅ Creado: ${outCrear} (${kb} KB)`);
