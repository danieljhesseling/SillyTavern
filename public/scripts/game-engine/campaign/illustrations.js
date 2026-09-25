/**
 * Ilustraciones de sitios y gente con PixelLab, opcional (idea 183). Cuesta créditos.
 *
 * Nada se pide solo: sin clave no hay botón, y con clave cada ilustración es un botón que
 * dice lo que cuesta antes de pulsarlo. Lo que llega se guarda en el mundo (la imagen, en
 * línea) y ya no se vuelve a pedir.
 *
 * La dirección del servicio y la clave se escriben en los ajustes de ilustraciones: si
 * PixelLab cambia su dirección, se cambia ahí, sin tocar código.
 *
 * Puro: arma la petición y lee la respuesta. Quien llama la manda.
 */

/** Lo que se usa si no se escribe otra cosa. */
export const ILLUSTRATION_DEFAULTS = {
    endpoint: 'https://api.pixellab.ai/v1/generate-image-pixflux',
    size: 128,
};

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * @param {any} raw
 * @returns {{key: string, endpoint: string, size: number}}
 */
export function readIllustrationSettings(raw) {
    const size = Math.floor(Number(raw?.size) || ILLUSTRATION_DEFAULTS.size);
    return {
        key: text(raw?.key),
        endpoint: text(raw?.endpoint) || ILLUSTRATION_DEFAULTS.endpoint,
        size: [64, 128, 256].includes(size) ? size : ILLUSTRATION_DEFAULTS.size,
    };
}

/**
 * La descripción que se pide: de un sitio o de una persona, con el tono del mundo.
 *
 * @param {{kind: 'place'|'person', name: string, about: string, genre?: string}} input
 * @returns {string}
 */
export function promptFor({ kind, name, about, genre = '' }) {
    const what = kind === 'place' ? 'a location, wide view, no people' : 'a character portrait, bust, facing the viewer';
    return [`${what}: ${text(name)}.`, text(about).slice(0, 300), genre ? `Style: ${text(genre)}, pixel art.` : 'Pixel art.'].filter(Boolean).join(' ');
}

/**
 * La petición HTTP, lista para `fetch`.
 *
 * @param {{key: string, endpoint: string, size: number}} settings
 * @param {string} description
 * @returns {{url: string, init: {method: string, headers: Record<string, string>, body: string}}|null}
 */
export function buildRequest(settings, description) {
    if (!text(settings?.key) || !text(description)) return null;
    return {
        url: settings.endpoint,
        init: {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.key}` },
            body: JSON.stringify({ description: text(description), image_size: { width: settings.size, height: settings.size } }),
        },
    };
}

/**
 * La imagen de la respuesta, como `data:` para guardar en línea; o vacío si no la trae.
 *
 * @param {any} response El JSON que devuelve el servicio.
 * @returns {string}
 */
export function imageFrom(response) {
    const b64 = text(response?.image?.base64 ?? response?.image_base64 ?? response?.base64);
    if (!b64) return '';
    return b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
}
