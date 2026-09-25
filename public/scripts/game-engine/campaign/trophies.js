/**
 * Lo que se saca de los bichos, y lo que el herrero hace con ello (ideas 121 y 120).
 *
 * Cazar no daba nada que no diera cualquier otra pelea. Ahora las bestias dejan
 * **materiales** —la piel del lobo, la garra del oso, la seda de la araña— y en la
 * herrería se convierten en algo:
 *
 * - **Una capa de pieles** (dos pieles): abriga. Con ella se duerme en la nieve sin fuego.
 * - **Mejorar el arma** (algo duro —un colmillo, una garra, una escama— y oro): el arma que
 *   empuñas pasa a +1, al ataque y al daño. Una vez: lo que sigue ya no es cosa de herrero.
 *
 * Puro: dice qué cae, qué se puede hacer y qué queda. Quien llama da, cobra y guarda.
 */

/** Lo que deja cada bestia, por su nombre. La primera que encaja manda. */
export const TROPHIES = [
    { match: /lobo|huargo/i, items: ['Piel de lobo', 'Colmillo de lobo'] },
    { match: /\boso\b|osa\b/i, items: ['Piel de oso', 'Garra de oso'] },
    { match: /jabal[ií]/i, items: ['Colmillo de jabalí', 'Piel de jabalí'] },
    { match: /ara[ñn]a/i, items: ['Seda de araña'] },
    { match: /serpiente|v[ií]bora|sierpe/i, items: ['Piel de serpiente', 'Colmillo de serpiente'] },
    { match: /drag[oó]n|draco|guiverno|wyrm/i, items: ['Escama de dragón'] },
    { match: /cuervo|buitre|halc[oó]n/i, items: ['Plumas negras'] },
    { match: /ciervo|venado|alce/i, items: ['Piel de ciervo', 'Cuerna'] },
    { match: /troll|trasgo grande|ogro/i, items: ['Garra de troll'] },
];

/** Qué es cada material para el herrero. */
const KIND_OF = [
    { kind: 'piel', match: /^piel\b/i },
    { kind: 'duro', match: /colmillo|garra|escama|cuerna|cuerno/i },
    { kind: 'fibra', match: /seda|pluma/i },
];

/** La probabilidad de sacar algo de cada bestia. Cambiable: el recorrido del navegador la sube a 1. */
export const TROPHY = { chance: 0.6 };

/** Lo que hace el herrero con lo que traéis. */
export const RECIPES = {
    capa: { label: 'Hacer una capa de pieles', needs: { piel: 2 }, gold: 10, note: 'Abriga: con ella se duerme en la nieve aunque no haya fuego.' },
    mejora: { label: 'Mejorar el arma (+1)', needs: { duro: 1 }, gold: 80, note: '+1 al ataque y al daño del arma que empuña.' },
};

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Qué clase de material es algo, o vacío si no lo es.
 *
 * @param {string} name
 * @returns {string}
 */
export function materialKind(name) {
    return KIND_OF.find(k => k.match.test(text(name)))?.kind ?? '';
}

/**
 * Lo que deja un bicho al caer: nada si no es una bestia que dé algo.
 *
 * @param {any} enemy
 * @param {() => number} random
 * @returns {string[]}
 */
export function trophiesOf(enemy, random) {
    const found = TROPHIES.find(t => t.match.test(text(enemy?.name)));
    if (!found || !(random() < TROPHY.chance)) return [];
    return [found.items[Math.floor(random() * found.items.length) % found.items.length]];
}

/**
 * El material como objeto de la mochila.
 *
 * @param {string} name
 * @returns {any}
 */
export function trophyItem(name) {
    const kind = materialKind(name);
    return {
        name: text(name),
        type: 'gear',
        category: 'gear',
        subcategory: 'material',
        weight: kind === 'piel' ? 2 : 0.5,
        value: kind === 'duro' ? 8 : 5,
        description: kind === 'piel' ? 'Una piel curtida a medias. En la herrería hacen una capa con dos.'
            : kind === 'duro' ? 'Duro como el hierro. En la herrería sirve para mejorar un arma.'
                : 'Material de caza. Algo se podrá hacer con ello.',
    };
}

/**
 * Los materiales que lleva el grupo, por clase.
 *
 * @param {any[]} party
 * @returns {Record<string, Array<{memberId: string, itemId: string, name: string}>>}
 */
export function materialsOf(party) {
    /** @type {Record<string, Array<{memberId: string, itemId: string, name: string}>>} */
    const out = { piel: [], duro: [], fibra: [] };
    for (const member of Array.isArray(party) ? party : []) {
        if (member?.dead) continue;
        for (const item of Array.isArray(member?.items) ? member.items : []) {
            const kind = materialKind(item?.name);
            if (kind) out[kind].push({ memberId: String(member.id), itemId: text(item.id), name: text(item.name) });
        }
    }
    return out;
}

/**
 * Si se puede hacer una receta, y con qué.
 *
 * @param {Object} input
 * @param {string} input.recipe Una de `RECIPES`.
 * @param {any[]} input.party
 * @param {number} input.purse
 * @param {any} [input.weapon] Para mejorar: el arma que se mejora.
 * @returns {{ok: boolean, reason: string, use: Array<{memberId: string, itemId: string, name: string}>, gold: number}}
 */
export function canCraft({ recipe, party, purse, weapon = null }) {
    const spec = RECIPES[/** @type {keyof typeof RECIPES} */ (text(recipe))];
    if (!spec) return { ok: false, reason: 'El herrero no sabe hacer eso.', use: [], gold: 0 };
    if (text(recipe) === 'mejora') {
        if (!weapon) return { ok: false, reason: 'No empuña ningún arma.', use: [], gold: spec.gold };
        if ((Number(weapon.magicalBonus) || 0) >= 1) return { ok: false, reason: `${text(weapon.name)} ya está mejorada: más no sabe.`, use: [], gold: spec.gold };
    }
    const have = materialsOf(party);
    /** @type {Array<{memberId: string, itemId: string, name: string}>} */
    const use = [];
    for (const [kind, count] of Object.entries(spec.needs)) {
        const pool = have[kind] ?? [];
        if (pool.length < count) {
            const word = kind === 'piel' ? 'piel(es)' : kind === 'duro' ? 'colmillo, garra o escama' : 'material';
            return { ok: false, reason: `Faltan materiales: ${count} de ${word}.`, use: [], gold: spec.gold };
        }
        use.push(...pool.slice(0, count));
    }
    if ((Number(purse) || 0) < spec.gold) return { ok: false, reason: `No llega el oro: cuesta ${spec.gold}.`, use: [], gold: spec.gold };
    return { ok: true, reason: '', use, gold: spec.gold };
}

/**
 * La capa, como objeto.
 *
 * @returns {any}
 */
export function cloakItem() {
    return {
        name: 'Capa de pieles',
        type: 'gear',
        category: 'gear',
        subcategory: 'clothing',
        weight: 3,
        value: 25,
        description: RECIPES.capa.note,
    };
}

/**
 * El arma mejorada.
 *
 * @param {any} weapon
 * @returns {{magicalBonus: number, name: string}}
 */
export function upgradedWeapon(weapon) {
    const name = text(weapon?.name).replace(/\s*\+\d+$/, '');
    return { magicalBonus: 1, name: `${name} +1` };
}
