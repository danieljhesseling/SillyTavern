/**
 * ProbarCampañas (J16.6): lo que se le pide a Windows. Dónde está Edge, una orden de PowerShell
 * y el acceso directo del escritorio. Lo usan `servidor.mjs` (el botón «Poner en el escritorio»)
 * y `hacer-exe.mjs` (`--escritorio`).
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** El nombre del .exe, en la carpeta del juego. */
export const EXE_NAME = 'ProbarCampañas.exe';

/** El nombre del acceso directo en el escritorio. */
export const SHORTCUT_NAME = 'Probar campañas.lnk';

/**
 * Dónde está Edge (viene con Windows); vacío si no está.
 *
 * @returns {string}
 */
export function edgePath() {
    const places = [
        join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        join(process.env.ProgramFiles || 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ];
    return places.find(p => p && existsSync(p)) ?? '';
}

/**
 * Una orden de PowerShell, sin problemas con las tildes ni las comillas (va en UTF-16, en base64).
 *
 * @param {string} script
 * @returns {{ok: boolean, out: string, err: string}} `out`, lo que escribe; `err`, sus errores.
 */
export function powershell(script) {
    // Sin la barra de «Preparando módulos…», que sale por los errores aunque no lo sea.
    const encoded = Buffer.from(`$ProgressPreference = 'SilentlyContinue'; ${script}`, 'utf16le').toString('base64');
    const said = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], { encoding: 'utf8', windowsHide: true });
    return { ok: said.status === 0, out: String(said.stdout ?? '').trim(), err: String(said.stderr ?? '').trim() };
}

/**
 * Un acceso directo en el escritorio a ProbarCampañas.exe (con su icono).
 *
 * @param {string} root La carpeta del juego.
 * @param {string} [folder] Otra carpeta en vez del escritorio (para las pruebas).
 * @returns {{ok: boolean, path?: string, error?: string}}
 */
export function desktopShortcut(root, folder = '') {
    const exe = join(root, EXE_NAME);
    if (!existsSync(exe)) return { ok: false, error: `No encuentro ${EXE_NAME} en la carpeta del juego. Hazlo primero: node tools\\probar-campanas\\hacer-exe.mjs` };
    // Entre comillas simples de PowerShell: una comilla dentro se escribe dos veces.
    const quote = (/** @type {string} */ s) => `'${s.split('\'').join('\'\'')}'`;
    const done = powershell([
        // Salida en UTF-8, para leer bien la ruta con tildes.
        '[Console]::OutputEncoding = [Text.Encoding]::UTF8',
        folder ? `$desk = ${quote(folder)}` : '$desk = [Environment]::GetFolderPath(\'Desktop\')',
        `$link = Join-Path $desk ${quote(SHORTCUT_NAME)}`,
        '$s = (New-Object -ComObject WScript.Shell).CreateShortcut($link)',
        `$s.TargetPath = ${quote(exe)}`,
        `$s.WorkingDirectory = ${quote(root.replace(/[\\/]+$/, ''))}`,
        '$s.Description = \'Un bot juega una campaña y te dice qué tal ha ido\'',
        `$s.IconLocation = ${quote(`${exe},0`)}`,
        '$s.Save()',
        'Write-Output $link',
    ].join('; '));
    const path = done.out.split(/\r?\n/).pop() ?? '';
    return done.ok && /\.lnk$/i.test(path) ? { ok: true, path } : { ok: false, error: done.err || done.out || 'PowerShell no ha podido hacer el acceso directo.' };
}
