/**
 * Cargador de inicio para Dnd Master sin servidor (A1, A2 y A3 de wiki/ROADMAP_APK_ANDROID.md).
 *
 * Se incluye en index.html antes de script.js en la versión de la APK / sin servidor:
 * 1. Enciende `window.SIN_SERVIDOR = true`.
 * 2. Fuerza `?juego` en la dirección para entrar directo a la portada de Dnd Master.
 * 3. Activa el interceptor de peticiones (servidor de bolsillo).
 * 4. Si es la primera vez que arranca, siembra las fichas de narradores y mundos base.
 */

import { activarInterceptor } from './interceptor.js';
import * as disco from './disco.js';

// 0. Eliminar de inmediato la capa fija #preloader para que nunca bloquee la vista en Android / sin servidor
try {
    if (typeof document !== 'undefined') {
        document.documentElement?.setAttribute('data-sin-servidor', 'true');
        const removerPreloader = () => {
            const pre = document.getElementById('preloader');
            if (pre) pre.remove();
        };
        removerPreloader();
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', removerPreloader, { once: true });
        }
        // Inyectar regla CSS defensiva por si acaso el elemento se reinsertara
        const estilo = document.createElement('style');
        estilo.id = 'estilo-anti-preloader';
        estilo.textContent = '#preloader { display: none !important; opacity: 0 !important; pointer-events: none !important; }';
        document.head ? document.head.appendChild(estilo) : document.addEventListener('DOMContentLoaded', () => document.head.appendChild(estilo), { once: true });

        // Logger global de errores para WebView / logcat
        window.addEventListener('error', (e) => {
            console.error('[ServidorBolsillo Uncaught Error]', e.message, e.filename, e.lineno, e.error);
        });
        window.addEventListener('unhandledrejection', (e) => {
            console.error('[ServidorBolsillo Unhandled Rejection]', e.reason);
        });

        // Watchdog de seguridad: si tras 4.5 segundos el splash "Initializing..." siguiera activo, retirarlo
        setTimeout(() => {
            try {
                const splash = document.querySelector('.splash-screen, #loader.splash-screen, .action-loader-overlay');
                if (splash) {
                    console.warn('[ServidorBolsillo] Watchdog: retirando splash de carga para mostrar el juego');
                    document.querySelectorAll('#loader, .splash-screen, .action-loader-overlay').forEach(el => el.remove());
                }
            } catch (err) {
                console.warn('[ServidorBolsillo] Error en watchdog:', err);
            }
        }, 4500);
    }
} catch {
    // Si no se puede manipular el DOM aún, continuar
}

// 1. Activar bandera sin servidor
window.SIN_SERVIDOR = true;

// 2. Entrar directo al juego (?juego)
try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('juego')) {
        url.searchParams.set('juego', '');
        window.history.replaceState({}, '', url.toString());
    }
} catch {
    // Si no se puede manipular la URL, continuar
}

// 3. Activar el interceptor inmediatamente
activarInterceptor();

/**
 * Siembra los datos iniciales si la base de datos está vacía.
 */
async function sembrarDatosIniciales() {
    try {
        const personajes = await disco.listarPersonajes();
        if (personajes.length === 0) {
            // Cargar narradores de mundos/narradores.json
            const resp = await fetch('mundos/narradores.json');
            if (resp.ok) {
                const data = await resp.json();
                const narradores = Array.isArray(data?.narrators) ? data.narrators : [];
                for (const n of narradores) {
                    await disco.guardarPersonaje(n.name, {
                        name: n.name,
                        description: n.description || '',
                        personality: n.personality || '',
                        first_mes: n.greeting || '',
                        mes_example: '',
                        creator_notes: n.note || '',
                        data: {
                            name: n.name,
                            description: n.description || '',
                            personality: n.personality || '',
                            first_mes: n.greeting || '',
                            extensions: { verbosity: n.verbosity || 'full' },
                        },
                    });
                }
                console.info(`[ServidorBolsillo] Sembrados ${narradores.length} narradores base.`);
            }
        }

        const mundos = await disco.listarMundos();
        if (mundos.length === 0) {
            // Intentar cargar mundos predefinidos si existen
            const listaMundos = ['gremio', 'strahd', '1387'];
            for (const m of listaMundos) {
                try {
                    const r = await fetch(`mundos/${m}.pack.json`);
                    if (r.ok) {
                        const pack = await r.json();
                        if (pack.world && pack.world.entries) {
                            await disco.guardarMundo(pack.name || m, pack.world);
                        }
                    }
                } catch {
                    // Si falla la carga de un pack, no interrumpe
                }
            }
        }
    } catch (err) {
        console.warn('[ServidorBolsillo] Error sembrando datos iniciales:', err);
    }
}

// Inicializar siembra de datos de fondo
sembrarDatosIniciales();
