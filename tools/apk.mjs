#!/usr/bin/env node
/**
 * Herramienta para empaquetar, sincronizar y montar la APK de Dnd Master en Android.
 * (A1, A5 y A8 de wiki/ROADMAP_APK_ANDROID.md).
 *
 * Uso:
 *   node tools/apk.mjs --copiar       # Prepara app-android/www/ sin lo que sobra
 *   node tools/apk.mjs --check        # Verifica integridad y peso de la copia
 *   node tools/apk.mjs --sync         # Sincroniza Capacitor y proyecto Android
 *   node tools/apk.mjs --build        # Compila la APK con Gradle
 *   node tools/apk.mjs --instalar     # Instala la APK en el móvil conectado vía USB (adb)
 *   node tools/apk.mjs                # Todo el proceso de un tirón (copiar -> sync -> build)
 */

import { spawn, spawnSync } from 'node:child_process';
import {
    existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync,
    copyFileSync, rmSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PUBLIC = join(ROOT, 'public');
const APP_DIR = join(ROOT, 'app-android');
const WWW_DIR = join(APP_DIR, 'www');
const SALIDA_DIR = join(APP_DIR, 'salida');

/**
 * Detecta rutas del SDK de Android, Java (JBR de Android Studio) y adb.
 */
export function detectarEntorno() {
    const windir = process.env.WINDIR || 'C:\\Windows';
    const localApp = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local');
    const progFiles = process.env.ProgramFiles || 'C:\\Program Files';

    let javaHome = '';
    const jdkPortable = join(APP_DIR, 'jdk', 'jdk-21.0.6+7');
    if (existsSync(join(jdkPortable, 'bin', 'java.exe'))) {
        javaHome = jdkPortable;
    } else if (process.env.JAVA_HOME && existsSync(join(process.env.JAVA_HOME, 'bin', 'java.exe'))) {
        javaHome = process.env.JAVA_HOME;
    } else {
        const candidatosJbr = [
            join(progFiles, 'Java', 'jdk-21'),
            join(progFiles, 'Java', 'jdk-17'),
            join(progFiles, 'Android', 'Android Studio', 'jbr'),
            join(progFiles, 'Android', 'Android Studio 1', 'jbr'),
        ];
        javaHome = candidatosJbr.find(p => existsSync(join(p, 'bin', 'java.exe'))) || '';
    }

    let androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '';
    if (!androidHome || !existsSync(androidHome)) {
        const candidatosSdk = [
            join(localApp, 'Android', 'Sdk'),
            join(homedir(), 'AppData', 'Local', 'Android', 'Sdk'),
        ];
        androidHome = candidatosSdk.find(p => existsSync(p)) || '';
    }

    let adbPath = '';
    if (androidHome && existsSync(join(androidHome, 'platform-tools', 'adb.exe'))) {
        adbPath = join(androidHome, 'platform-tools', 'adb.exe');
    }

    // Listar dispositivos conectados
    const dispositivos = [];
    if (adbPath) {
        try {
            const out = spawnSync(adbPath, ['devices'], { encoding: 'utf8', windowsHide: true });
            if (out.status === 0) {
                const lineas = out.stdout.split('\n');
                for (let i = 1; i < lineas.length; i++) {
                    const l = lineas[i].trim();
                    if (!l) continue;
                    const partes = l.split(/\s+/);
                    if (partes.length >= 2 && partes[1] === 'device') {
                        dispositivos.push(partes[0]);
                    }
                }
            }
        } catch {
            // Ignorar si adb falla al consultar
        }
    }

    return {
        javaHome,
        androidHome,
        adbPath,
        dispositivos,
        listoParaCompilar: Boolean(javaHome && androidHome),
    };
}

/**
 * Busca el archivo lib.js generado por webpack.
 */
function buscarLibJs() {
    const opciones = [
        join(ROOT, 'data', '_webpack'),
        join(ROOT, 'dist', '_webpack'),
    ];

    for (const raiz of opciones) {
        if (!existsSync(raiz)) continue;
        const subdirs = readdirSync(raiz, { withFileTypes: true });
        for (const dir of subdirs) {
            if (dir.isDirectory()) {
                const candidato = join(raiz, dir.name, 'output', 'lib.js');
                if (existsSync(candidato)) return candidato;
            }
        }
    }

    const enPublic = join(PUBLIC, 'lib.js');
    if (existsSync(enPublic) && statSync(enPublic).size > 100000) return enPublic;

    return '';
}

/**
 * Filtro de exclusión para empaquetar una copia reducida (~25-35 MB).
 * Quita lo que sobra según la sección 4 de wiki/ROADMAP_APK_ANDROID.md.
 *
 * @param {string} relPath Ruta relativa desde public/
 * @returns {boolean} true si se debe omitir
 */
function omitirEnCopia(relPath) {
    const normal = relPath.replace(/\\/g, '/');

    // Extensiones que no se usan en Dnd Master (ahorrar espacio)
    // NOTA CRÍTICA: regex/engine.js y shared.js son importadas estáticamente por script.js,
    // reasoning.js, slash-commands.js y st-context.js. NUNCA deben excluirse para evitar error ES6.
    if (normal.startsWith('scripts/extensions/')) {
        if (normal.startsWith('scripts/extensions/regex') || normal === 'scripts/extensions/shared.js') {
            return false;
        }
        return true;
    }

    // Los archivos de idiomas en locales/ pesan muy poco (~1.5 MB total) y lang.json
    // es obligatorio para que i18n.js no lance SyntaxError al arrancar. Se conservan todos.

    // Quitar lector de PDF
    if (normal === 'lib/pdf.js' || normal === 'lib/pdf.worker.js') return true;

    // Quitar fuentes duplicadas si existe la versión .woff2
    if (normal.startsWith('webfonts/') && (normal.endsWith('.woff') || normal.endsWith('.ttf'))) {
        const woff2 = normal.replace(/\.(woff|ttf)$/, '.woff2');
        if (existsSync(join(PUBLIC, woff2))) return true;
    }

    return false;
}

/**
 * Copia recursiva con filtrado.
 */
function copiarDirectorio(origen, destino, baseOrigen = origen) {
    if (!existsSync(destino)) mkdirSync(destino, { recursive: true });
    const entradas = readdirSync(origen, { withFileTypes: true });

    for (const ent of entradas) {
        const rutaOrigen = join(origen, ent.name);
        const rutaDestino = join(destino, ent.name);
        const rel = relative(baseOrigen, rutaOrigen);

        if (omitirEnCopia(rel)) continue;

        if (ent.isDirectory()) {
            copiarDirectorio(rutaOrigen, rutaDestino, baseOrigen);
        } else {
            copyFileSync(rutaOrigen, rutaDestino);
        }
    }
}

/**
 * Prepara la carpeta app-android/www con la versión ligera del juego y el cargador.
 */
export async function copiarApp(log = console.log) {
    log('📦 [1/4] Preparando carpeta www para la app...');
    if (existsSync(WWW_DIR)) {
        rmSync(WWW_DIR, { recursive: true, force: true });
    }
    mkdirSync(WWW_DIR, { recursive: true });

    // 1. Copiar public filtrado
    log('   Copiando archivos del juego (excluyendo lo innecesario)...');
    copiarDirectorio(PUBLIC, WWW_DIR);

    // 2. Colocar lib.js
    let libPath = buscarLibJs();
    if (!libPath) {
        log('   Compilando lib.js con Webpack...');
        // Intentar compilar si no está en caché
        try {
            const webpackServe = (await import('../src/middleware/webpack-serve.js')).default;
            const mw = webpackServe();
            await mw.runWebpackCompiler({ forceDist: true });
            libPath = buscarLibJs();
        } catch (e) {
            log(`   Aviso al compilar lib.js: ${e.message}`);
        }
    }
    if (libPath && existsSync(libPath)) {
        copyFileSync(libPath, join(WWW_DIR, 'lib.js'));
        log(`   lib.js copiado (${Math.round(statSync(join(WWW_DIR, 'lib.js')).size / 1024)} KB)`);
    } else {
        log('   ⚠️  No se encontró lib.js en caché; asegúrate de compilarlo.');
    }

    // 3. Inyectar cargador en index.html
    const indexPath = join(WWW_DIR, 'index.html');
    if (existsSync(indexPath)) {
        let indexHtml = readFileSync(indexPath, 'utf8');
        const scriptInyeccion = '    <!-- Servidor de bolsillo offline para APK Dnd Master -->\n    <script type="module" src="scripts/sin-servidor/cargador.js"></script>\n';
        if (!indexHtml.includes('sin-servidor/cargador.js')) {
            indexHtml = indexHtml.replace(
                '<script type="module" src="script.js"></script>',
                `${scriptInyeccion}    <script type="module" src="script.js"></script>`,
            );
        }
        // Neutralizar el #preloader fijo para que nunca bloquee la vista con pantalla negra
        if (indexHtml.includes('id="preloader"')) {
            indexHtml = indexHtml.replace(/<div id="preloader"><\/div>/g, '<!-- preloader omitido en APK para evitar pantalla negra fija -->');
            log('   Capa fija #preloader neutralizada en index.html');
        }
        writeFileSync(indexPath, indexHtml, 'utf8');
        log('   Cargador offline inyectado en index.html');
    }

    log('   Copia completada con éxito.');
}

/**
 * Calcula tamaño y verifica archivos esenciales.
 */
export function verificarCopia(log = console.log) {
    log('🔍 Verificando integridad de app-android/www...');
    if (!existsSync(WWW_DIR)) {
        log('   ❌ No existe app-android/www. Ejecuta --copiar primero.');
        return false;
    }

    const obligatorios = [
        'index.html',
        'script.js',
        'lib.js',
        'scripts/sin-servidor/cargador.js',
        'scripts/sin-servidor/disco.js',
        'scripts/sin-servidor/rutas.js',
        'scripts/extensions/regex/engine.js',
        'scripts/extensions/shared.js',
        'locales/lang.json',
        'locales/es-es.json',
        'mundos/gremio.pack.json',
        'mundos/strahd.pack.json',
        'img/game-engine/pixel/app/icono-512.png',
    ];

    let faltan = 0;
    for (const f of obligatorios) {
        if (!existsSync(join(WWW_DIR, f))) {
            log(`   ❌ Falta archivo esencial: ${f}`);
            faltan++;
        }
    }

    // Calcular tamaño total
    let totalBytes = 0;
    let totalArchivos = 0;
    function sumar(dir) {
        for (const e of readdirSync(dir, { withFileTypes: true })) {
            const p = join(dir, e.name);
            if (e.isDirectory()) sumar(p);
            else {
                totalBytes += statSync(p).size;
                totalArchivos++;
            }
        }
    }
    sumar(WWW_DIR);

    const mb = (totalBytes / (1024 * 1024)).toFixed(2);
    log(`   Total archivos: ${totalArchivos}`);
    log(`   Peso total sin comprimir: ${mb} MB (esperado ~35-40 MB)`);

    if (faltan === 0) {
        log('   ✅ Verificación superada con éxito.');
        return true;
    }
    return false;
}

/**
 * Inicializa y sincroniza el proyecto Capacitor y la plataforma Android.
 */
export async function sincronizarCapacitor(log = console.log) {
    log('⚙️  [2/4] Sincronizando proyecto Capacitor y Android...');
    if (!existsSync(APP_DIR)) mkdirSync(APP_DIR, { recursive: true });

    // 1. package.json de app-android
    const pkgPath = join(APP_DIR, 'package.json');
    if (!existsSync(pkgPath)) {
        const pkg = {
            name: 'dnd-master-android',
            version: '1.0.0',
            private: true,
            description: 'Dnd Master como APK nativa de Android sin servidor',
            dependencies: {
                '@capacitor/core': '^7.0.0',
                '@capacitor/android': '^7.0.0',
                '@capacitor/app': '^7.0.0',
                '@capacitor/filesystem': '^7.0.0',
                '@capacitor/share': '^7.0.0',
                '@capacitor/status-bar': '^7.0.0',
            },
        };
        writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
        log('   Creado app-android/package.json');
    }

    // 2. capacitor.config.json
    const capConfigPath = join(APP_DIR, 'capacitor.config.json');
    const capConfig = {
        appId: 'com.dndcoin.juego',
        appName: 'Dnd Master',
        webDir: 'www',
        server: {
            androidScheme: 'https',
            hostname: 'localhost',
        },
        android: {
            allowMixedContent: false,
            backgroundColor: '#1a181b',
        },
    };
    writeFileSync(capConfigPath, JSON.stringify(capConfig, null, 2), 'utf8');

    // 2b. Los paquetes de Capacitor (node_modules no se sube a GitHub)
    if (!existsSync(join(APP_DIR, 'node_modules', '@capacitor', 'android'))) {
        log('   Instalando los paquetes de Capacitor (solo la primera vez)...');
        spawnSync('npm', ['install'], { cwd: APP_DIR, shell: true, encoding: 'utf8', stdio: 'inherit' });
    }

    // 3. Añadir plataforma android si no existe
    const androidDir = join(APP_DIR, 'android');
    if (!existsSync(androidDir)) {
        log('   Generando plataforma Android nativa con Capacitor...');
        const initRun = spawnSync('npx', ['@capacitor/cli', 'add', 'android'], {
            cwd: APP_DIR,
            shell: true,
            encoding: 'utf8',
            stdio: 'inherit',
        });
        if (initRun.status !== 0) {
            log('   Aviso al añadir plataforma android: ' + (initRun.stderr || ''));
        }
    }

    // 4. Sincronizar www -> android/app/src/main/assets/public
    log('   Ejecutando cap sync android...');
    const syncRun = spawnSync('npx', ['@capacitor/cli', 'sync', 'android'], {
        cwd: APP_DIR,
        shell: true,
        encoding: 'utf8',
        stdio: 'inherit',
    });
    if (syncRun.status !== 0) {
        log('   Aviso al sincronizar: ' + (syncRun.stderr || ''));
    }

    log('   Sincronización completada.');
}

/**
 * Compila la APK con Gradle usando el JDK y Android SDK detectados.
 */
export async function compilarApk(tipo = 'debug', log = console.log) {
    log(`🔨 [3/4] Compilando APK (${tipo})...`);
    // El Java de Android Studio (25) es demasiado nuevo para Gradle 8: se usa un JDK 21 portátil
    // en app-android/jdk (no se sube a GitHub; se descarga solo la primera vez, ~190 MB).
    if (!existsSync(join(APP_DIR, 'jdk', 'jdk-21.0.6+7', 'bin', 'java.exe'))) {
        log('   Descargando el JDK 21 portátil (solo la primera vez)...');
        spawnSync(process.execPath, [join(HERE, 'obtener-jdk21.mjs')], { encoding: 'utf8', windowsHide: true });
    }
    const env = detectarEntorno();

    if (!env.javaHome) {
        throw new Error('No se ha detectado JAVA_HOME ni el JDK de Android Studio (jbr).');
    }
    if (!env.androidHome) {
        throw new Error('No se ha detectado ANDROID_HOME ni el SDK de Android.');
    }

    log(`   JAVA_HOME: ${env.javaHome}`);
    log(`   ANDROID_HOME: ${env.androidHome}`);

    const gradlew = join(APP_DIR, 'android', 'gradlew.bat');
    if (!existsSync(gradlew)) {
        throw new Error(`No se encuentra gradlew.bat en ${gradlew}. ¿Ejecutaste --sync?`);
    }

    // Asegurar local.properties con sdk.dir
    const localProps = join(APP_DIR, 'android', 'local.properties');
    const sdkEscapado = env.androidHome.replace(/\\/g, '\\\\').replace(/:/g, '\\:');
    writeFileSync(localProps, `sdk.dir=${sdkEscapado}\n`, 'utf8');

    const tarea = tipo === 'release' ? 'assembleRelease' : 'assembleDebug';
    log(`   Ejecutando gradlew.bat ${tarea}...`);

    const procesoEnv = {
        ...process.env,
        JAVA_HOME: env.javaHome,
        ANDROID_HOME: env.androidHome,
        ANDROID_SDK_ROOT: env.androidHome,
        PATH: `${join(env.javaHome, 'bin')};${join(env.androidHome, 'platform-tools')};${process.env.PATH}`,
    };

    const res = spawnSync('cmd.exe', ['/c', 'gradlew.bat', tarea, '--no-daemon'], {
        cwd: join(APP_DIR, 'android'),
        env: procesoEnv,
        encoding: 'utf8',
        windowsHide: true,
    });

    if (res.status !== 0) {
        log(`   ❌ Error de Gradle (código ${res.status}):\n${res.stdout || ''}\n${res.stderr || ''}`);
        throw new Error('Falló la compilación de la APK con Gradle.');
    }

    // Ubicación de salida de Gradle
    const apkRelativa = tipo === 'release'
        ? 'android/app/build/outputs/apk/release/app-release-unsigned.apk'
        : 'android/app/build/outputs/apk/debug/app-debug.apk';
    const apkGenerada = join(APP_DIR, apkRelativa);

    if (!existsSync(apkGenerada)) {
        throw new Error(`Gradle finalizó pero no se encontró la APK en ${apkGenerada}`);
    }

    // Copiar a app-android/salida y a salida/
    if (!existsSync(SALIDA_DIR)) mkdirSync(SALIDA_DIR, { recursive: true });
    const apkDestino = join(SALIDA_DIR, 'Dnd-Master.apk');
    copyFileSync(apkGenerada, apkDestino);

    const rootSalida = join(ROOT, 'salida');
    if (!existsSync(rootSalida)) mkdirSync(rootSalida, { recursive: true });
    copyFileSync(apkGenerada, join(rootSalida, 'Dnd-Master.apk'));

    const pesoMb = (statSync(apkDestino).size / (1024 * 1024)).toFixed(2);
    log(`\n🎉 [4/4] ¡APK MONTADA CON ÉXITO!`);
    log(`   Ruta: ${apkDestino}`);
    log(`   Tamaño: ${pesoMb} MB\n`);

    return apkDestino;
}

/**
 * Instala la APK en un móvil conectado vía USB mediante ADB.
 */
export async function instalarApk(apkPath, log = console.log) {
    log('📲 Instalando APK en dispositivo por USB...');
    const env = detectarEntorno();

    if (!env.adbPath) {
        throw new Error('No se encontró adb.exe para instalar por USB.');
    }
    if (env.dispositivos.length === 0) {
        throw new Error('No hay ningún dispositivo Android conectado con depuración USB habilitada.');
    }

    const apk = apkPath || join(SALIDA_DIR, 'Dnd-Master.apk');
    if (!existsSync(apk)) {
        throw new Error(`No existe la APK en ${apk}. Compílala primero.`);
    }

    const disp = env.dispositivos[0];
    log(`   Dispositivo detectado: ${disp}`);
    log(`   Instalando ${basename(apk)}...`);

    const res = spawnSync(env.adbPath, ['-s', disp, 'install', '-r', apk], {
        encoding: 'utf8',
        windowsHide: true,
    });

    if (res.status === 0 && (res.stdout.includes('Success') || res.stderr.includes('Success'))) {
        log('   ✅ ¡Instalada con éxito en el teléfono sin borrar partidas!');
        return true;
    } else {
        log(`   ❌ Error al instalar:\n${res.stdout || ''}\n${res.stderr || ''}`);
        return false;
    }
}

// ---------------------------------------------------- EJECUCIÓN DIRECTA CLI
const args = process.argv.slice(2);
if (process.argv[1] && import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
    (async () => {
        try {
            if (args.includes('--entorno')) {
                const e = detectarEntorno();
                console.log(JSON.stringify(e, null, 2));
                process.exit(0);
            }
            if (args.includes('--copiar')) {
                await copiarApp();
                verificarCopia();
                process.exit(0);
            }
            if (args.includes('--check')) {
                const ok = verificarCopia();
                process.exit(ok ? 0 : 1);
            }
            if (args.includes('--sync')) {
                await sincronizarCapacitor();
                process.exit(0);
            }
            if (args.includes('--instalar')) {
                await instalarApk();
                process.exit(0);
            }

            // Flujo completo por defecto
            console.log('🚀 Iniciando montaje de la APK de Dnd Master...');
            await copiarApp();
            verificarCopia();
            await sincronizarCapacitor();
            const apk = await compilarApk('debug');

            if (args.includes('--con-instalar')) {
                await instalarApk(apk);
            }
        } catch (err) {
            console.error(`\n❌ Error en el proceso: ${err.message}`);
            process.exit(1);
        }
    })();
}
