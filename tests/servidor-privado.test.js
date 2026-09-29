/**
 * J0.9 de ROADMAP_SIN_CONEXION: la guía del servidor privado y los lanzadores.
 *
 * La guía le dice a Daniel qué escribir en `config.yaml`. Una clave mal escrita ahí no da
 * error: el servidor la ignora en silencio y la puerta se queda como estaba. Así que cada
 * clave que la guía nombra tiene que existir en `default/config.yaml`, con la misma forma.
 */

import { describe, test, expect } from '@jest/globals';
import fs from 'node:fs';
import yaml from 'js-yaml';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const config = yaml.load(read('../default/config.yaml'));
const guide = read('../wiki/SERVIDOR_PRIVADO.md');

/**
 * Las rutas de claves de un objeto: `basicAuthUser.username`. Las listas no se abren: lo
 * que va dentro de `whitelist` son direcciones, no claves.
 *
 * @param {any} value
 * @param {string} [prefix]
 * @returns {string[]}
 */
function keyPaths(value, prefix = '') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    return Object.entries(value).flatMap(([key, inner]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        return [path, ...keyPaths(inner, path)];
    });
}

/** @param {string} path @returns {boolean} */
const inDefaults = (path) => path.split('.').reduce((node, key) => (node && typeof node === 'object' && key in node ? node[key] : undefined), config) !== undefined;

describe('la guía del servidor privado', () => {
    const blocks = [...guide.matchAll(/```yaml\r?\n([\s\S]*?)```/g)].map(m => yaml.load(m[1]));

    test('trae las recetas de casa y de fuera', () => {
        expect(blocks.length).toBeGreaterThanOrEqual(2);
    });

    test('cada clave de sus recetas existe en default/config.yaml', () => {
        const missing = blocks.flatMap(block => keyPaths(block)).filter(path => !inDefaults(path));
        expect(missing).toEqual([]);
    });

    test('cada clave de su tabla existe también', () => {
        const table = guide.split(/\r?\n/).filter(line => /^\| `[A-Za-z.]+` \|/.test(line)).map(line => line.match(/`([A-Za-z.]+)`/)[1]);
        expect(table).toEqual(['listen', 'whitelistMode', 'whitelist', 'basicAuthMode', 'basicAuthUser', 'port']);
        expect(table.filter(path => !inDefaults(path))).toEqual([]);
        expect(inDefaults('enableUserAccounts')).toBe(true);
    });

    test('las recetas tienen su forma: la contraseña, con usuario y contraseña; la lista, una lista', () => {
        for (const block of blocks) {
            expect(block.listen).toBe(true);
            expect(block.basicAuthMode).toBe(true);
            expect(Object.keys(block.basicAuthUser).sort()).toEqual(['password', 'username']);
            if ('whitelist' in block) expect(Array.isArray(block.whitelist)).toBe(true);
        }
        // Con la de ejemplo no se abre nada: la guía no la puede usar.
        expect(blocks.every(b => b.basicAuthUser.password !== config.basicAuthUser.password)).toBe(true);
    });
});

describe('los lanzadores', () => {
    const bat = read('../Jugar.bat');
    const sh = read('../jugar.sh');

    test('reusan los arranques de siempre y piden abrir el navegador', () => {
        expect(bat).toMatch(/call "%~dp0Start\.bat" --browserLaunchEnabled/);
        expect(sh).toMatch(/bash \.\/start\.sh --browserLaunchEnabled/);
        // Y esa opción es del servidor de verdad.
        expect(read('../src/command-line.js')).toMatch(/\.option\('browserLaunchEnabled'/);
    });

    test('leen el puerto de config.yaml, con 8000 si no está', () => {
        expect(bat).toMatch(/findstr \/b \/c:"port:" config\.yaml/);
        expect(bat).toMatch(/set "PUERTO=8000"/);
        expect(sh).toMatch(/PUERTO=\$\{PUERTO:-8000\}/);
        expect(config.port).toBe(8000);
    });

    test('Jugar.bat va con saltos de línea de Windows', () => {
        expect(bat.includes('\r\n')).toBe(true);
        expect(bat.replace(/\r\n/g, '').includes('\n')).toBe(false);
    });
});
