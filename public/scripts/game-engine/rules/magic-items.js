/**
 * Pergaminos y varitas: la magia del grimorio en un objeto (R4 del roadmap de profundidad).
 *
 * - **Un pergamino** se lee una vez y se gasta. Lo lee cualquiera; quien estudia (el mago y
 *   el erudito) puede, en vez de leerlo, **aprender** el conjuro, y el pergamino se gasta.
 * - **Una varita** tiene cargas: al quedarse sin ninguna, se apaga para siempre.
 *
 * Ni uno ni otro gastan las cargas del círculo de quien los usa ni sus componentes: el
 * objeto ya los lleva dentro. Y los dos lanzan solo conjuros del grimorio: un pergamino de
 * algo que no existe no existe.
 *
 * Puro: qué objetos son mágicos, qué se puede hacer con ellos y cómo quedan.
 *
 * Ver wiki/ROADMAP_PROFUNDIDAD.md, R4.
 */

import { spellById, classKey } from './grimoire.js';

/**
 * Los objetos que llevan un conjuro. `charges` solo en las varitas.
 *
 * @type {Record<string, {spell: string, kind: 'scroll'|'wand', charges?: number}>}
 */
export const MAGIC_ITEMS = {
    'Pergamino de Bola de fuego': { spell: 'mag-bola-fuego', kind: 'scroll' },
    'Pergamino de Curar heridas': { spell: 'hab-curar', kind: 'scroll' },
    'Pergamino de Sueño pesado': { spell: 'hab-sueno', kind: 'scroll' },
    'Pergamino de Relámpago': { spell: 'mag-relampago', kind: 'scroll' },
    'Pergamino de Paso sin rastro': { spell: 'mag-paso-sin-rastro', kind: 'scroll' },
    'Varita de destellos': { spell: 'hab-luz-severa', kind: 'wand', charges: 3 },
    'Varita de escarcha': { spell: 'mag-cono-escarcha', kind: 'wand', charges: 3 },
};

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Los objetos mágicos que lleva alguien, con lo que les queda.
 *
 * @param {any} member
 * @returns {Array<{itemId: string, name: string, spell: string, kind: 'scroll'|'wand', left: number}>}
 */
export function magicItemsOf(member) {
    return (Array.isArray(member?.items) ? member.items : []).flatMap((/** @type {any} */ item) => {
        const spec = MAGIC_ITEMS[text(item?.name)];
        if (!spec || !spellById(spec.spell)) return [];
        const left = spec.kind === 'wand'
            ? Math.max(0, Math.floor(Number(item?.charges ?? spec.charges) || 0))
            : 1;
        return left > 0 ? [{ itemId: text(item?.id), name: text(item?.name), spell: spec.spell, kind: spec.kind, left }] : [];
    });
}

/**
 * Los botones de usar lo mágico, ya juzgados, con la forma de las maniobras.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {boolean} input.hasAction
 * @param {Array<{id: string, name: string, distanceFeet: number}>} input.enemies
 * @param {Array<{id: string, name: string, distanceFeet: number}>} input.allies
 * @param {(id: string) => any} input.abilityOf El conjuro como habilidad del catálogo.
 * @returns {Array<{id: string, label: string, icon: string, detail: string, enabled: boolean, needsTarget: boolean, targets: Array<{id: string, name: string}>}>}
 */
export function judgeMagicItems({ member, hasAction, enemies, allies, abilityOf }) {
    return magicItemsOf(member).map(item => {
        const ability = abilityOf(item.spell);
        const range = Math.max(5, Number(ability?.rangeFeet) || 5);
        const side = ability?.target === 'ally' ? allies : ability?.target === 'enemy' ? enemies : [];
        const targets = (side || []).filter(t => Number(t.distanceFeet) <= range).map(t => ({ id: String(t.id), name: String(t.name) }));
        const self = ability?.target === 'self';
        const reason = !hasAction ? 'La acción de este turno ya está gastada.'
            : ability?.combat === false ? 'Esto no se usa peleando.'
                : !self && targets.length === 0 ? `No hay nadie a menos de ${range} pies.` : '';
        return {
            id: `leer:${item.itemId}`,
            label: item.kind === 'wand' ? `${item.name} (${item.left})` : `Leer ${item.name}`,
            icon: item.kind === 'wand' ? 'fa-wand-magic-sparkles' : 'fa-scroll',
            detail: reason || `${ability?.name ?? item.spell}: ${ability?.description ?? ''}`.trim(),
            enabled: !reason,
            needsTarget: !self,
            targets,
        };
    });
}

/**
 * Cómo queda el objeto después de usarlo: el pergamino se gasta; la varita pierde una carga,
 * y sin cargas se apaga.
 *
 * @param {any} item
 * @returns {{remove: boolean, charges: number, line: string}}
 */
export function afterUse(item) {
    const spec = MAGIC_ITEMS[text(item?.name)];
    if (!spec || spec.kind === 'scroll') return { remove: true, charges: 0, line: `${text(item?.name)} se deshace en ceniza.` };
    const charges = Math.max(0, Math.floor(Number(item?.charges ?? spec.charges) || 0) - 1);
    return charges > 0
        ? { remove: false, charges, line: `A ${text(item?.name)} le quedan ${charges}.` }
        : { remove: true, charges: 0, line: `${text(item?.name)} se apaga: ya no tiene nada dentro.` };
}

/**
 * Si alguien puede aprender el conjuro de un pergamino en vez de leerlo: quien estudia (el
 * mago y el erudito), y si no lo sabe ya.
 *
 * @param {any} member
 * @param {any} item
 * @returns {{ok: boolean, reason: string, spell: string}}
 */
export function canLearnScroll(member, item) {
    const spec = MAGIC_ITEMS[text(item?.name)];
    if (!spec || spec.kind !== 'scroll') return { ok: false, reason: 'Eso no es un pergamino.', spell: '' };
    const studies = classKey(String(member?.class ?? member?.charClass ?? '')) === 'mago'
        || /erudit/.test(String(member?.class ?? member?.charClass ?? '').toLowerCase());
    if (!studies) return { ok: false, reason: 'Para aprender de un pergamino hay que haber estudiado: el mago o el erudito.', spell: spec.spell };
    const known = (Array.isArray(member?.abilities) ? member.abilities : []).map(String);
    if (known.includes(spec.spell)) return { ok: false, reason: 'Ese conjuro ya lo sabe.', spell: spec.spell };
    return { ok: true, reason: '', spell: spec.spell };
}
