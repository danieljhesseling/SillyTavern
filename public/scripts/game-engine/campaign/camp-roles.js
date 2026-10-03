/**
 * E6.2 de wiki/ROADMAP_ENTRETENIDO.md: los papeles de la noche en el campamento.
 *
 * Al acampar ya había quien hacía guardia (y el vigía de la formación, J7.4, la primera). Ahora,
 * mientras los demás duermen, tres papeles más:
 *
 * - **Quien cocina** busca qué cenar y lo guisa (Supervivencia, CD 12). Si sale, la cena repone:
 *   se recuperan todos los dados de golpe (no la mitad) y las heridas cuentan un día más de cura.
 * - **Quien estudia** (Investigación, CD 12) mira lo que lleváis sin identificar y dice qué es,
 *   maldición incluida, como el templo; y si sabe aprender de un pergamino, lo copia.
 * - **Quien examina el botín** (Investigación, CD 12) repasa lo de las peleas ganadas desde la
 *   última vez y encuentra lo que se os pasó: unas monedas cosidas, un anillo en una bota.
 *
 * Cosecha propia ligera (la cena se inspira en la dote Chef de 2024). Lo dice quien lo hace, con
 * sus palabras (D-J60: no hay narrador).
 *
 * Puro: propone quién, juzga la tirada y dice qué pasa. Quien llama tira, identifica y paga.
 */

/** La prueba de cada papel. */
export const NIGHT_DC = 12;

/** Los papeles, con la habilidad con que se tiran y lo que dan. */
export const NIGHT_ROLES = {
    cocinero: { label: 'Quién cocina', skill: 'survival', does: 'Busca qué cenar y lo guisa. Si sale, la cena repone: recuperáis todos los dados de golpe y las heridas curan un día más.' },
    erudito: { label: 'Quién estudia', skill: 'investigation', does: 'Mira lo que lleváis sin identificar y dice qué es, maldición incluida. Si sabe, copia el conjuro de un pergamino.' },
    tasador: { label: 'Quién examina el botín', skill: 'investigation', does: 'Repasa el botín de las peleas ganadas y encuentra lo que se os pasó.' },
};

/** Lo que encuentra quien examina el botín, por pelea ganada (y como mucho, tres peleas). */
export const LOOT_FIND = '2d6';
export const LOOT_FIGHTS_MAX = 3;

/** Cuántas cosas sin identificar se miran en una noche. */
export const STUDY_MAX = 3;

/** Lo que se guarda en la partida: las peleas ganadas que ya se repasaron. */
export const NIGHT_ROLES_KEY = 'papeles_noche';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} member @returns {boolean} */
const able = (member) => Boolean(member) && !member.dead && (Number(member.hp ?? 1) || 0) > 0;

/**
 * Lo guardado, venga como venga.
 *
 * @param {any} raw
 * @returns {{wins: number}}
 */
export function readNightRoles(raw) {
    return { wins: Math.max(0, Math.floor(Number(raw?.wins) || 0)) };
}

/**
 * Quién hace cada papel esta noche: el elegido (la formación, o lo que se marque al acampar) si
 * está y puede; si no, quien mejor lo haga de los que no hacen guardia ni otro papel; y si no queda
 * nadie libre, uno de los que vigilan que aún no haga otra cosa. Uno por persona.
 *
 * @param {Object} input
 * @param {any[]} input.party Los que acampan.
 * @param {(member: any, skill: string) => number} input.modifierOf
 * @param {Record<string, string>} [input.chosen] Por papel, el id elegido.
 * @param {string[]} [input.guards] Los ids de quienes vigilan.
 * @returns {Record<string, string>} Por papel, un id o vacío.
 */
export function suggestNightRoles({ party, modifierOf, chosen = {}, guards = [] }) {
    const list = (Array.isArray(party) ? party : []).filter(able);
    const busy = new Set((Array.isArray(guards) ? guards : []).map(text));
    /** @type {Record<string, string>} */
    const out = {};
    for (const role of Object.keys(NIGHT_ROLES)) {
        const id = text(chosen?.[role]);
        if (id && list.some(m => text(m.id) === id)) {
            out[role] = id;
            busy.add(id);
        }
    }
    const watching = new Set((Array.isArray(guards) ? guards : []).map(text));
    for (const [role, spec] of Object.entries(NIGHT_ROLES)) {
        if (out[role] !== undefined) continue;
        const rank = (/** @type {any[]} */ pool) => pool
            .map(m => ({ m, mod: Number(modifierOf(m, spec.skill)) || 0 }))
            .sort((a, b) => b.mod - a.mod || text(a.m.name).localeCompare(text(b.m.name)))[0];
        // Primero quien no vigila; si no queda nadie, uno que vigila y aún no hace nada más (vigilar
        // y cocinar caben en la misma noche: 5e deja dos horas de cosas ligeras al descansar).
        const best = rank(list.filter(m => !busy.has(text(m.id))))
            ?? rank(list.filter(m => watching.has(text(m.id)) && !Object.values(out).includes(text(m.id))));
        out[role] = best ? text(best.m.id) : '';
        if (best) busy.add(text(best.m.id));
    }
    return out;
}

/**
 * La cena de quien cocina.
 *
 * @param {Object} input
 * @param {string} input.cook Su nombre (vacío: nadie cocina).
 * @param {boolean} input.fire Sin fuego no hay guiso.
 * @param {boolean} input.success La tirada de Supervivencia.
 * @returns {{caught: boolean, hearty: boolean, said: string}} `hearty`: la cena repone.
 */
export function cookDinner({ cook, fire, success }) {
    if (!text(cook)) return { caught: false, hearty: false, said: '' };
    if (!fire) return { caught: false, hearty: false, said: 'Sin fuego no hay guiso. Pan duro y a dormir.' };
    if (!success) return { caught: false, hearty: false, said: 'No he encontrado nada que echar a la olla. Cena fría, y poca.' };
    return { caught: true, hearty: true, said: 'Guiso caliente para todos. Comed bien, que mañana se nota.' };
}

/**
 * Lo que saca quien estudia: qué es cada cosa sin identificar (hasta `STUDY_MAX`) y, aparte, si
 * puede copiar un pergamino.
 *
 * @param {Object} input
 * @param {string} input.scholar
 * @param {number} input.unknown Cuántas cosas sin identificar lleváis.
 * @param {boolean} input.success La tirada de Investigación.
 * @param {string} [input.scroll] El pergamino que puede aprender (vacío: ninguno).
 * @param {string} [input.spell] El conjuro de ese pergamino.
 * @returns {{identify: number, learn: boolean, said: string}}
 */
export function studyNight({ scholar, unknown, success, scroll = '', spell = '' }) {
    if (!text(scholar)) return { identify: 0, learn: false, said: '' };
    const count = success ? Math.min(STUDY_MAX, Math.max(0, Math.floor(Number(unknown) || 0))) : 0;
    const learn = Boolean(text(scroll) && text(spell));
    /** @type {string[]} */
    const said = [];
    if (Number(unknown) > 0) {
        said.push(count > 0
            ? `Ya sé qué es ${count === 1 ? 'lo que llevábamos sin mirar' : `${count === 2 ? 'dos' : 'tres'} de las cosas que llevábamos sin mirar`}.`
            : 'He mirado lo que llevamos sin identificar y no saco nada en claro. Otra noche.');
    }
    if (learn) said.push(`Y he copiado ${text(spell)} del pergamino. Ya me lo sé.`);
    if (said.length === 0) said.push('No hay nada que estudiar esta noche. He repasado mis notas.');
    return { identify: count, learn, said: said.join(' ') };
}

/**
 * Lo que encuentra quien examina el botín.
 *
 * @param {Object} input
 * @param {string} input.appraiser
 * @param {number} input.wins Peleas ganadas en toda la partida.
 * @param {any} input.state Lo guardado (`readNightRoles`).
 * @param {boolean} input.success La tirada de Investigación.
 * @param {(formula: string) => number} input.roll
 * @returns {{fights: number, gold: number, said: string, state: {wins: number}}}
 */
export function appraiseLoot({ appraiser, wins, state, success, roll }) {
    const seen = readNightRoles(state);
    const now = Math.max(0, Math.floor(Number(wins) || 0));
    const fights = Math.min(LOOT_FIGHTS_MAX, Math.max(0, now - seen.wins));
    if (!text(appraiser) || fights === 0) {
        return { fights: 0, gold: 0, said: text(appraiser) ? 'No hay botín nuevo que repasar.' : '', state: seen };
    }
    const next = { wins: now };
    if (!success) return { fights, gold: 0, said: 'He repasado lo de las peleas y no se nos pasó nada.', state: next };
    let gold = 0;
    for (let i = 0; i < fights; i++) gold += Math.max(0, Math.floor(Number(roll(LOOT_FIND)) || 0));
    return {
        fights, gold,
        said: gold > 0 ? `Mirad: ${gold} de oro cosidas en un forro. Se nos habían pasado.` : 'He repasado lo de las peleas y no se nos pasó nada.',
        state: next,
    };
}
