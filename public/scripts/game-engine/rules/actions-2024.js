/**
 * Las acciones de D&D 2024 que el tablero no tenía (tanda 10, wiki/maquetas/ENCARGO_COMBATE_VTT.md):
 * Correr, Ocultarse a la manera de 2024, Estudiar y Utilizar; beber una poción como acción
 * adicional; tirarse al suelo y levantarse; y el golpe con la otra mano.
 *
 * Las que ya existían (Destrabarse, Esquivar, Ayudar, Preparar) siguen en `combat/maneuvers.js`;
 * aquí solo se dicen igual que las nuevas para el menú de Acciones.
 *
 * Puro: decide y no toca nada. Quien llama gasta la acción, tira el dado y lo cuenta.
 */

import { isLightWeapon, isRangedWeapon, isWeaponItem } from './weapon-mastery.js';

/**
 * Lo que se lee de cada acción en el menú. `cost`: lo que gasta del turno.
 *
 * @type {Record<string, {label: string, short: string, icon: string, cost: 'action'|'bonus'|'free'}>}
 */
export const ACTIONS_2024 = {
    correr: { label: 'Correr', short: 'Este turno andas el doble: tu velocidad otra vez.', icon: 'fa-person-running', cost: 'action' },
    destrabarse: { label: 'Destrabarse', short: 'Este turno te mueves sin que nadie te dé un golpe al irte.', icon: 'fa-shoe-prints', cost: 'action' },
    esquivar: { label: 'Esquivar', short: 'Hasta tu próximo turno, atacarte va con desventaja.', icon: 'fa-shield', cost: 'action' },
    ayudar: { label: 'Ayudar', short: 'Distraes a un enemigo pegado a ti: el siguiente ataque de los tuyos contra él, con ventaja.', icon: 'fa-handshake-angle', cost: 'action' },
    ocultarse: { label: 'Ocultarse', short: 'Sigilo contra 15, tras algo que te tape o en la penumbra. Si sale, nadie te ve hasta que ataques.', icon: 'fa-eye-slash', cost: 'action' },
    estudiar: { label: 'Estudiar', short: 'Una tirada de Inteligencia para saber de qué pie cojea un enemigo.', icon: 'fa-book-open-reader', cost: 'action' },
    utilizar: { label: 'Utilizar', short: 'Usar un objeto: darle una poción a quien tienes al lado, lanzar aceite o una red.', icon: 'fa-gear', cost: 'action' },
    preparar: { label: 'Preparar golpe', short: 'Hasta tu próximo turno, el primero que se te acerque se lleva un golpe antes de nada.', icon: 'fa-hourglass-half', cost: 'action' },
};

/** La CD de Ocultarse en 2024. */
export const HIDE_DC = 15;

/**
 * Si se puede intentar Ocultarse: en la penumbra o a oscuras, siempre; si no, con algo que te
 * tape (media cobertura o más) frente a cada enemigo que mira.
 *
 * @param {{covered: {ok: boolean, reason: string}, dim: boolean}} input `covered`: lo de `canHide`.
 * @returns {{ok: boolean, reason: string}}
 */
export function canHide2024({ covered, dim }) {
    if (dim) return { ok: true, reason: '' };
    if (covered?.ok) return { ok: true, reason: '' };
    return { ok: false, reason: covered?.reason || 'No hay dónde ocultarse: hace falta algo que te tape o poca luz.' };
}

/**
 * La CD de Estudiar a un enemigo: 10, más su desafío (hasta 20). Un ratero se lee de un vistazo;
 * un vampiro antiguo, no.
 *
 * @param {number} cr
 * @returns {number}
 */
export function studyDC(cr) {
    return 10 + Math.max(0, Math.min(10, Math.floor(Number(cr) || 0)));
}

/** Cómo pelea cada perfil de enemigo (`enemy.profile`), dicho para quien lo estudia. */
const PROFILE_WORDS = {
    aggressive: 'Va de frente: se lanza a por quien tiene más cerca.',
    skirmisher: 'Pega y se aparta: busca al que se queda solo.',
    guardian: 'Guarda su sitio y a los suyos: no persigue lejos.',
    coward: 'En cuanto se ve perdido, huye.',
};

/** Los tipos de daño, en palabras. */
const DAMAGE_WORDS = {
    fire: 'fuego', cold: 'frío', poison: 'veneno', necrotic: 'necrótico', radiant: 'radiante', lightning: 'rayo',
    thunder: 'trueno', acid: 'ácido', psychic: 'psíquico', force: 'fuerza', bludgeoning: 'contundente',
    piercing: 'perforante', slashing: 'cortante',
};

/** @param {any} value */
const text = (value) => String(value ?? '').trim();

/**
 * Una lista de tipos de daño, venga como venga, en palabras.
 *
 * @param {any} value
 * @returns {string[]}
 */
function damageList(value) {
    const raw = Array.isArray(value) ? value : text(value).split(/[,;]/);
    return raw.map(v => text(v).toLowerCase()).filter(Boolean)
        .map(v => /** @type {Record<string, string>} */ (DAMAGE_WORDS)[v] ?? v);
}

/**
 * Lo que se puede averiguar de un enemigo, cada cosa con su clave (para no repetirla) y su
 * frase. Lo más útil primero: su punto débil, lo que resiste, cómo pelea, lo que sabe hacer.
 *
 * @param {any} enemy La ficha del enemigo en el combate.
 * @param {{weakness?: string, quirk?: string}} [extra] Lo que diga su fila del bestiario, si no lo lleva él.
 * @returns {Array<{key: string, text: string}>}
 */
export function studyFacts(enemy, extra = {}) {
    /** @type {Array<{key: string, text: string}>} */
    const facts = [];
    const weakness = text(enemy?.weakness) || text(extra.weakness);
    if (weakness) facts.push({ key: 'debil', text: `Su punto débil: ${weakness.replace(/\.?$/, '.')}` });
    const vulnerable = damageList(enemy?.vulnerabilities ?? enemy?.damageVulnerabilities);
    if (vulnerable.length > 0) facts.push({ key: 'vulnerable', text: `Le duele el doble: ${vulnerable.join(', ')}.` });
    const resists = damageList(enemy?.resistances ?? enemy?.damageResistances);
    if (resists.length > 0) facts.push({ key: 'resiste', text: `Aguanta la mitad de: ${resists.join(', ')}.` });
    const immune = damageList(enemy?.immunities ?? enemy?.damageImmunities);
    if (immune.length > 0) facts.push({ key: 'inmune', text: `No le hace nada: ${immune.join(', ')}.` });
    const profile = /** @type {Record<string, string>} */ (PROFILE_WORDS)[text(enemy?.profile)];
    if (profile) facts.push({ key: 'perfil', text: profile });
    const quirk = text(enemy?.quirk) || text(extra.quirk);
    if (quirk) facts.push({ key: 'manias', text: quirk.replace(/\.?$/, '.') });
    const abilities = (Array.isArray(enemy?.abilities) ? enemy.abilities : [])
        .map((/** @type {any} */ a) => text(typeof a === 'string' ? a : a?.name)).filter(Boolean)
        .map(a => a.replace(/^(hab|tec|conj)-/, '').replace(/-/g, ' '));
    if (abilities.length > 0) facts.push({ key: 'sabe', text: `Sabe hacer: ${[...new Set(abilities)].slice(0, 3).join(', ')}.` });
    if (enemy?.boss) facts.push({ key: 'jefe', text: 'Es quien manda aquí: si cae, los demás dudan.' });
    if (facts.length === 0) facts.push({ key: 'nada', text: 'No tiene nada raro: se le gana a golpes.' });
    return facts;
}

/**
 * Lo nuevo de Estudiar: lo que aún no se sabía, uno por tirada buena (dos con un 20).
 *
 * @param {Array<{key: string, text: string}>} facts
 * @param {string[]} known
 * @param {number} howMany
 * @returns {Array<{key: string, text: string}>}
 */
export function newFacts(facts, known, howMany = 1) {
    const seen = new Set((known || []).map(String));
    return facts.filter(f => !seen.has(f.key)).slice(0, Math.max(1, howMany));
}

// ---------------------------------------------------------------- pociones

/**
 * Lo que cura una poción, por su nombre o por lo que dice. Vacío si no es de curar.
 *
 * @param {any} item
 * @returns {string} La fórmula («2d4+2»), o vacío.
 */
export function healingPotionOf(item) {
    if (!item) return '';
    const name = text(item.name).toLowerCase();
    const kind = `${text(item.subcategory)} ${text(item.category)} ${name}`.toLowerCase();
    if (!/potion|poci[oó]n|elixir|t[oó]nico/.test(kind)) return '';
    if (/suprema|supreme/.test(name)) return '10d4+20';
    if (/superior/.test(name)) return '8d4+8';
    if (/mayor|greater/.test(name)) return '4d4+4';
    const said = /(\d+d\d+(?:\s*\+\s*\d+)?)/i.exec(text(item.description));
    if (said && /recupera|cura|sana|heal/i.test(text(item.description))) return said[1].replace(/\s+/g, '');
    if (/curaci[oó]n|healing|sanaci[oó]n/.test(name)) return '2d4+2';
    return '';
}

/**
 * Las pociones de curar que lleva alguien, juntas por nombre, con cuántas hay.
 *
 * @param {any} member
 * @returns {Array<{itemId: string, name: string, heal: string, count: number}>}
 */
export function potionsOf(member) {
    /** @type {Map<string, {itemId: string, name: string, heal: string, count: number}>} */
    const byName = new Map();
    for (const item of Array.isArray(member?.items) ? member.items : []) {
        const heal = healingPotionOf(item);
        if (!heal) continue;
        const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
        const name = text(item.name);
        const known = byName.get(name);
        if (known) known.count += qty;
        else byName.set(name, { itemId: String(item.id), name, heal, count: qty });
    }
    return [...byName.values()];
}

// ---------------------------------------------------------------- tirarse y levantarse

/**
 * Lo que cuesta levantarse del suelo: la mitad de tu velocidad (2024).
 *
 * @param {number} speed
 * @returns {number}
 */
export function standCost(speed) {
    return Math.ceil(Math.max(0, Number(speed) || 0) / 2);
}

/**
 * Si se puede levantar ahora, y por qué no.
 *
 * @param {{left: number, speed: number}} move
 * @returns {{ok: boolean, reason: string, cost: number}}
 */
export function canStand({ left, speed }) {
    const cost = standCost(speed);
    if ((Number(left) || 0) < cost) {
        return { ok: false, reason: `Levantarse cuesta ${cost} pies y te quedan ${Math.max(0, Number(left) || 0)}.`, cost };
    }
    return { ok: true, reason: '', cost };
}

/**
 * Lo que cuesta andar por el suelo, arrastrándose: el doble.
 *
 * @param {number} feet
 * @param {boolean} prone
 * @returns {number}
 */
export function crawlCost(feet, prone) {
    return prone ? Math.max(0, Number(feet) || 0) * 2 : Math.max(0, Number(feet) || 0);
}

// ---------------------------------------------------------------- la otra mano

/**
 * El arma de la otra mano: otra ligera de cuerpo a cuerpo que lleve encima, si la del arma es
 * ligera y no lleva escudo. El motor solo tiene una ranura de arma: la otra va en la mochila y
 * se saca para el golpe.
 *
 * @param {{items: any[], main: any, shield: any}} input
 * @returns {any} El arma, o null.
 */
export function offHandWeaponOf({ items, main, shield }) {
    if (!main || shield || !isLightWeapon(main) || isRangedWeapon(main)) return null;
    return (Array.isArray(items) ? items : [])
        .find(item => item && item.id !== main.id && isWeaponItem(item) && isLightWeapon(item) && !isRangedWeapon(item)) ?? null;
}

/**
 * Si se puede golpear con la otra mano ahora, y por qué no.
 *
 * @param {Object} input
 * @param {any} input.offHand `offHandWeaponOf`.
 * @param {string} input.attackedWith El arma ligera con la que atacó este turno, o vacío.
 * @param {boolean} input.used Si ya golpeó con la otra mano este turno.
 * @param {boolean} input.hasBonus Si le queda la acción adicional.
 * @param {boolean} input.nick Si el arma de la otra mano tiene Mellar y aún no se usó (no gasta la adicional).
 * @returns {{ok: boolean, reason: string, free: boolean}}
 */
export function judgeOffHand({ offHand, attackedWith, used, hasBonus, nick }) {
    if (!offHand) return { ok: false, reason: 'Hace falta un arma ligera en cada mano (y sin escudo).', free: false };
    if (used) return { ok: false, reason: 'Ya has golpeado con la otra mano este turno.', free: false };
    if (!attackedWith) return { ok: false, reason: 'Primero ataca con tu arma ligera; después, la otra mano.', free: false };
    if (!nick && !hasBonus) return { ok: false, reason: 'Ya has gastado la acción adicional.', free: false };
    return { ok: true, reason: '', free: Boolean(nick) };
}
