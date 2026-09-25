/**
 * Una sola forma de decir una tirada (idea 146).
 *
 * Cada sitio que tiraba un dado lo contaba a su manera: «Tirada de ataque: d20(15) +5 = 20 vs
 * AC 14», «[TIRADA Persuasión de Bran: d20 12 +3 = 15 contra CD 12 → Éxito]», «Bran empuja
 * al lobo: 15 contra 12». Tres formas para lo mismo, una en inglés. Quien juega tenía que
 * aprender a leer cada una, y el modelo también.
 *
 * Ahora todas dicen lo mismo en el mismo orden: **qué, de quién, cuánto, contra qué, si sale**,
 * y el desglose entre paréntesis al final, para quien quiera comprobarlo:
 *
 *   🎲 Persuasión de Bran: 15 contra CD 12 ✓ Éxito (d20 12 +3)
 *   🎲 Ataque de Bran a Lobo: 20 contra CA 14 ✓ (d20 15 +5 · con ventaja: está en el suelo)
 *
 * Puro: redacta.
 */

/**
 * @param {Object} input
 * @param {string} input.what       Qué se tira: «Persuasión», «Ataque», «Agarrar».
 * @param {string} [input.who]      De quién.
 * @param {string} [input.at]       A quién, si va contra alguien.
 * @param {number} input.total
 * @param {number|null} [input.against] Contra cuánto; sin nada, una tirada suelta.
 * @param {string} [input.label]    Qué es ese número: «CD», «CA», o nada si es otra tirada.
 * @param {boolean|null} [input.success]
 * @param {string} [input.verdict]  La palabra, para el modelo: «Éxito», «Fallo rotundo».
 * @param {number|null} [input.natural] Lo que marcó el d20.
 * @param {number|null} [input.modifier]
 * @param {string} [input.extra]    Lo que va detrás del desglose: cobertura, ventaja.
 * @returns {string}
 */
export function rollLine({ what, who = '', at = '', total, against = null, label = 'CD', success = null, verdict = '', natural = null, modifier = null, extra = '' }) {
    const head = `${what}${who ? ` de ${who}` : ''}${at ? ` a ${at}` : ''}`;
    const vs = against == null ? '' : ` contra ${label ? `${label} ` : ''}${against}`;
    const mark = success == null ? '' : success ? ' ✓' : ' ✗';
    const word = verdict ? ` ${verdict}` : '';
    const sign = (/** @type {number} */ n) => (n >= 0 ? `+${n}` : `${n}`);
    const tail = String(extra ?? '').trim().replace(/^·\s*/, '');
    const parts = [
        natural != null ? `d20 ${natural}${modifier != null ? ` ${sign(Number(modifier))}` : ''}` : '',
        tail,
    ].filter(Boolean);
    return `🎲 ${head}: ${total}${vs}${mark}${word}${parts.length > 0 ? ` (${parts.join(' · ')})` : ''}`;
}

/**
 * El daño, con la misma forma: cuánto, y el desglose.
 *
 * @param {Object} input
 * @param {number} input.total
 * @param {string} input.formula  Los dados: «1d8».
 * @param {number} input.rolled   Lo que salió en los dados.
 * @param {number} [input.modifier]
 * @param {number} [input.crit]   Lo que sumó el crítico.
 * @param {string} [input.extra]
 * @returns {string}
 */
export function damageLine({ total, formula, rolled, modifier = 0, crit = 0, extra = '' }) {
    const sign = (/** @type {number} */ n) => (n >= 0 ? `+${n}` : `${n}`);
    const bits = [`${formula} ${rolled}`];
    if (Number(crit) > 0) bits.push(`crítico +${crit}`);
    if (Number(modifier) !== 0) bits.push(sign(Number(modifier)));
    const tail = String(extra ?? '').trim();
    return `💥 Daño: ${total} (${bits.join(' ')}${tail ? ` · ${tail}` : ''})`;
}
