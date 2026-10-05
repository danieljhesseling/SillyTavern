import { existsSync, mkdirSync, unlinkSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const APP_DIR = join(ROOT, 'app-android');
const JDK_DIR = join(APP_DIR, 'jdk');
const ZIP_PATH = join(APP_DIR, 'jdk21.zip');

if (!existsSync(JDK_DIR)) mkdirSync(JDK_DIR, { recursive: true });

console.log('⬇️  Descargando OpenJDK 21 LTS portable oficial de Microsoft...');
const curl = spawnSync('curl.exe', [
    '-L',
    '-o', ZIP_PATH,
    'https://aka.ms/download-jdk/microsoft-jdk-21.0.6-windows-x64.zip'
], { stdio: 'inherit', windowsHide: true });

if (curl.status !== 0) {
    console.error('❌ Error descargando JDK 21');
    process.exit(1);
}

console.log('📦 Extrayendo JDK 21 en app-android/jdk...');
const tar = spawnSync('tar.exe', ['-xf', ZIP_PATH, '-C', JDK_DIR], { stdio: 'inherit', windowsHide: true });
if (tar.status !== 0) {
    console.error('❌ Error descomprimiendo JDK 21');
    process.exit(1);
}

try { unlinkSync(ZIP_PATH); } catch {}

console.log('✅ JDK 21 instalado con éxito en:', JDK_DIR);
console.log('Contenido:', readdirSync(JDK_DIR));
