/**
 * Juegos de equipo guardados: cambiar de todo lo que se lleva en un clic (idea 62).
 *
 * Quien va a colarse no lleva la armadura de placas, y quien va a pelear no lleva la capa
 * de viaje. Cambiarlo pieza a pieza cada vez es lo que hace que nadie lo cambie. Ahora se
 * guarda lo que se lleva puesto con un nombre («Sigilo», «Combate»), y se vuelve a ello de
 * una vez.
 *
 * Lo maldito que no se puede quitar se queda donde está, se ponga el juego que se ponga.
 *
 * Puro: guarda y devuelve lo que hay que ponerse. Quien llama equipa.
 */

/** Cuántos juegos se guardan por cabeza. */
export const MAX_SETS = 3;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * @typedef {{name: string, equipped: Record<string, string>}} EquipmentSet
 */

/**
 * Los juegos de alguien.
 *
 * @param {any} member
 * @returns {EquipmentSet[]}
 */
export function readSets(member) {
    return (Array.isArray(member?.equipmentSets) ? member.equipmentSets : [])
        .filter((/** @type {any} */ s) => s && text(s.name))
        .map((/** @type {any} */ s) => ({
            name: text(s.name),
            equipped: Object.fromEntries(Object.entries(s.equipped && typeof s.equipped === 'object' ? s.equipped : {})
                .filter(([slot, id]) => text(slot) && text(id)).map(([slot, id]) => [text(slot), text(id)])),
        }))
        .slice(0, MAX_SETS);
}

/**
 * Guardar lo que lleva puesto con un nombre. Uno con el mismo nombre se sustituye; si ya
 * hay tres, se va el más viejo.
 *
 * @param {any} member
 * @param {string} name
 * @returns {{ok: boolean, sets: EquipmentSet[], line: string}}
 */
export function saveSet(member, name) {
    const label = text(name);
    const sets = readSets(member);
    if (!label) return { ok: false, sets, line: 'Falta el nombre.' };
    const equipped = Object.fromEntries(Object.entries(member?.equippedItems && typeof member.equippedItems === 'object' ? member.equippedItems : {})
        .filter(([, id]) => text(id)).map(([slot, id]) => [slot, text(id)]));
    if (Object.keys(equipped).length === 0) return { ok: false, sets, line: 'No lleva nada puesto que guardar.' };
    const rest = sets.filter(s => s.name.toLowerCase() !== label.toLowerCase());
    const next = [...rest, { name: label, equipped }].slice(-MAX_SETS);
    return { ok: true, sets: next, line: `${text(member?.name) || 'Alguien'} guarda «${label}»: ${Object.keys(equipped).length} pieza(s).` };
}

/**
 * Ponerse un juego guardado.
 *
 * @param {any} member
 * @param {string} name
 * @param {(slot: string) => boolean} [locked] Las ranuras con algo que no se puede quitar.
 * @returns {{ok: boolean, equippedItems: Record<string, string>, missing: string[], line: string}}
 */
export function applySet(member, name, locked = () => false) {
    const set = readSets(member).find(s => s.name.toLowerCase() === text(name).toLowerCase());
    const current = member?.equippedItems && typeof member.equippedItems === 'object' ? member.equippedItems : {};
    if (!set) return { ok: false, equippedItems: { ...current }, missing: [], line: 'No hay un juego con ese nombre.' };
    const owned = new Set((Array.isArray(member?.items) ? member.items : []).map((/** @type {any} */ i) => text(i?.id)));
    /** @type {Record<string, string>} */
    const next = {};
    /** @type {string[]} */
    const missing = [];
    for (const [slot, id] of Object.entries(current)) {
        if (text(id) && locked(slot)) next[slot] = text(id);
    }
    for (const [slot, id] of Object.entries(set.equipped)) {
        if (next[slot]) continue;
        if (owned.has(id)) next[slot] = id;
        else missing.push(slot);
    }
    const said = missing.length > 0 ? ` Falta lo de: ${missing.join(', ')}.` : '';
    return { ok: true, equippedItems: next, missing, line: `${text(member?.name) || 'Alguien'} se pone «${set.name}».${said}` };
}
