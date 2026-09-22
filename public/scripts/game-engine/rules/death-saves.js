/**
 * Caer a 0 no es morir: es empezar a jugárselo.
 *
 * Hasta ahora un personaje a 0 PG quedaba *Unconscious* y ahí se acababa todo — no se
 * moría, no se recuperaba, no pasaba nada. El momento más tenso de una mesa de D&D, el de
 * los tres dados contra los tres dados, **no existía**.
 *
 * Las reglas son las de 5e, que son buenas: a partir de tu turno tiras un d20 a pelo. Diez
 * o más es un éxito, menos es un fallo. Tres éxitos y te estabilizas; tres fallos y se
 * acabó. Un 20 natural es levantarse con 1 PG; un 1 natural cuenta por dos. Y un golpe
 * encima de un cuerpo caído es un fallo automático — dos si es crítico.
 *
 * Puro y determinista: la tirada entra como función. Ni cura, ni narra, ni mata a nadie:
 * devuelve lo que ha pasado y quien llama lo escribe.
 *
 * Ver wiki/PROPUESTAS_MEJORA_V2.md, PROP2-059.
 */

/** Lo que hace falta para salir, en un lado o en el otro. */
export const DEATH_SAVE_TARGET = 3;

/** Un d20 a pelo: diez o más salva. */
export const DEATH_SAVE_DC = 10;

/**
 * @typedef {Object} DeathSaveState
 * @property {number} successes
 * @property {number} failures
 * @property {boolean} stable Se ha estabilizado: sigue a 0 PG, pero deja de tirar.
 * @property {boolean} dead
 */

/**
 * Lee el estado de la ficha, que puede no tenerlo o tenerlo a medias.
 *
 * @param {any} member
 * @returns {DeathSaveState}
 */
export function readDeathSaves(member) {
    const raw = (member?.deathSaves && typeof member.deathSaves === 'object') ? member.deathSaves : {};
    return {
        successes: Math.max(0, Math.min(DEATH_SAVE_TARGET, Math.floor(Number(raw.successes) || 0))),
        failures: Math.max(0, Math.min(DEATH_SAVE_TARGET, Math.floor(Number(raw.failures) || 0))),
        stable: Boolean(raw.stable),
        dead: Boolean(raw.dead),
    };
}

/**
 * Si le toca tirar: está a cero, no se ha estabilizado y no está muerto.
 *
 * @param {any} member
 * @returns {boolean}
 */
export function isDying(member) {
    const state = readDeathSaves(member);
    return (Number(member?.hp) || 0) <= 0 && !state.stable && !state.dead;
}

/** El estado limpio, para quien se levanta o para quien acaba de caer. */
export function clearDeathSaves() {
    return { successes: 0, failures: 0, stable: false, dead: false };
}

/**
 * Una tirada de salvación de muerte.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {() => {total: number, natural?: number}} input.roll
 * @returns {{
 *   natural: number, outcome: 'up'|'stable'|'dead'|'pending',
 *   saves: DeathSaveState, hp: number|null, line: string,
 * }}
 */
export function rollDeathSave({ member, roll }) {
    const name = String(member?.name ?? 'Alguien');
    const result = roll();
    const natural = Math.max(1, Math.floor(Number(result?.natural ?? result?.total) || 1));
    const state = readDeathSaves(member);

    // Un 20 natural no estabiliza: levanta. Es la regla que convierte el momento en una
    // historia que se cuenta luego.
    if (natural === 20) {
        return {
            natural,
            outcome: 'up',
            saves: clearDeathSaves(),
            hp: 1,
            line: `🎲 ${name} saca un 20 natural y vuelve en sí con 1 PG.`,
        };
    }

    if (natural === 1) state.failures += 2;
    else if (natural >= DEATH_SAVE_DC) state.successes += 1;
    else state.failures += 1;

    state.successes = Math.min(DEATH_SAVE_TARGET, state.successes);
    state.failures = Math.min(DEATH_SAVE_TARGET, state.failures);

    if (state.failures >= DEATH_SAVE_TARGET) {
        return {
            natural,
            outcome: 'dead',
            saves: { ...state, dead: true },
            hp: 0,
            line: `☠️ ${name} saca ${natural} y no despierta. Tres fallos.`,
        };
    }

    if (state.successes >= DEATH_SAVE_TARGET) {
        return {
            natural,
            outcome: 'stable',
            saves: { ...state, stable: true },
            hp: 0,
            line: `🩹 ${name} saca ${natural} y se estabiliza. Sigue a 0 PG, pero deja de tirar.`,
        };
    }

    const kind = natural === 1 ? 'pifia: dos fallos' : (natural >= DEATH_SAVE_DC ? 'éxito' : 'fallo');
    return {
        natural,
        outcome: 'pending',
        saves: state,
        hp: null,
        line: `🎲 ${name} tira salvación de muerte: ${natural} (${kind}). `
            + `${state.successes}/${DEATH_SAVE_TARGET} éxitos, ${state.failures}/${DEATH_SAVE_TARGET} fallos.`,
    };
}

/**
 * Un golpe sobre alguien que ya está en el suelo.
 *
 * @param {any} member
 * @param {boolean} [crit]
 * @returns {{saves: DeathSaveState, outcome: 'dead'|'pending', line: string}}
 */
export function takeHitWhileDown(member, crit = false) {
    const name = String(member?.name ?? 'Alguien');
    const state = readDeathSaves(member);
    state.failures = Math.min(DEATH_SAVE_TARGET, state.failures + (crit ? 2 : 1));
    // Golpear a un cuerpo caído lo saca de la estabilización: vuelve a jugárselo.
    state.stable = false;

    if (state.failures >= DEATH_SAVE_TARGET) {
        return {
            saves: { ...state, dead: true },
            outcome: 'dead',
            line: `☠️ El golpe remata a ${name}.`,
        };
    }

    return {
        saves: state,
        outcome: 'pending',
        line: `🩸 Golpe sobre ${name}, que está en el suelo: ${crit ? 'dos fallos' : 'un fallo'} automático `
            + `(${state.failures}/${DEATH_SAVE_TARGET}).`,
    };
}

/**
 * Cómo va la cosa, para la ficha y para la tira del grupo.
 *
 * @param {any} member
 * @returns {string}
 */
export function describeDeathSaves(member) {
    const state = readDeathSaves(member);
    if (state.dead) return 'Muerto';
    if (state.stable) return 'Estabilizado';
    if ((Number(member?.hp) || 0) > 0) return '';
    return `Salvaciones: ${state.successes} éxito(s), ${state.failures} fallo(s)`;
}
