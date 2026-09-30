/**
 * El gremio crece (J3.6 de wiki/ROADMAP_SIN_CONEXION.md): los edificios abren cosas.
 *
 * Hasta ahora un edificio del gremio (`guild.js`) abarataba algo de la cuenta de la semana, y
 * la biblioteca traía un encargo más al tablón. Ahora cada nivel **abre** algo que se usa en la
 * sala del gremio:
 *
 * - **La forja**: mejorar las armas en casa, a +1, +2 y +3 (lo que suma `magicalBonus` al
 *   ataque y al daño, `equipment.js`), y desde el nivel 2, reforzar una armadura o un escudo
 *   (+1 a la clase de armadura, una vez por pieza).
 * - **La biblioteca**: enseña conjuros. Quien los apunta en un libro (el mago, el erudito) copia
 *   uno nuevo; quien se los sabe de memoria (el bardo, el explorador) cambia uno por otro. Hasta
 *   el nivel de conjuro de la biblioteca, y nunca más alto de lo que ya lanza.
 * - **El establo**: mulas (nivel 1) y luego caballos (nivel 2) para todo el grupo. El camino a
 *   cada campaña se acorta (`mounts.js`: la mula ahorra un día de cada cuatro; el caballo, uno
 *   de cada dos) y dentro de la campaña se llega montado.
 * - **Los dormitorios**: con más camas se quedan más espadas de alquiler en el gremio: una más
 *   por nivel, para contratar como las de siempre.
 * - **La cocina y la enfermería**: lo de antes, abaratar la comida y las curas de la semana.
 *
 * Se paga primero del arca del gremio y lo que falte, de las bolsas (`guild-chest.js`).
 *
 * Puro: dice qué hay, qué abre cada nivel, qué ofrece cada edificio y cómo queda una ficha
 * después de usarlo. Quien llama cobra y guarda.
 */

import { BUILDINGS, readGuild, upgradeCost } from './guild.js';
import { payPlan } from './guild-chest.js';
import { HIRELINGS } from './guests.js';
import { journeyDays, journeySpan } from './hub.js';
import { mountedDays, MOUNTS } from '../world/mounts.js';
import { casterOf } from '../rules/spell-slots.js';
import { classSpellList, maxSpellLevel } from '../rules/spell-prep.js';

/** El icono de cada edificio (Font Awesome). */
export const BUILDING_ICONS = {
    bunks: 'fa-bed',
    kitchen: 'fa-utensils',
    infirmary: 'fa-kit-medical',
    forge: 'fa-hammer',
    library: 'fa-book',
    stable: 'fa-horse',
};

/** En qué orden se enseñan: lo que abre cosas, primero. */
export const BUILDING_ORDER = ['forge', 'library', 'stable', 'bunks', 'kitchen', 'infirmary'];

/**
 * J3.6: las espadas de alquiler que llegan al gremio cuando hay camas para ellas, una por nivel
 * de los dormitorios. Se contratan como Gerd, Nella y Osric (`guests.js`).
 */
export const GUILD_RECRUITS = [
    {
        name: 'Iria Salitre', className: 'pícara', strength: 10, dexterity: 16, gender: 'Mujer', bunks: 1,
        pitch: 'Remendaba redes en el muelle y cortaba bolsas en la plaza. Ahora cobra por hacerlo para ti.',
    },
    {
        name: 'Bastián Tresmareas', className: 'bárbaro', strength: 17, dexterity: 12, gender: 'Hombre', bunks: 2,
        pitch: 'Un ballenero grande y callado. Dice que después de un cachalote, nada le asusta.',
    },
    {
        name: 'Wenda la Gris', className: 'guerrera', strength: 15, dexterity: 14, gender: 'Mujer', bunks: 3,
        pitch: 'Sirvió diez años en la guardia del puerto. Pelea en silencio y no pierde la calma.',
    },
];

/** Lo que cuesta mejorar un arma a cada «+», y el nivel de forja que hace falta. */
export const FORGE_WEAPON = [
    { bonus: 1, cost: 150, forge: 1 },
    { bonus: 2, cost: 400, forge: 2 },
    { bonus: 3, cost: 900, forge: 3 },
];

/** Reforzar una armadura o un escudo: una vez por pieza, desde la forja de nivel 2. */
export const FORGE_ARMOR = { bonus: 1, cost: 250, forge: 2 };

/** Lo que cobra la biblioteca por nivel del conjuro: copiarlo a un libro, o cambiar uno sabido. */
export const LIBRARY_PRICES = { copy: 50, swap: 30 };

/** La montura del establo en cada nivel. */
export const STABLE_MOUNTS = ['', 'mula', 'caballo'];

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {number} */
const whole = (value) => Math.max(0, Math.floor(Number(value) || 0));

/** @param {any} guild @param {string} key @returns {number} */
const levelIn = (guild, key) => whole(readGuild(guild).buildings[key]);

/**
 * Lo que abre cada nivel de cada edificio, en una frase por nivel.
 *
 * @param {string} key
 * @returns {string[]}
 */
export function buildingOpens(key) {
    switch (key) {
        case 'forge':
            return [
                'Mejorar un arma a +1: suma al ataque y al daño.',
                'Armas hasta +2, y reforzar una armadura o un escudo: +1 a la clase de armadura.',
                'Armas hasta +3.',
            ];
        case 'library':
            return [
                'Un encargo más en el tablón. Copiar o cambiar conjuros de nivel 1.',
                'Otro encargo más. Conjuros hasta el nivel 2.',
                'Otro encargo más. Conjuros hasta el nivel 3.',
            ];
        case 'stable':
            return [
                `Mulas para todo el grupo: el camino a cada campaña, una cuarta parte más corto, y dentro de ella se va en mula. Sin comprarlas.`,
                'Caballos para todo el grupo: el camino, a la mitad.',
            ];
        case 'bunks':
            return GUILD_RECRUITS.map(recruit => `Una cama más: ${recruit.name} (${recruit.className}) se queda en el gremio y se puede contratar. Y dormir en casa sale más barato.`);
        case 'kitchen':
            return ['La comida de la semana sale más barata.', 'Más barata todavía.', 'Lo más barato que se puede comer.'];
        case 'infirmary':
            return ['Curarse cuesta menos cada día.', 'Menos todavía.', 'Lo menos que puede costar.'];
        default:
            return [];
    }
}

/**
 * @typedef {Object} BuildingRow
 * @property {string} key
 * @property {string} label
 * @property {string} icon
 * @property {number} level
 * @property {number} max
 * @property {string} describe
 * @property {string[]} open Lo que ya abre, nivel a nivel.
 * @property {{level: number, cost: number, opens: string, ok: boolean, why: string, pay: string}|null} next
 */

/**
 * La casa: cada edificio con su nivel, lo que ya abre y lo que abriría el siguiente, con lo que
 * cuesta y cómo se pagaría.
 *
 * @param {Object} input
 * @param {any} input.guild
 * @param {number} input.purse Lo que lleva el grupo entre todos.
 * @param {boolean} [input.fighting]
 * @returns {BuildingRow[]}
 */
export function houseView({ guild, purse, fighting = false }) {
    const read = readGuild(guild);
    return BUILDING_ORDER.filter(key => key in BUILDINGS).map(key => {
        const building = BUILDINGS[/** @type {keyof typeof BUILDINGS} */ (key)];
        const level = whole(read.buildings[key]);
        const opens = buildingOpens(key);
        const up = upgradeCost(read, key);
        const plan = up.maxed ? null : payPlan({ cost: up.cost, guild: read, purse });
        return {
            key,
            label: building.label,
            icon: /** @type {Record<string, string>} */ (BUILDING_ICONS)[key] ?? 'fa-house',
            level,
            max: building.cost.length,
            describe: building.describe,
            open: opens.slice(0, level),
            next: up.maxed || !plan ? null : {
                level: up.nextLevel,
                cost: up.cost,
                opens: opens[up.nextLevel - 1] ?? building.describe,
                ok: plan.ok && !fighting,
                why: fighting ? 'No mientras peleáis.' : plan.ok ? '' : plan.line,
                pay: plan.line,
            },
        };
    });
}

/**
 * Levantar el siguiente nivel de un edificio.
 *
 * @param {Object} input
 * @param {any} input.guild
 * @param {string} input.key
 * @param {number} input.purse
 * @returns {{ok: boolean, reason: string, guild: any, cost: number, fromChest: number, fromPurse: number, line: string, opens: string}}
 */
export function buildInGuild({ guild, key, purse }) {
    const read = readGuild(guild);
    const building = BUILDINGS[/** @type {keyof typeof BUILDINGS} */ (key)];
    const fail = (/** @type {string} */ reason) => ({ ok: false, reason, guild: read, cost: 0, fromChest: 0, fromPurse: 0, line: '', opens: '' });
    if (!building) return fail('Ese edificio no existe.');
    const up = upgradeCost(read, key);
    if (up.maxed) return fail(`${building.label}: ya está al máximo.`);
    const plan = payPlan({ cost: up.cost, guild: read, purse });
    if (!plan.ok) return fail(plan.line);
    const left = whole(read.gold) - plan.fromChest;
    const next = { ...read, buildings: { ...read.buildings, [key]: up.nextLevel } };
    if (left > 0) next.gold = left;
    else delete next.gold;
    const opens = buildingOpens(key)[up.nextLevel - 1] ?? '';
    const line = `${building.label}${building.cost.length > 1 ? ` de nivel ${up.nextLevel}` : ''}, levantado por ${up.cost} de oro. ${opens}`.trim();
    return { ok: true, reason: '', guild: next, cost: up.cost, fromChest: plan.fromChest, fromPurse: plan.fromPurse, line, opens };
}

// ---- La forja ---------------------------------------------------------------------------

/**
 * Si una pieza es un arma: lo dice su tipo, su sitio o su dado de daño.
 *
 * @param {any} item
 * @returns {boolean}
 */
function isWeapon(item) {
    return text(item?.type || item?.category).toLowerCase() === 'weapon' || text(item?.slot) === 'weapon' || Boolean(text(item?.damageDice));
}

/**
 * Si una pieza se puede reforzar: una armadura del cuerpo o un escudo, con su clase de armadura.
 *
 * @param {any} item
 * @returns {boolean}
 */
function isArmor(item) {
    return ['body', 'shield'].includes(text(item?.slot)) && whole(item?.armorClass) > 0;
}

/**
 * @typedef {Object} ForgeOffer
 * @property {string} memberId
 * @property {string} memberName
 * @property {string} itemId
 * @property {string} itemName
 * @property {'weapon'|'armor'} kind
 * @property {string} label Lo que se lee: «Espada larga: de +0 a +1».
 * @property {number} cost
 * @property {boolean} ok
 * @property {string} why Por qué no, si no se puede.
 */

/**
 * Lo que la forja del gremio puede hacer con lo que lleva el grupo.
 *
 * @param {Object} input
 * @param {any} input.guild
 * @param {any[]} input.party
 * @param {number} input.purse
 * @returns {{level: number, offers: ForgeOffer[], empty: string}}
 */
export function forgeOffers({ guild, party, purse }) {
    const level = levelIn(guild, 'forge');
    if (level === 0) return { level, offers: [], empty: 'Sin forja en el gremio no se mejora nada: levántala en «La casa».' };
    /** @type {ForgeOffer[]} */
    const offers = [];
    for (const member of (Array.isArray(party) ? party : []).filter(m => m && !m.dead && text(m.name))) {
        for (const item of Array.isArray(member.items) ? member.items : []) {
            if (!item || !text(item.name) || item.cursed) continue;
            if (isWeapon(item)) {
                const now = Math.min(3, whole(item.magicalBonus));
                const step = FORGE_WEAPON.find(s => s.bonus === now + 1);
                if (!step) continue;
                const plan = payPlan({ cost: step.cost, guild, purse });
                const why = step.forge > level ? `Hace falta la forja de nivel ${step.forge}.` : plan.ok ? '' : plan.line;
                offers.push({
                    memberId: text(member.id), memberName: text(member.name), itemId: text(item.id), itemName: text(item.name),
                    kind: 'weapon', label: `${text(item.name)}: de +${now} a +${step.bonus}`, cost: step.cost, ok: !why, why,
                });
            } else if (isArmor(item) && !item.reinforced) {
                const plan = payPlan({ cost: FORGE_ARMOR.cost, guild, purse });
                const why = FORGE_ARMOR.forge > level ? `Hace falta la forja de nivel ${FORGE_ARMOR.forge}.` : plan.ok ? '' : plan.line;
                offers.push({
                    memberId: text(member.id), memberName: text(member.name), itemId: text(item.id), itemName: text(item.name),
                    kind: 'armor', label: `${text(item.name)}: reforzarla, +${FORGE_ARMOR.bonus} a la clase de armadura`, cost: FORGE_ARMOR.cost, ok: !why, why,
                });
            }
        }
    }
    return { level, offers, empty: offers.length === 0 ? 'Nadie lleva nada que la forja pueda mejorar.' : '' };
}

/**
 * Mejorar una pieza en la forja: lo que queda en la ficha y lo que se cuenta.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {string} input.itemId
 * @param {any} input.guild
 * @param {number} input.purse
 * @returns {{ok: boolean, reason: string, items: any[], cost: number, line: string}}
 */
export function forgeItem({ member, itemId, guild, purse }) {
    const items = Array.isArray(member?.items) ? member.items : [];
    const offer = forgeOffers({ guild, party: [member], purse }).offers.find(o => o.itemId === text(itemId));
    if (!offer) return { ok: false, reason: 'La forja no puede hacer nada con eso.', items, cost: 0, line: '' };
    if (!offer.ok) return { ok: false, reason: offer.why, items, cost: 0, line: '' };
    const next = items.map(item => {
        if (text(item?.id) !== text(itemId)) return item;
        if (offer.kind === 'weapon') return { ...item, magicalBonus: whole(item.magicalBonus) + 1 };
        return { ...item, armorClass: whole(item.armorClass) + FORGE_ARMOR.bonus, reinforced: true };
    });
    const line = offer.kind === 'weapon'
        ? `En la forja del gremio, ${text(offer.memberName)} deja ${text(offer.itemName)} en +${whole(items.find(i => text(i?.id) === text(itemId))?.magicalBonus) + 1}. ${offer.cost} de oro.`
        : `En la forja del gremio refuerzan ${text(offer.itemName)} de ${text(offer.memberName)}: +${FORGE_ARMOR.bonus} a la clase de armadura. ${offer.cost} de oro.`;
    return { ok: true, reason: '', items: next, cost: offer.cost, line };
}

// ---- La biblioteca ------------------------------------------------------------------------

/** @param {any} value @returns {string[]} */
const idsOf = (value) => (Array.isArray(value) ? value : []).map(v => text(typeof v === 'string' ? v : v?.id)).filter(Boolean);

/**
 * Si alguien ya tiene un conjuro en una lista (por su id o por un alias del grimorio).
 *
 * @param {string[]} list
 * @param {any} spell
 * @returns {boolean}
 */
function hasSpell(list, spell) {
    return list.includes(text(spell?.id)) || (Array.isArray(spell?.aliases) ? spell.aliases : []).some((/** @type {any} */ a) => list.includes(text(a)));
}

/**
 * @typedef {Object} LibraryReader
 * @property {string} memberId
 * @property {string} name
 * @property {'copy'|'swap'|'none'} mode Copiar a un libro, cambiar uno sabido o nada.
 * @property {string} note Lo que puede hacer aquí, o por qué no.
 * @property {Array<{id: string, name: string, level: number, cost: number}>} options Lo que puede aprender.
 * @property {Array<{id: string, name: string, level: number}>} known Lo que puede olvidar (al cambiar).
 */

/**
 * Lo que la biblioteca del gremio puede enseñar a cada uno del grupo.
 *
 * @param {Object} input
 * @param {any} input.guild
 * @param {any[]} input.party
 * @param {(member: any) => any} input.classRowOf La fila de la clase de alguien (`clases.json`).
 * @param {any[]} input.catalogue Las filas de `conjuros.json`.
 * @returns {{level: number, readers: LibraryReader[], empty: string}}
 */
export function libraryOffers({ guild, party, classRowOf, catalogue }) {
    const level = levelIn(guild, 'library');
    if (level === 0) return { level, readers: [], empty: 'Sin biblioteca en el gremio no hay libros de donde aprender: levántala en «La casa».' };
    /** @type {LibraryReader[]} */
    const readers = [];
    for (const member of (Array.isArray(party) ? party : []).filter(m => m && !m.dead && text(m.name) && !m.guest)) {
        const classRow = classRowOf(member);
        const casting = casterOf(classRow);
        if (!casting) continue;
        const cap = Math.min(level, maxSpellLevel(classRow, member.level));
        const base = { memberId: text(member.id), name: text(member.name), options: [], known: [] };
        if (casting.mode === 'prepared') {
            readers.push({ ...base, mode: 'none', note: 'Prepara cada día de la lista entera de su clase: aquí no tiene nada que aprender.' });
            continue;
        }
        if (cap < 1) {
            readers.push({ ...base, mode: 'none', note: 'Todavía no lanza conjuros de nivel 1: vuelve cuando suba.' });
            continue;
        }
        const list = classSpellList(classRow, catalogue).filter(spell => spell.level >= 1 && spell.level <= cap);
        if (casting.mode === 'spellbook') {
            const book = idsOf(member.spellbook);
            const options = list.filter(spell => !hasSpell(book, spell))
                .map(spell => ({ id: spell.id, name: spell.name, level: spell.level, cost: LIBRARY_PRICES.copy * spell.level }));
            readers.push({
                ...base, mode: 'copy', options,
                note: options.length > 0 ? `Copia un conjuro a su libro, hasta el nivel ${cap}: ${LIBRARY_PRICES.copy} de oro por nivel del conjuro.`
                    : `Ya tiene en su libro todo lo de nivel ${cap} o menos que hay aquí.`,
            });
            continue;
        }
        const knownIds = idsOf(member.spellsKnown);
        const known = list.filter(spell => hasSpell(knownIds, spell)).map(spell => ({ id: spell.id, name: spell.name, level: spell.level }));
        const options = list.filter(spell => !hasSpell(knownIds, spell))
            .map(spell => ({ id: spell.id, name: spell.name, level: spell.level, cost: LIBRARY_PRICES.swap * spell.level }));
        readers.push({
            ...base, mode: known.length > 0 && options.length > 0 ? 'swap' : 'none', options, known,
            note: known.length === 0 ? 'No sabe todavía ningún conjuro que cambiar.'
                : options.length === 0 ? 'Aquí no hay nada que no sepa ya.'
                    : `Cambia uno que sabe por otro, hasta el nivel ${cap}: ${LIBRARY_PRICES.swap} de oro por nivel del nuevo.`,
        });
    }
    return { level, readers, empty: readers.length === 0 ? 'Nadie del grupo lanza conjuros: la biblioteca no tiene nada que enseñaros.' : '' };
}

/**
 * Aprender un conjuro en la biblioteca: el parche de la ficha y lo que se cuenta.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {any} input.guild
 * @param {(member: any) => any} input.classRowOf
 * @param {any[]} input.catalogue
 * @param {string} input.spellId El que aprende.
 * @param {string} [input.forget] El que olvida, si cambia uno sabido.
 * @param {number} input.purse
 * @returns {{ok: boolean, reason: string, patch: Record<string, string[]>, cost: number, line: string}}
 */
export function learnSpell({ member, guild, classRowOf, catalogue, spellId, forget = '', purse }) {
    const fail = (/** @type {string} */ reason) => ({ ok: false, reason, patch: {}, cost: 0, line: '' });
    const reader = libraryOffers({ guild, party: [member], classRowOf, catalogue }).readers[0];
    if (!reader || reader.mode === 'none') return fail(reader?.note || 'Aquí no puede aprender nada.');
    const option = reader.options.find(o => o.id === text(spellId));
    if (!option) return fail('Ese conjuro no está en la biblioteca para su clase y su nivel.');
    const plan = payPlan({ cost: option.cost, guild, purse });
    if (!plan.ok) return fail(plan.line);
    if (reader.mode === 'copy') {
        return {
            ok: true, reason: '', cost: option.cost,
            patch: { spellbook: [...idsOf(member.spellbook), option.id] },
            line: `${reader.name} copia «${option.name}» en su libro, en la biblioteca del gremio. ${option.cost} de oro.`,
        };
    }
    const out = reader.known.find(k => k.id === text(forget));
    if (!out) return fail('Di qué conjuro deja de saber.');
    const spells = /** @type {any[]} */ (Array.isArray(catalogue) ? catalogue : []);
    const gone = spells.find(s => text(s?.id) === out.id);
    const kept = idsOf(member.spellsKnown).filter(id => id !== out.id && !(Array.isArray(gone?.aliases) && gone.aliases.includes(id)));
    return {
        ok: true, reason: '', cost: option.cost,
        patch: { spellsKnown: [...kept, option.id] },
        line: `${reader.name} deja de lado «${out.name}» y aprende «${option.name}» en la biblioteca del gremio. ${option.cost} de oro.`,
    };
}

// ---- El establo --------------------------------------------------------------------------

/**
 * La montura que da el establo del gremio: ninguna, la mula o el caballo.
 *
 * @param {any} guild
 * @returns {string}
 */
export function stableMount(guild) {
    return STABLE_MOUNTS[Math.min(STABLE_MOUNTS.length - 1, levelIn(guild, 'stable'))] ?? '';
}

/**
 * Las monturas con las que sale el grupo del gremio: una por cabeza, de las del establo. Es lo
 * que se deja en la campaña (`MOUNTS_KEY` de su chat) para que dentro de ella se vaya montado.
 *
 * @param {any} guild
 * @param {number} riders
 * @returns {Record<string, number>}
 */
export function stableMounts(guild, riders) {
    const mount = stableMount(guild);
    const heads = Math.max(1, whole(riders));
    return mount ? { [mount]: heads } : {};
}

/**
 * La campaña del tablón con el camino que queda yendo en las monturas del establo: su fila con
 * `journey.days` acortado y el cómo dicho. Sin establo, la misma fila. Vale para su tarjeta
 * («A siete días de camino») y para el viaje contado (`journeyLine`).
 *
 * @param {any} world
 * @param {any} guild
 * @param {number} riders
 * @returns {any}
 */
export function journeyWithStable(world, guild, riders) {
    const days = journeyDays(world);
    const mount = stableMount(guild);
    if (!days || !mount) return world;
    const ride = mountedDays({ days, mounts: stableMounts(guild, riders), riders });
    if (ride.saved <= 0) return world;
    const label = /** @type {Record<string, {label: string}>} */ (MOUNTS)[mount]?.label.toLowerCase() ?? mount;
    const those = mount === 'mula' ? 'las' : 'los';
    const how = text(world?.journey?.how).replace(/[.\s]+$/, '');
    return {
        ...world,
        journey: {
            ...world.journey,
            days: ride.days,
            how: [how, `Con ${those} ${label}s del establo del gremio llegáis ${journeySpan(ride.saved)} antes`].filter(Boolean).join('. '),
        },
    };
}

// ---- Los dormitorios ---------------------------------------------------------------------

/**
 * Las espadas de alquiler del gremio: las de siempre y las que se quedan porque hay camas.
 *
 * @param {any} guild
 * @param {any[]} [base] Las de siempre (`HIRELINGS`).
 * @returns {Array<{name: string, className: string, strength: number, dexterity: number, gender: string}>}
 */
export function guildHirelings(guild, base = HIRELINGS) {
    const beds = levelIn(guild, 'bunks');
    const extra = GUILD_RECRUITS.filter(recruit => recruit.bunks <= beds)
        .map(({ name, className, strength, dexterity, gender }) => ({ name, className, strength, dexterity, gender }));
    return [...(Array.isArray(base) ? base : []), ...extra];
}

/**
 * Quien llega al gremio al levantar un nivel de los dormitorios, contado.
 *
 * @param {number} level El nivel nuevo.
 * @returns {string}
 */
export function recruitArrival(level) {
    const recruit = GUILD_RECRUITS.find(r => r.bunks === whole(level));
    return recruit ? `${recruit.name} deja su petate en los dormitorios nuevos. ${recruit.pitch} Ya se puede contratar.` : '';
}
