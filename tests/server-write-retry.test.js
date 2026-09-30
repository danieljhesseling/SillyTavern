import { describe, test, expect } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { tryWriteFileWithRetry } from '../src/util.js';

// Guardar el chat mientras otra petición lo lee (la ranura del automático copiando la partida):
// en Windows, cambiar un archivo abierto falla con EPERM unos milisegundos, y el guardado
// respondía 500. Ahora se reintenta hasta que el otro lo suelta.
describe('tryWriteFileWithRetry', () => {
    test('writes a file (and its folder) like tryWriteFileSync', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-retry-'));
        const file = path.join(dir, 'chats', 'a.jsonl');
        await tryWriteFileWithRetry(file, 'hola');
        expect(fs.readFileSync(file, 'utf8')).toBe('hola');
        fs.rmSync(dir, { recursive: true, force: true });
    });

    test('waits for a reader that has the file open, instead of failing', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-retry-'));
        const file = path.join(dir, 'a.jsonl');
        fs.writeFileSync(file, 'antes');
        const reader = fs.openSync(file, 'r');
        setTimeout(() => fs.closeSync(reader), 60);
        await tryWriteFileWithRetry(file, 'después');
        expect(fs.readFileSync(file, 'utf8')).toBe('después');
        fs.rmSync(dir, { recursive: true, force: true });
    });

    test('a real error is not retried forever', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-retry-'));
        // Un directorio donde debería ir el archivo: no es algo que se arregle esperando.
        const file = path.join(dir, 'ocupado');
        fs.mkdirSync(file);
        const started = Date.now();
        await expect(tryWriteFileWithRetry(file, 'x', 3)).rejects.toBeTruthy();
        expect(Date.now() - started).toBeLessThan(process.platform === 'win32' ? 2000 : 500);
        fs.rmSync(dir, { recursive: true, force: true });
    });
});
