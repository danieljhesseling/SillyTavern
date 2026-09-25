/**
 * Un sonido por acción: el golpe, el crítico, el fallo, la puerta, las monedas (idea 186).
 *
 * La música por escena la pones tú, con tus archivos. Estos no traen ninguno: se hacen en
 * el momento con el sintetizador del navegador (Web Audio), cuatro notas y un poco de
 * ruido. Por eso no hay nada que descargar ni licencia de nadie, y suenan igual en todas
 * partes.
 *
 * Se apagan en «Sonido», en la pausa, con su propio volumen. Si el navegador no deja sonar
 * (sin un clic antes, o sin audio), se callan sin romper nada.
 *
 * `cueForAttack` es puro y se prueba; `playCue` solo toca el altavoz, y apunta lo que ha
 * sonado en `lastCues` para poder comprobarlo sin oírlo.
 */

/**
 * @typedef {Object} Cue
 * @property {OscillatorType} [wave]
 * @property {Array<[number, number, number]>} [notes] Frecuencia, cuándo y cuánto (s).
 * @property {number} [noise] Segundos de ruido.
 * @property {number} [slide] Hasta qué frecuencia cae la nota (la puerta que cruje).
 * @property {number} gain
 */

/** @type {Record<string, Cue>} */
export const CUES = {
    hit: { wave: 'square', notes: [[150, 0, 0.08]], noise: 0.05, gain: 0.22 },
    crit: { wave: 'triangle', notes: [[440, 0, 0.07], [660, 0.07, 0.07], [880, 0.14, 0.12]], noise: 0.04, gain: 0.24 },
    miss: { noise: 0.16, gain: 0.12 },
    door: { wave: 'sawtooth', notes: [[110, 0, 0.32]], slide: 55, gain: 0.1 },
    coin: { wave: 'sine', notes: [[1320, 0, 0.05], [1760, 0.06, 0.09]], gain: 0.16 },
    level: { wave: 'triangle', notes: [[523, 0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.2]], gain: 0.2 },
};

/**
 * El sonido de un ataque.
 *
 * @param {{hit: boolean, crit?: boolean}} input
 * @returns {'crit'|'hit'|'miss'}
 */
export function cueForAttack({ hit, crit = false }) {
    if (hit && crit) return 'crit';
    return hit ? 'hit' : 'miss';
}

/** Lo último que ha sonado, para comprobarlo sin oírlo. */
const played = /** @type {string[]} */ ([]);

/** @type {AudioContext|null} */
let context = null;

/**
 * Lo último que ha sonado.
 *
 * @returns {string[]}
 */
export function lastCues() {
    return played.slice(-10);
}

/**
 * Hacer sonar uno.
 *
 * @param {string} kind Uno de `CUES`.
 * @param {{enabled?: boolean, volume?: number}} [options]
 * @returns {boolean} Si se pidió sonar.
 */
export function playCue(kind, { enabled = true, volume = 0.5 } = {}) {
    const cue = CUES[kind];
    if (!cue || !enabled) return false;
    played.push(kind);
    if (played.length > 50) played.splice(0, played.length - 50);
    try {
        const Ctor = /** @type {any} */ (globalThis).AudioContext ?? /** @type {any} */ (globalThis).webkitAudioContext;
        if (!Ctor) return true;
        context ??= /** @type {AudioContext} */ (new Ctor());
        const ctx = /** @type {AudioContext} */ (context);
        if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
        const now = ctx.currentTime;
        const master = ctx.createGain();
        master.gain.value = Math.max(0, Math.min(1, Number(volume) || 0)) * cue.gain;
        master.connect(ctx.destination);
        for (const [freq, at, length] of cue.notes ?? []) {
            const osc = ctx.createOscillator();
            const env = ctx.createGain();
            osc.type = cue.wave ?? 'sine';
            osc.frequency.setValueAtTime(freq, now + at);
            if (cue.slide) osc.frequency.linearRampToValueAtTime(cue.slide, now + at + length);
            env.gain.setValueAtTime(1, now + at);
            env.gain.exponentialRampToValueAtTime(0.001, now + at + length);
            osc.connect(env);
            env.connect(master);
            osc.start(now + at);
            osc.stop(now + at + length + 0.02);
        }
        if (cue.noise) {
            const size = Math.max(1, Math.floor(ctx.sampleRate * cue.noise));
            const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(master);
            source.start(now);
        }
    } catch {
        // Sin audio no pasa nada: el juego sigue igual.
    }
    return true;
}
