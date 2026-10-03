/**
 * E2.4 de wiki/ROADMAP_ENTRETENIDO.md: seguir o volver.
 *
 * El dilema de *Darkest Dungeon*, con las reglas de 5e: curarse y descansar cuesta algo de
 * verdad. El descanso corto se lleva una hora (y la antorcha que ardía); el largo, dentro de la
 * mazmorra, pide raciones y arriesga una emboscada (E2.3); los kits de curandero se acaban. Así
 * que, tras cada sala ganada con algo más por delante, uno de los tuyos lo dice claro: cómo
 * estáis, lo que queda, y la pregunta. **Seguir** tal como estáis, **dormir ahí dentro** (raciones
 * y el riesgo de E2.3) o **volver** a un sitio seguro a dormir y perder el día.
 *
 * Lo dice alguien del grupo (D-J60), no un menú: quien cura en la formación (J7.4), o el más
 * tocado.
 *
 * Puro: decide si se pregunta y con qué palabras. Quien llama pregunta, saca al grupo y descansa.
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * «a la posada», «al gremio»: la preposición con el sitio.
 *
 * @param {string} where
 * @returns {string}
 */
export function toPlace(where) {
    const said = text(where);
    return /^el /i.test(said) ? `al ${said.slice(3)}` : `a ${said}`;
}

/** @param {any} value @returns {number} */
const num = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * @typedef {Object} PartyCondition
 * @property {{name: string, hp: number, maxHp: number, id: string}|null} worst El más tocado de los que siguen en pie.
 * @property {string[]} down Los que están a 0 PG.
 * @property {number} share La vida del grupo, de 0 a 1.
 * @property {boolean} hurt Si alguien no está entero.
 */

/**
 * Cómo está el grupo.
 *
 * @param {any[]} members
 * @returns {PartyCondition}
 */
export function partyCondition(members) {
    const list = (Array.isArray(members) ? members : []).filter(m => m && !m.dead && !m.summon && !m.boardWard);
    let now = 0;
    let max = 0;
    /** @type {PartyCondition['worst']} */
    let worst = null;
    /** @type {string[]} */
    const down = [];
    for (const m of list) {
        const hp = Math.max(0, num(m.hp));
        const top = Math.max(1, num(m.maxHp) || hp || 1);
        now += Math.min(hp, top);
        max += top;
        if (hp <= 0) {
            down.push(text(m.name));
            continue;
        }
        if (!worst || hp / top < worst.hp / worst.maxHp) worst = { name: text(m.name), hp, maxHp: top, id: text(m.id) };
    }
    return { worst, down, share: max > 0 ? now / max : 1, hurt: max > 0 && now < max };
}

/**
 * Si toca preguntar: en una mazmorra, con algo más por delante, y con alguien tocado.
 *
 * @param {{dungeon: boolean, moreAhead: boolean, condition: PartyCondition}} input
 * @returns {boolean}
 */
export function shouldAskPressOn({ dungeon, moreAhead, condition }) {
    return Boolean(dungeon) && Boolean(moreAhead) && Boolean(condition?.hurt);
}

/**
 * Quién lo pregunta: uno de los tuyos que no seas tú. Quien cura en la formación, si va; si no, el
 * más tocado; si no, el primero.
 *
 * @param {any[]} members
 * @param {{heroId?: string, healerId?: string}} [input]
 * @returns {any|null}
 */
export function pickAsker(members, { heroId = '', healerId = '' } = {}) {
    const list = (Array.isArray(members) ? members : [])
        .filter(m => m && !m.dead && num(m.hp) > 0 && !m.summon && !m.boardWard && text(m.id) !== text(heroId));
    if (list.length === 0) return null;
    const healer = text(healerId) ? list.find(m => text(m.id) === text(healerId)) : null;
    if (healer) return healer;
    return [...list].sort((a, b) => num(a.hp) / Math.max(1, num(a.maxHp)) - num(b.hp) / Math.max(1, num(b.maxHp)))[0];
}

/**
 * @typedef {Object} Supplies Lo que queda en la mochila del grupo.
 * @property {number} torches
 * @property {number} rations
 * @property {number} kitUses
 * @property {number} mouths Cuántos comen (para dormir aquí hace falta una ración por cabeza).
 * @property {boolean} [needsLight] Si aquí hace falta luz (está oscuro).
 * @property {boolean} [lantern] Si alguien lleva farol (no hacen falta antorchas).
 */

/**
 * La pregunta, dicha por quien pregunta, y la línea de cómo vais (fuera de la caja).
 *
 * @param {Object} input
 * @param {any} input.asker
 * @param {PartyCondition} input.condition
 * @param {Supplies} input.supplies
 * @param {string} input.destination A dónde se vuelve («la posada», «el gremio»).
 * @param {boolean} [input.campHere] Si se ofrece dormir aquí dentro (E2.3: raciones y riesgo).
 * @returns {{question: string, notes: string[], yes: string, no: string, other: string}}
 */
export function pressOnQuestion({ asker, condition, supplies, destination, campHere = false }) {
    const self = text(asker?.id) && text(asker?.id) === text(condition?.worst?.id);
    /** @type {string[]} */
    const said = [];
    if (condition?.down?.length > 0) {
        said.push(`${condition.down.join(' y ')} ${condition.down.length > 1 ? 'siguen' : 'sigue'} en el suelo.`);
    }
    const worst = condition?.worst;
    if (worst && worst.hp / worst.maxHp <= 0.5) {
        said.push(self ? `Yo estoy en ${worst.hp} de ${worst.maxHp}.` : `${worst.name} está en ${worst.hp} de ${worst.maxHp}.`);
    } else if (condition?.hurt) {
        said.push('Vamos tocados, pero enteros.');
    }
    /** @type {string[]} */
    const short = [];
    if (supplies?.needsLight && !supplies.lantern && num(supplies.torches) === 0) short.push('no quedan antorchas');
    if (num(supplies?.kitUses) === 0) short.push('no queda kit de curandero');
    if (num(supplies?.rations) < num(supplies?.mouths)) short.push('las raciones no dan para dormir aquí');
    if (short.length > 0) said.push(`Y ${short.join(', ').replace(/, ([^,]*)$/, ' y $1')}.`);
    const where = text(destination) || 'un sitio seguro';
    said.push(campHere
        ? `¿Seguimos así, dormimos aquí dentro o volvemos ${toPlace(where)}? Dormir aquí gasta una ración cada uno y algo puede encontrarnos; volver nos cuesta el día.`
        : `¿Seguimos así o volvemos ${toPlace(where)}? Volver nos cuesta el día.`);
    const notes = [[
        `Vida: ${Math.round(num(condition?.share) * 100)} %`,
        supplies?.needsLight && !supplies?.lantern ? `antorchas: ${num(supplies?.torches)}` : '',
        `raciones: ${num(supplies?.rations)}`,
        `kit de curandero: ${num(supplies?.kitUses)} ${num(supplies?.kitUses) === 1 ? 'uso' : 'usos'}`,
    ].filter(Boolean).join(' · ')];
    return { question: said.join(' '), notes, yes: 'Seguimos', no: `Volvemos ${toPlace(where)}`, other: campHere ? 'Dormimos aquí' : '' };
}

/**
 * A dónde se vuelve: al gremio si el sitio es suyo; a la posada si hay pueblo; si no, afuera.
 *
 * @param {{guild?: boolean, settled?: boolean}} input
 * @returns {{where: string, under: 'techo'|'cielo'}}
 */
export function safeDestination({ guild = false, settled = false } = {}) {
    if (guild) return { where: 'el gremio', under: 'techo' };
    if (settled) return { where: 'la posada', under: 'techo' };
    return { where: 'la salida, a dormir fuera', under: 'cielo' };
}
