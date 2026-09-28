/**
 * Las notas que el motor deja para el modelo, partidas en dos: **lo que pasó**, que es para
 * quien juega, y **la orden**, que es solo para el modelo.
 *
 * Casi todas las notas acaban con una orden al narrador («Cuéntalo en uno o dos párrafos»,
 * «No inventes nada», «Dilo tal cual: …»). El modelo la necesita; quien juega, no. Con
 * modelo se leía como una instrucción colada en el chat, y sin modelo como un error: un
 * narrador que nunca contesta (ROADMAP_SIN_TOKENS, Z0).
 *
 * El modelo sigue recibiendo la nota entera; en pantalla sale solo `said`.
 *
 * Se parte por frases, y una frase es orden si empieza como empiezan las órdenes que el
 * motor escribe. Si una orden trae detrás de dos puntos algo citado («Dilo tal cual: «…»»),
 * lo citado es lo que pasó y se queda.
 */

/** Cómo empiezan las órdenes al narrador. */
const ORDERS = [
    /^cu[eé]ntal[oae]s?\b/i,
    // «Cuenta el viaje», «Cuenta la despedida»… Pero no «Cuenta saldada», que es un hecho.
    /^cuenta (el|la|los|las|lo|c[oó]mo|qu[eé]|sobre)\s/i,
    /^d[ií]l[oae]s?\b/i,
    /^descr[ií]b(e|el[oa]s?)\b/i,
    /^narra\b/i,
    /^adapta\b/i,
    /^no (inventes|digas|cambies|expliques|insin[uú]es|sabes|decidas|exageres|a[nñ]adas)\b/i,
    /^que se note\b/i,
    /^sin (explicarlo|decidir|inventar)\b/i,
    /^hazlo\b/i,
    /^usa (esto|solo)\b/i,
];

/** Las líneas enteras que son para el modelo: quién juega se lo recuerda a él, no a ti. */
const MODEL_LINES = [/^quien juega es\b/i];

/** La etiqueta del principio de una línea: «🔮 [HILO] », «[PRESAGIO] ». */
const TAG = /^(\S{1,3}\s+)?\[[^\]]{1,30}\]\s*/u;

/**
 * @param {string} sentence
 * @returns {boolean}
 */
function isOrder(sentence) {
    const bare = sentence.replace(TAG, '').trim();
    return ORDERS.some(rule => rule.test(bare));
}

/**
 * Partir una línea en frases, sin romper las citas: «…» «…» son frases aparte.
 *
 * @param {string} line
 * @returns {string[]}
 */
function sentences(line) {
    return line.split(/(?<=[.!?…»"])\s+(?=[«"¿¡([A-ZÁÉÍÓÚÑ])/u).map(s => s.trim()).filter(Boolean);
}

/**
 * @param {string} text La nota entera, como la lee el modelo.
 * @returns {{said: string, ask: string}} Lo que pasó (para la pantalla) y la orden (para el modelo).
 */
export function splitModelNote(text) {
    const said = [];
    const ask = [];
    for (const raw of String(text ?? '').split('\n')) {
        const line = raw.trim();
        if (!line) {
            said.push('');
            continue;
        }
        if (MODEL_LINES.some(rule => rule.test(line.replace(TAG, '')))) {
            ask.push(line);
            continue;
        }
        const tag = (line.match(TAG) ?? [''])[0];
        const kept = [];
        for (const sentence of sentences(line)) {
            if (!isOrder(sentence)) {
                kept.push(sentence);
                continue;
            }
            ask.push(sentence.replace(TAG, ''));
            // «Dilo tal cual, sin explicarlo: «…»»: lo citado es lo que pasó.
            const quoted = sentence.match(/:\s*([«"].*)$/u);
            if (quoted) kept.push(quoted[1]);
        }
        let out = kept.join(' ').trim();
        // Si la orden se llevó la etiqueta, la etiqueta vuelve delante de lo que queda.
        if (out && tag && !out.startsWith(tag.trim())) out = `${tag.trim()} ${out}`;
        // Una línea que era solo etiqueta y orden no deja nada.
        if (out && out.replace(TAG, '').trim()) said.push(out);
    }
    return {
        said: said.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
        ask: ask.join(' ').trim(),
    };
}
