/**
 * Ayuda la primera vez y glosario (ideas 155 y 156).
 *
 * - **Consejos**: la primera vez que aparece cada cosa (el combate, la exploración, el diario),
 *   un aviso corto que dice qué hacer con ella. Una vez, y ya: el que se repite molesta.
 * - **Glosario**: las palabras de las reglas, dichas en llano. Se abre con la L o desde
 *   «¿Qué hago?».
 *
 * Puro: qué consejo toca y qué dice cada palabra.
 */

/** Un consejo por situación, la primera vez que se ve. */
export const TIPS = {
    dialogue: 'Escribe lo que hace tu personaje, o usa las fichas de abajo. Arriba, el diario (D) y «¿Qué hago?» (H).',
    exploration: 'Aquí están los servicios del sitio y el mapa: pulsa un sitio para viajar. Cada viaje cuesta días y comida.',
    combat: 'Pulsa un enemigo para ver cuánto le das. La línea de arriba dice a por quién va cada uno. «Maniobras»: esquivar, empujar, agarrar…',
    travel: 'El ritmo decide: rápido llega antes pero sin dormir; con cuidado se esquivan contratiempos.',
    prisoners: 'Un prisionero se puede interrogar (da un rumor), entregar donde hay autoridad o soltar.',
};

/**
 * El consejo que toca ahora, si no se ha visto ya.
 *
 * @param {string} situation Una de las claves de `TIPS`.
 * @param {string[]} seen
 * @returns {{id: string, text: string}|null}
 */
export function tipFor(situation, seen) {
    const id = String(situation ?? '');
    if (!(id in TIPS) || (seen || []).includes(id)) return null;
    return { id, text: TIPS[/** @type {keyof typeof TIPS} */ (id)] };
}

/** Las palabras de las reglas, en llano. */
export const GLOSSARY = [
    { term: 'CA (clase de armadura)', means: 'Lo difícil que es acertarte. Para dar, la tirada de ataque tiene que llegar a la CA del otro.' },
    { term: 'CD (dificultad)', means: 'Lo que hay que sacar en una tirada para que salga. 10 es fácil; 15, difícil; 20, casi imposible.' },
    { term: 'PG (puntos de golpe)', means: 'La vida. A 0 caes y empiezas a tirar salvaciones de muerte.' },
    { term: 'Ventaja y desventaja', means: 'Se tiran dos d20: con ventaja te quedas el mayor; con desventaja, el menor. Una anula a la otra.' },
    { term: 'Iniciativa', means: 'El orden del combate. La moral del grupo y un centinela la suben.' },
    { term: 'Ataque de oportunidad', means: 'Si te alejas de un enemigo que te tiene pegado, te golpea gratis. Destrabarse lo evita.' },
    { term: 'Cobertura', means: 'Estar detrás de algo suma a tu CA: media, +2; tres cuartos, +5.' },
    { term: 'Salvación de muerte', means: 'A 0 PG, un d20 por turno: tres éxitos y te estabilizas; tres fallos y se acabó.' },
    { term: 'Crítico', means: 'Un 20 natural: siempre acierta, hace el doble de daño y, según el arma, algo más.' },
    { term: 'Competencia', means: 'Lo que se te da bien por tu clase o tu trasfondo: suma a esas tiradas.' },
    { term: 'Descanso corto y largo', means: 'El corto cura un poco gastando dados de golpe; el largo, del todo, y amanece.' },
    { term: 'Vínculo', means: 'Lo que te une a un compañero. Sube con lo que vivís juntos y da ventajas en combate.' },
    { term: 'Reputación', means: 'Lo que una facción piensa de vosotros, de −5 a +5. Mueve precios, peajes y cartas.' },
    { term: 'Hito', means: 'Un paso del hilo de la historia. El diario dice cuál tenéis entre manos.' },
];
