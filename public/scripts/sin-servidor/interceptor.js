/**
 * Interceptor de red para el servidor de bolsillo (A2 de wiki/ROADMAP_APK_ANDROID.md).
 *
 * Parchea `window.fetch` y `window.XMLHttpRequest` para desviar las llamadas
 * a `/api/...`, `/csrf-token`, `/version`, `/user/files/...`, etc. a `rutas.js`.
 * Las peticiones a archivos estáticos (/scripts/, /css/, /img/, /mundos/)
 * pasan intactas al navegador/WebView.
 */

import { responder } from './rutas.js';

const RUTAS_INTERCEPTADAS = [
    '/api/',
    '/csrf-token',
    '/version',
    '/user/files/',
    '/user/images/',
    '/characters/',
    '/thumbnail',
    '/css/user.css',
];

/**
 * Comprueba si una URL debe ser atendida por el servidor de bolsillo.
 *
 * @param {string} url
 * @returns {boolean}
 */
export function debeInterceptar(url) {
    if (!url) return false;
    try {
        const u = new URL(url, window.location.href);
        const path = u.pathname;
        return RUTAS_INTERCEPTADAS.some((prefijo) => path === prefijo || path.startsWith(prefijo));
    } catch {
        return RUTAS_INTERCEPTADAS.some((prefijo) => url.startsWith(prefijo));
    }
}

/**
 * Activa la interceptación en el navegador.
 */
export function activarInterceptor() {
    if (typeof window === 'undefined') return;
    if (window.__INTERCEPTOR_SIN_SERVIDOR__) return;
    window.__INTERCEPTOR_SIN_SERVIDOR__ = true;

    const originalFetch = window.fetch;
    const OriginalXHR = window.XMLHttpRequest;

    // 1. Parche de window.fetch
    window.fetch = async function (input, init = {}) {
        let url = typeof input === 'string' ? input : input?.url || '';
        if (debeInterceptar(url)) {
            const method = (init.method || (typeof input === 'object' && input.method) || 'GET').toUpperCase();
            let body = init.body;
            if (typeof body === 'string') {
                try {
                    body = JSON.parse(body);
                } catch {
                    // Mantener como string si no es JSON
                }
            }
            const res = await responder(method, url, body, init.headers || {});
            const bodyStr = typeof res.data === 'object' ? JSON.stringify(res.data) : String(res.data ?? '');

            return new Response(bodyStr, {
                status: res.status,
                statusText: res.statusText,
                headers: res.headers,
            });
        }
        return originalFetch.apply(this, arguments);
    };

    // 2. Parche de window.XMLHttpRequest (usado por jQuery.ajax)
    class MockXMLHttpRequest extends EventTarget {
        constructor() {
            super();
            this.readyState = 0; // UNSENT
            this.status = 0;
            this.statusText = '';
            this.responseText = '';
            this.response = '';
            this.responseType = '';
            this.requestHeaders = {};
            this.responseHeaders = {};
            this._method = 'GET';
            this._url = '';
            this._isIntercepted = false;
            this._realXhr = null;
        }

        open(method, url, async = true) {
            this._method = method;
            this._url = url;
            this._isIntercepted = debeInterceptar(url);

            if (!this._isIntercepted) {
                this._realXhr = new OriginalXHR();
                this._copiarEventosReal();
                return this._realXhr.open(method, url, async);
            }

            this.readyState = 1; // OPENED
            this._triggerEvent('readystatechange');
        }

        setRequestHeader(name, value) {
            if (!this._isIntercepted && this._realXhr) {
                return this._realXhr.setRequestHeader(name, value);
            }
            this.requestHeaders[name.toLowerCase()] = value;
        }

        send(body) {
            if (!this._isIntercepted && this._realXhr) {
                return this._realXhr.send(body);
            }

            let parsedBody = body;
            if (typeof body === 'string') {
                try {
                    parsedBody = JSON.parse(body);
                } catch {
                    // Texto plano o form-data
                }
            }

            // Responder asíncronamente
            setTimeout(async () => {
                try {
                    const res = await responder(this._method, this._url, parsedBody, this.requestHeaders);
                    this.status = res.status;
                    this.statusText = res.statusText;
                    this.responseHeaders = res.headers;

                    const bodyStr = typeof res.data === 'object' ? JSON.stringify(res.data) : String(res.data ?? '');
                    this.responseText = bodyStr;
                    this.response = this.responseType === 'json' ? res.data : bodyStr;

                    this.readyState = 4; // DONE
                    this._triggerEvent('readystatechange');
                    this._triggerEvent('load');
                } catch (err) {
                    this.status = 500;
                    this.statusText = 'Internal Server Error';
                    this.readyState = 4;
                    this._triggerEvent('readystatechange');
                    this._triggerEvent('error');
                }
            }, 0);
        }

        abort() {
            if (!this._isIntercepted && this._realXhr) {
                return this._realXhr.abort();
            }
            this.readyState = 0;
            this._triggerEvent('abort');
        }

        getResponseHeader(name) {
            if (!this._isIntercepted && this._realXhr) {
                return this._realXhr.getResponseHeader(name);
            }
            return this.responseHeaders[name.toLowerCase()] || null;
        }

        getAllResponseHeaders() {
            if (!this._isIntercepted && this._realXhr) {
                return this._realXhr.getAllResponseHeaders();
            }
            return Object.entries(this.responseHeaders)
                .map(([k, v]) => `${k}: ${v}`)
                .join('\r\n');
        }

        _triggerEvent(type) {
            const ev = new Event(type);
            if (typeof this[`on${type}`] === 'function') {
                this[`on${type}`](ev);
            }
            this.dispatchEvent(ev);
        }

        _copiarEventosReal() {
            const eventos = ['load', 'error', 'abort', 'progress', 'readystatechange'];
            for (const ev of eventos) {
                this._realXhr.addEventListener(ev, (e) => {
                    this.readyState = this._realXhr.readyState;
                    this.status = this._realXhr.status;
                    this.statusText = this._realXhr.statusText;
                    this.responseText = this._realXhr.responseText;
                    this.response = this._realXhr.response;
                    this._triggerEvent(ev);
                });
            }
        }
    }

    window.XMLHttpRequest = /** @type {any} */ (MockXMLHttpRequest);
    console.info('[ServidorBolsillo] Interceptor de red activado.');
}
