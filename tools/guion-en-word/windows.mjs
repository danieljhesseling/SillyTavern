/**
 * GuionEnWord: lo que se le pide a Windows. Los cuadros de «Abrir» y «Guardar como» y el acceso
 * directo del escritorio. Dónde está Edge y la orden de PowerShell salen de ProbarCampañas
 * (`tools/probar-campanas/windows.mjs`).
 */

import { spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { powershell } from '../probar-campanas/windows.mjs';

/** El nombre del .exe, en la carpeta del juego. */
export const EXE_NAME = 'GuionEnWord.exe';

/** El nombre del acceso directo en el escritorio. */
export const SHORTCUT_NAME = 'El guion en Word.lnk';

/** Entre comillas simples de PowerShell: una comilla dentro se escribe dos veces. */
const quote = (/** @type {string} */ s) => `'${String(s).split('\'').join('\'\'')}'`;

/**
 * El cuadro de Windows para elegir un archivo («Abrir») o dónde guardarlo («Guardar como»),
 * siempre delante de la ventana. Vacío si se cancela.
 *
 * @param {{save?: boolean, title: string, filter: string, start?: string}} input `start`: una
 *   carpeta, o un archivo (su carpeta y su nombre).
 * @returns {Promise<string>}
 */
export function dialog({ save = false, title, filter, start = '' }) {
    // Una ruta sin extensión es una carpeta, aunque aún no exista.
    const isDir = Boolean(start) && ((existsSync(start) && statSync(start).isDirectory()) || !/\.\w+$/.test(start));
    const folder = isDir ? start : start ? dirname(start) : '';
    const name = !isDir && start ? basename(start) : '';
    const script = [
        'Add-Type -AssemblyName System.Windows.Forms',
        'Add-Type -AssemblyName System.Drawing',
        '[Console]::OutputEncoding = [Text.Encoding]::UTF8',
        // Una ventana invisible encima de todo, para que el cuadro no salga detrás.
        '$owner = New-Object System.Windows.Forms.Form',
        '$owner.TopMost = $true; $owner.ShowInTaskbar = $false; $owner.Opacity = 0',
        '$owner.StartPosition = \'CenterScreen\'; $owner.Size = New-Object System.Drawing.Size(1, 1)',
        '$owner.Show(); $owner.Activate()',
        `$d = New-Object System.Windows.Forms.${save ? 'SaveFileDialog' : 'OpenFileDialog'}`,
        `$d.Title = ${quote(title)}`,
        `$d.Filter = ${quote(filter)}`,
        folder && existsSync(folder) ? `$d.InitialDirectory = ${quote(folder)}` : '',
        name ? `$d.FileName = ${quote(name)}` : '',
        save ? '$d.OverwritePrompt = $true; $d.AddExtension = $true; $d.DefaultExt = \'docx\'' : '$d.CheckFileExists = $true',
        'if ($d.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $d.FileName }',
        '$owner.Close()',
    ].filter(Boolean).join('; ');
    const encoded = Buffer.from(`$ProgressPreference = 'SilentlyContinue'; ${script}`, 'utf16le').toString('base64');
    return new Promise((done) => {
        const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], { windowsHide: true });
        let out = '';
        child.stdout.on('data', (/** @type {Buffer} */ chunk) => { out += chunk.toString('utf8'); });
        child.on('error', () => done(''));
        child.on('close', () => done(out.split(/\r?\n/).map(l => l.trim()).filter(Boolean).pop() ?? ''));
    });
}

/**
 * Un acceso directo en el escritorio a GuionEnWord.exe (con su icono).
 *
 * @param {string} root La carpeta del juego.
 * @param {string} [folder] Otra carpeta en vez del escritorio (para las pruebas).
 * @returns {{ok: boolean, path?: string, error?: string}}
 */
export function desktopShortcut(root, folder = '') {
    const exe = join(root, EXE_NAME);
    if (!existsSync(exe)) return { ok: false, error: `No encuentro ${EXE_NAME} en la carpeta del juego. Hazlo primero: node tools\\guion-en-word\\hacer-exe.mjs` };
    const done = powershell([
        '[Console]::OutputEncoding = [Text.Encoding]::UTF8',
        folder ? `$desk = ${quote(folder)}` : '$desk = [Environment]::GetFolderPath(\'Desktop\')',
        `$link = Join-Path $desk ${quote(SHORTCUT_NAME)}`,
        '$s = (New-Object -ComObject WScript.Shell).CreateShortcut($link)',
        `$s.TargetPath = ${quote(exe)}`,
        `$s.WorkingDirectory = ${quote(root.replace(/[\\/]+$/, ''))}`,
        '$s.Description = \'Sacar el guion de una campaña a Word y devolverlo al juego\'',
        `$s.IconLocation = ${quote(`${exe},0`)}`,
        '$s.Save()',
        'Write-Output $link',
    ].join('; '));
    const path = done.out.split(/\r?\n/).pop() ?? '';
    return done.ok && /\.lnk$/i.test(path) ? { ok: true, path } : { ok: false, error: done.err || done.out || 'PowerShell no ha podido hacer el acceso directo.' };
}
