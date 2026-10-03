/**
 * La barra de acciones de D&D 2024 y sus menús, como datos (tanda 10,
 * wiki/maquetas/ENCARGO_COMBATE_VTT.md y la maqueta wiki/maquetas/combate-vtt-v3.html).
 *
 * De la foto del turno (`BarSnapshot`, que arma `party/combat-bar.js` con el motor) salen la
 * barra —quién juega, lo que le queda: Acción, Adicional, Reacción y los pies— y los cuatro
 * menús que se abren hacia arriba como un grimorio: Atacar, Magia, Acciones y Adicional.
 *
 * Cada opción es una tarjeta con su icono, su nombre, una frase corta y sus etiquetas (daño,
 * alcance en pies, coste). Una tarjeta que pide a quién lleva su paso siguiente (`next`): la
 * lista de objetivos, o una elección (empujar lejos o al suelo). Al final de cada camino hay
 * un `pick`, la orden que entiende el motor («attack:e1», «unarmed:agarrar:e2»…).
 *
 * Lo que no se puede hacer sale igual, apagado y con el porqué escrito: esconderlo haría creer
 * que no existe, cuando lo que pasa es que ahora no toca.
 *
 * Puro: ni DOM ni motor. Lo dibuja `action-bar.js`.
 */

/**
 * @typedef {Object} TargetView Un enemigo o un aliado, como lo enseña una lista.
 * @property {string} id
 * @property {string} name
 * @property {string} [art] Su dibujo, o vacío.
 * @property {number} [hp]
 * @property {number} [maxHp]
 * @property {number} [ac]
 * @property {number} distanceFeet
 * @property {number} [chance] Lo que tiene de acertar, en tanto por ciento.
 * @property {string} [edge] «con ventaja», «con desventaja» o vacío.
 * @property {boolean} [enabled]
 * @property {string} [reason]
 * @property {string} [note] Algo más que decir (lo que ya se sabe de él).
 * @property {string|number} [token] J12.18: su ficha en el tablero (`data-token-id`), para encenderla.
 * @property {'enemy'|'ally'} [side] De qué bando es (sin decir, enemigo).
 * @property {number} [cover] Lo que le tapa: lo que suma a su CA (+2, +5).
 * @property {number} [dc] La CD de lo que le haces, si salva él.
 * @property {string} [save] Con qué salva («Destreza»).
 * @property {Array<{id: string, token?: string|number, name: string, side: 'enemy'|'ally'}>} [caught] Un área apuntada a
 *   él: a quién más pilla (él incluido).
 * @property {Array<{x: number, y: number}>} [cells] Un área apuntada a él: sus casillas.
 */

/**
 * @typedef {Object} AimMark J12.18: alguien que se lleva lo que hace una opción del menú.
 * @property {string} id Su fila en la iniciativa (`data-entry-id`).
 * @property {string|number} [token] Su ficha (`data-token-id`).
 * @property {'harm'|'help'} tone Rojo si le hace daño o va contra él; azul si le cura o le ayuda.
 */

/**
 * @typedef {Object} Aim Lo que se enciende en el tablero al pasar por una opción.
 * @property {AimMark[]} marks
 * @property {Array<{x: number, y: number}>} [cells] Las casillas de un área.
 * @property {'harm'|'help'} [cellsTone]
 */

/**
 * @typedef {Object} WeaponView
 * @property {string} id
 * @property {string} name
 * @property {string} [art]
 * @property {string} mastery La id de su maestría, o vacío.
 * @property {boolean} masteryOn Si quien la lleva sabe usarla.
 * @property {string} damage La fórmula entera, con el modificador («1d6+3»).
 * @property {string} damageType
 * @property {number} reachFeet
 * @property {boolean} light
 * @property {boolean} ranged
 * @property {number} hands
 * @property {TargetView[]} targets Los que tiene a su alcance.
 */

/**
 * @typedef {Object} AbilityView Un conjuro o una técnica de clase, ya juzgada.
 * @property {string} id
 * @property {string} name
 * @property {string} [art]
 * @property {string} desc
 * @property {'action'|'bonus'|'free'} cost
 * @property {'enemy'|'ally'|'self'} target
 * @property {number} rangeFeet
 * @property {number|null} spellLevel Null si no es un conjuro.
 * @property {number} [slotLevel]
 * @property {string} [damage]
 * @property {string} [damageType]
 * @property {string} [healing]
 * @property {boolean} [concentration]
 * @property {string} [area] El área, ya en palabras, o vacío.
 * @property {string} [uses] Cuántas veces quedan, en palabras, o vacío.
 * @property {boolean} enabled
 * @property {string} reason
 * @property {TargetView[]} targets Los posibles, cada uno con su veredicto.
 * @property {Upcast[]} [upcasts] J19.3: los espacios con que se puede lanzar ahora (el suyo y
 *   los mayores que quedan), con lo que hace con cada uno.
 */

/**
 * @typedef {Object} Upcast Un conjuro lanzado con un espacio de ese nivel.
 * @property {number} level
 * @property {number} left Cuántos espacios de ese nivel quedan.
 * @property {string} [damage]
 * @property {string} [healing]
 * @property {number} [targets] A cuántos alcanza.
 */

/**
 * @typedef {Object} JudgedOption Lo que devuelven `judgeManeuvers`, `judgeThrows` y `judgeMagicItems`.
 * @property {string} id
 * @property {string} label
 * @property {string} icon
 * @property {string} detail
 * @property {boolean} enabled
 * @property {boolean} needsTarget
 * @property {Array<{id: string, name: string}>} targets
 */

/**
 * @typedef {Object} BarSnapshot La foto del turno, para la barra y sus menús.
 * @property {boolean} active
 * @property {boolean} isPlayerTurn
 * @property {string} turnLabel
 * @property {string} actorName
 * @property {{action: boolean, bonus: boolean, reaction: boolean}} ready
 * @property {{left: number, speed: number}} move
 * @property {{prone: boolean, standCost: number, canStand: boolean, standWhy: string}} posture
 * @property {boolean} canAuto
 * @property {boolean} canParley
 * @property {boolean} hasMastery
 * @property {WeaponView|null} weapon
 * @property {WeaponView[]} spareWeapons
 * @property {{ok: boolean, reason: string}} swap
 * @property {TargetView[]} enemies Todos los que siguen en pie, con su distancia.
 * @property {TargetView[]} adjacentAllies Los tuyos pegados a ti (para darles una poción).
 * @property {TargetView[]} [dying] Tanda 16: los tuyos que están en el suelo tirando salvaciones,
 *   con su distancia (para Estabilizar: solo a quien está pegado).
 * @property {{damage: number, dc: number, freeHand: {ok: boolean, reason: string}, targets: TargetView[]}} unarmed
 * @property {AbilityView[]} abilities Conjuros y técnicas.
 * @property {Array<{level: number, left: number, max: number}>} slots
 * @property {JudgedOption[]} magicItems
 * @property {Array<{itemId: string, name: string, heal: string, count: number}>} potions
 * @property {{weapon: WeaponView|null, ok: boolean, reason: string, free: boolean}} offHand
 * @property {JudgedOption[]} throws Aceite, red y lo que hay a mano.
 * @property {JudgedOption[]} maneuvers Esquivar, destrabarse, ayudar, preparar (`judgeManeuvers`).
 * @property {{ok: boolean, reason: string}} hide
 * @property {Record<string, number>} [studied] Cuántas cosas se saben ya de cada enemigo.
 * @property {number} [magicCount] Cuántos conjuros y objetos mágicos hay, si la foto es la ligera
 *   (la de la barra sola, sin los menús).
 * @property {{id: string, token: string|number}} [actor] J12.18: quien juega, para encender su
 *   ficha con lo que se hace a sí mismo.
 */

/**
 * @typedef {Object} Badge
 * @property {string} text
 * @property {'damage'|'heal'|'reach'|'cost'|'dc'|'mastery'|'plain'|'chance'} kind
 */

/**
 * @typedef {Object} MenuItem
 * @property {'card'|'target'|'weapon'} kind `weapon`: la tarjeta del arma, que no se pulsa (sus objetivos van debajo).
 * @property {string} key Para encontrarla (`data-pick`): el pick, o el de la tarjeta.
 * @property {string} [pick] Lo que hace al pulsarla, si no lleva paso siguiente.
 * @property {string} name
 * @property {string} [icon]
 * @property {string} [art]
 * @property {string} [desc]
 * @property {Badge[]} [tags] Junto al nombre (la maestría, la CD).
 * @property {Badge[]} [badges] A la derecha (daño, alcance, coste).
 * @property {boolean} enabled
 * @property {string} [reason]
 * @property {{title: string, items: MenuItem[], empty?: string}} [next]
 * @property {string} [tone] El color de su icono: weapon, magic, action, bonus, fire, cold, heal…
 * @property {{id: string, options: Array<{level: number, label: string, title: string, active: boolean}>}} [levels]
 *   J19.3: con qué espacio lanzarlo, si hay más de uno; `id` es el del conjuro.
 * @property {Aim} [aim] J12.18: a quién se encienden en el tablero al pasar por ella.
 * @property {{hp: number, max: number}} [meter] Un objetivo: su vida, en una barra.
 * @property {string} [caught] Un área apuntada a él: a quién pilla, en palabras.
 */

/**
 * @typedef {Object} MenuView
 * @property {'atacar'|'magia'|'acciones'|'adicional'} id
 * @property {string} title
 * @property {string} icon
 * @property {Array<{level: number, left: number, max: number}>} [gems]
 * @property {Array<{id: string, label: string, active: boolean}>} [filters]
 * @property {{label: string, icon: string, enabled: boolean, reason: string, next: {title: string, items: MenuItem[], empty?: string}}|null} [headAction]
 * @property {Array<{title: string, items: MenuItem[]}>} sections
 * @property {string} [empty] Lo que se dice si no hay nada.
 */

/** Los cuatro menús, con su tecla. */
export const MENUS = /** @type {const} */ ([
    { id: 'atacar', label: 'Atacar', icon: 'fa-hand-fist', key: '1', tone: 'attack' },
    { id: 'magia', label: 'Magia', icon: 'fa-wand-magic-sparkles', key: '2', tone: '' },
    { id: 'acciones', label: 'Acciones', icon: 'fa-list-check', key: '3', tone: '' },
    { id: 'adicional', label: 'Adicional', icon: 'fa-bolt-lightning', key: '4', tone: 'bonus' },
]);

/** Las maestrías, en palabras (lo mismo que `rules/weapon-mastery.js`, para no importar el motor). */
const MASTERY_WORDS = {
    vex: { label: 'Molestar', short: 'Si le das, tu siguiente ataque contra él va con ventaja.' },
    topple: { label: 'Derribar', short: 'Si le das, salva con Constitución o cae al suelo.' },
    sap: { label: 'Debilitar', short: 'Si le das, su siguiente ataque va con desventaja.' },
    slow: { label: 'Ralentizar', short: 'Si le das, anda 10 pies menos hasta tu próximo turno.' },
    push: { label: 'Empujar', short: 'Si le das, lo apartas hasta 10 pies de ti.' },
    graze: { label: 'Rozar', short: 'Si fallas, le haces igual tu modificador de daño.' },
    cleave: { label: 'Hender', short: 'Si le das, golpeas también a otro pegado a él, sin sumar tu modificador.' },
    nick: { label: 'Mellar', short: 'El golpe con la otra mano no gasta tu acción adicional.' },
};

/** Lo que gasta cada coste, en palabras. */
const COST_WORDS = { action: 'Acción', bonus: 'Adicional', free: 'Gratis', reaction: 'Reacción' };

/** @param {any} value */
const text = (value) => String(value ?? '').trim();

/**
 * Los pies, dichos para leerlos: «5 pies», «Toque», «Tú».
 *
 * @param {number} feet
 * @param {'enemy'|'ally'|'self'} [target]
 * @returns {string}
 */
export function reachWords(feet, target = 'enemy') {
    if (target === 'self') return 'Tú';
    const n = Math.max(0, Math.round(Number(feet) || 0));
    if (n <= 5 && target === 'ally') return 'Toque';
    return `${Math.max(5, n)} pies`;
}

/**
 * La línea de un objetivo: distancia, vida, CA y lo que tiene de acertar.
 *
 * @param {TargetView} t
 * @returns {string}
 */
export function targetDetail(t) {
    const bits = [`${Math.round(Number(t.distanceFeet) || 0)} pies`];
    if (Number(t.maxHp) > 0) bits.push(`PG ${t.hp}/${t.maxHp}`);
    if (Number(t.ac) > 0) bits.push(`CA ${t.ac}`);
    if (t.note) bits.push(t.note);
    return bits.join(' · ');
}

/**
 * «A», «A y B», «A, B y C».
 *
 * @param {string[]} names
 * @returns {string}
 */
export function joinNames(names) {
    const list = (names || []).map(n => text(n)).filter(Boolean);
    if (list.length <= 1) return list[0] ?? '';
    return `${list.slice(0, -1).join(', ')} y ${list[list.length - 1]}`;
}

/**
 * J12.18: a quién pilla un área apuntada a un objetivo, en palabras. Si va a hacer daño y pilla
 * a alguno de los tuyos, lo avisa.
 *
 * @param {TargetView} t
 * @param {'harm'|'help'} tone
 * @returns {string}
 */
export function caughtWords(t, tone) {
    const list = Array.isArray(t.caught) ? t.caught : [];
    if (list.length === 0) return 'Ahí no pilla a nadie.';
    const own = list.filter(c => c.side === 'ally').map(c => c.name);
    if (tone === 'help') return `Alcanza a ${joinNames(list.map(c => c.name))}.`;
    const warn = own.length === 0 ? '' : ` Ojo: ${joinNames(own)} ${own.length === 1 ? 'es' : 'son'} de los tuyos.`;
    return `Pilla a ${joinNames(list.map(c => c.name))}.${warn}`;
}

/**
 * J12.18: lo que se enciende en el tablero con un objetivo: él, en rojo si va contra él y en azul
 * si es para ayudarle; si es un área apuntada a él, todos los que pilla y sus casillas.
 *
 * @param {TargetView} t
 * @param {'harm'|'help'} tone
 * @returns {Aim}
 */
export function targetAim(t, tone) {
    if (Array.isArray(t.caught)) {
        return {
            marks: t.caught.map(c => ({ id: String(c.id), token: c.token, tone })),
            cells: Array.isArray(t.cells) ? t.cells : [],
            cellsTone: tone,
        };
    }
    return { marks: [{ id: String(t.id), token: t.token, tone }] };
}

/**
 * J12.18: lo que se enciende con una tarjeta que pide a quién: todos los que se pueden elegir
 * (solo ellos: el área se ve al pasar por cada uno).
 *
 * @param {TargetView[]} targets
 * @param {'harm'|'help'} tone
 * @returns {Aim|undefined}
 */
export function choicesAim(targets, tone) {
    const marks = (targets || [])
        .filter(t => t.enabled !== false)
        .map(t => ({ id: String(t.id), token: t.token, tone }));
    return marks.length > 0 ? { marks } : undefined;
}

/**
 * Lo que se hace a uno mismo (un conjuro sobre ti, beber una poción): tu ficha, en azul.
 *
 * @param {BarSnapshot} s
 * @returns {Aim|undefined}
 */
function selfAim(s) {
    return s.actor ? { marks: [{ id: String(s.actor.id), token: s.actor.token, tone: 'help' }] } : undefined;
}

/**
 * Un objetivo como fila de la lista: pulsarlo es hacer lo de `pickPrefix` sobre él. J12.18: con
 * su vida en una barra, lo que tienes de acertar (o la CD, si salva él), si vas con ventaja o
 * está tras algo que le tapa, y lo que se enciende en el tablero al pasar por él. Fuera de
 * alcance sale igual, apagado y diciendo por qué.
 *
 * @param {TargetView} t
 * @param {string} pickPrefix
 * @param {{showChance?: boolean, tone?: 'harm'|'help'}} [opts] `tone`: sin decir, rojo para un
 *   enemigo y azul para uno de los tuyos.
 * @returns {MenuItem}
 */
function targetItem(t, pickPrefix, { showChance = false, tone } = {}) {
    const pick = `${pickPrefix}:${t.id}`;
    const color = tone ?? (t.side === 'ally' ? 'help' : 'harm');
    /** @type {Badge[]} */
    const badges = [];
    const chance = showChance && t.chance !== undefined && t.chance !== null && Number.isFinite(Number(t.chance));
    if (chance) badges.push({ text: `${Math.round(Number(t.chance))} %`, kind: 'chance' });
    if (Number(t.dc) > 0) badges.push({ text: `CD ${Math.round(Number(t.dc))}${t.save ? ` · ${t.save}` : ''}`, kind: 'dc' });
    const edge = text(t.edge);
    const notes = [
        text(t.note),
        edge && !/^con /.test(edge) ? `con ${edge}` : edge,
        // Lo que le tapa cuenta contra un ataque (su CA ya lo lleva sumado), no contra una salvación.
        chance && Number(t.cover) > 0 ? `tras cobertura (+${Math.round(Number(t.cover))} CA)` : '',
    ].filter(Boolean);
    /** @type {MenuItem} */
    const item = {
        kind: 'target', key: pick, pick, name: t.name, art: t.art || '', icon: color === 'help' ? 'fa-user-shield' : 'fa-skull',
        desc: targetDetail({ ...t, note: notes.join(' · ') }), badges, enabled: t.enabled !== false, reason: t.reason || '',
        aim: targetAim(t, color),
    };
    if (Number(t.maxHp) > 0) item.meter = { hp: Math.max(0, Number(t.hp) || 0), max: Number(t.maxHp) };
    if (Array.isArray(t.caught)) item.caught = caughtWords(t, color);
    return item;
}

/**
 * Si la lista que abre una opción es la de a quién (se abre debajo de ella, en el mismo menú) o
 * es otra elección (empujar lejos o al suelo, qué usar), que va en su propio paso.
 *
 * @param {MenuItem} item
 * @returns {boolean}
 */
export function unfolds(item) {
    return Boolean(item?.next) && (item.next?.items ?? []).every(i => i.kind === 'target');
}

/**
 * La etiqueta del daño de un arma o un conjuro.
 *
 * @param {string} formula
 * @param {string} type
 * @returns {Badge|null}
 */
function damageBadge(formula, type) {
    if (!text(formula)) return null;
    return { text: `${text(formula)} ${damageWord(type)}`.trim(), kind: 'damage' };
}

/** Los tipos de daño que el catálogo de conjuros trae en inglés, en castellano. */
const DAMAGE_WORDS = {
    fire: 'fuego', cold: 'frío', poison: 'veneno', force: 'fuerza', acid: 'ácido', lightning: 'rayo', thunder: 'trueno',
    necrotic: 'necrótico', radiant: 'radiante', psychic: 'psíquico', bludgeoning: 'contundente', piercing: 'perforante',
    slashing: 'cortante',
};

/**
 * Un tipo de daño, en palabras.
 *
 * @param {string} type
 * @returns {string}
 */
export function damageWord(type) {
    const key = text(type).toLowerCase();
    return /** @type {Record<string, string>} */ (DAMAGE_WORDS)[key] ?? key;
}

/** @param {Array<Badge|null|false|undefined>} list */
const badgesOf = (list) => /** @type {Badge[]} */ (list.filter(Boolean));

/**
 * La tarjeta de un arma, con su maestría.
 *
 * @param {WeaponView} weapon
 * @returns {{tags: Badge[], desc: string, badges: Badge[]}}
 */
function weaponFace(weapon) {
    const words = /** @type {Record<string, {label: string, short: string}>} */ (MASTERY_WORDS)[weapon.mastery];
    /** @type {Badge[]} */
    const tags = words && weapon.masteryOn ? [{ text: words.label, kind: 'mastery' }] : [];
    const desc = words && weapon.masteryOn
        ? words.short
        : weapon.ranged ? 'Se dispara de lejos.' : 'Cuerpo a cuerpo.';
    const reach = [reachWords(weapon.reachFeet), weapon.light ? 'ligera' : '', Number(weapon.hands) >= 2 ? 'a dos manos' : ''].filter(Boolean).join(' · ');
    return { tags, desc, badges: badgesOf([damageBadge(weapon.damage, weapon.damageType), { text: reach, kind: 'reach' }]) };
}

/**
 * Por qué no se puede usar la acción, si no se puede.
 *
 * @param {BarSnapshot} s
 * @returns {string}
 */
function actionBlocked(s) {
    if (!s.isPlayerTurn) return 'No es tu turno.';
    if (!s.ready.action) return 'Ya has gastado la acción de este turno.';
    return '';
}

/**
 * @param {BarSnapshot} s
 * @returns {string}
 */
function bonusBlocked(s) {
    if (!s.isPlayerTurn) return 'No es tu turno.';
    if (!s.ready.bonus) return 'Ya has gastado la acción adicional de este turno.';
    return '';
}

/**
 * El más cercano de los enemigos, dicho, para cuando no llegas a nadie.
 *
 * @param {BarSnapshot} s
 * @returns {string}
 */
function nearestWords(s) {
    const near = [...(s.enemies || [])].sort((a, b) => a.distanceFeet - b.distanceFeet)[0];
    return near ? `Nadie a tu alcance: el más cercano, ${near.name}, a ${near.distanceFeet} pies.` : 'No queda nadie en pie.';
}

// ---------------------------------------------------------------- Atacar

/**
 * El menú de Atacar: tu arma con su maestría y a quién llegas con ella, las otras armas que
 * llevas (cambiar es gratis una vez), el impacto sin armas (golpe, agarrar con CD, empujar con
 * CD) y las técnicas de tu clase que van contra un enemigo.
 *
 * @param {BarSnapshot} s
 * @returns {MenuView}
 */
export function buildAttackMenu(s) {
    const blocked = actionBlocked(s);
    /** @type {MenuView['sections']} */
    const sections = [];

    // Tu arma, y debajo a quién llegas: un toque y atacas, como antes.
    /** @type {MenuItem[]} */
    const weaponItems = [];
    if (s.weapon) {
        const face = weaponFace(s.weapon);
        // J12.18: también los que están lejos, apagados y diciendo a cuántos pies: a quién llegas
        // se ve de un vistazo.
        const reachable = s.weapon.targets.some(t => t.enabled !== false);
        weaponItems.push({
            kind: 'weapon', key: `weapon:${s.weapon.id}`, name: s.weapon.name, art: s.weapon.art || '', icon: s.weapon.ranged ? 'fa-crosshairs' : 'fa-khanda',
            tone: 'weapon', desc: face.desc, tags: face.tags, badges: [...face.badges, { text: 'Acción', kind: 'cost' }],
            enabled: !blocked && reachable,
            reason: blocked || (reachable ? '' : nearestWords(s)),
            aim: blocked ? undefined : choicesAim(s.weapon.targets, 'harm'),
        });
        for (const t of s.weapon.targets) {
            const row = targetItem({ ...t, enabled: !blocked && t.enabled !== false, reason: blocked || t.reason || '' }, 'attack', { showChance: true });
            weaponItems.push(row);
        }
    }
    if (weaponItems.length > 0) sections.push({ title: '', items: weaponItems });

    // Las otras armas: cambiar a ella y atacar, en un paso.
    /** @type {MenuItem[]} */
    const spares = [];
    for (const weapon of s.spareWeapons || []) {
        const face = weaponFace(weapon);
        const why = blocked || (!s.swap.ok ? s.swap.reason : '') || (!weapon.targets.some(t => t.enabled !== false) ? `Con ${weapon.name.toLowerCase()} no llegas a nadie.` : '');
        spares.push({
            kind: 'card', key: `swapattack:${weapon.id}`, name: `${weapon.name}`, art: weapon.art || '', icon: weapon.ranged ? 'fa-crosshairs' : 'fa-khanda',
            tone: 'weapon', desc: `Cambias a ella gratis y atacas. ${face.desc}`, tags: face.tags,
            badges: [...face.badges, { text: 'Cambiar y atacar', kind: 'cost' }],
            enabled: !why, reason: why, aim: why ? undefined : choicesAim(weapon.targets, 'harm'),
            next: { title: `${weapon.name}: ¿a quién?`, items: weapon.targets.map(t => targetItem(t, `swapattack:${weapon.id}`, { showChance: true })) },
        });
    }
    if (spares.length > 0) sections.push({ title: 'Tus otras armas', items: spares });

    // El impacto sin armas de 2024.
    const close = s.unarmed.targets || [];
    const noOne = close.length === 0 ? 'No tienes a ningún enemigo pegado a ti.' : '';
    const grabWhy = blocked || (!s.unarmed.freeHand.ok ? s.unarmed.freeHand.reason : '') || noOne;
    const dcTag = { text: `CD ${s.unarmed.dc}`, kind: /** @type {const} */ ('dc') };
    sections.push({
        title: 'Sin armas',
        items: [
            {
                kind: 'card', key: 'unarmed:golpe', name: 'Golpe sin armas', icon: 'fa-hand-back-fist', tone: 'weapon',
                desc: 'Puñetazo, codazo o patada.',
                badges: [{ text: `${s.unarmed.damage} contundente`, kind: 'damage' }, { text: '5 pies', kind: 'reach' }],
                enabled: !(blocked || noOne), reason: blocked || noOne, aim: choicesAim(close, 'harm'),
                next: { title: 'Golpe sin armas: ¿a quién?', items: close.map(t => targetItem(t, 'unarmed:golpe', { showChance: true })) },
            },
            {
                kind: 'card', key: 'unarmed:agarrar', name: 'Agarrar', icon: 'fa-hands-holding', tone: 'weapon', tags: [dcTag],
                desc: 'Salva con Fuerza o Destreza. Si falla, no se mueve mientras lo sujetes.',
                badges: [{ text: 'Agarrado', kind: 'cost' }, { text: '5 pies', kind: 'reach' }],
                enabled: !grabWhy, reason: grabWhy, aim: choicesAim(close, 'harm'),
                next: { title: 'Agarrar: ¿a quién?', items: close.map(t => targetItem(t, 'unarmed:agarrar')) },
            },
            {
                kind: 'card', key: 'unarmed:empujar', name: 'Empujar', icon: 'fa-person-falling', tone: 'weapon', tags: [dcTag],
                desc: 'Salva con Fuerza o Destreza. Si falla, lo apartas 5 pies o lo tiras al suelo.',
                badges: [{ text: 'Apartar o tirar', kind: 'cost' }, { text: '5 pies', kind: 'reach' }],
                enabled: !(blocked || noOne), reason: blocked || noOne, aim: choicesAim(close, 'harm'),
                next: {
                    title: 'Empujar: ¿cómo?',
                    items: [
                        {
                            kind: 'card', key: 'unarmed:apartar', name: 'Apartarlo 5 pies', icon: 'fa-arrows-left-right', tone: 'weapon',
                            desc: 'Lo echas una casilla hacia atrás, lejos de ti.', enabled: true, aim: choicesAim(close, 'harm'),
                            next: { title: 'Apartar: ¿a quién?', items: close.map(t => targetItem(t, 'unarmed:apartar')) },
                        },
                        {
                            kind: 'card', key: 'unarmed:tirar', name: 'Tirarlo al suelo', icon: 'fa-person-falling', tone: 'weapon',
                            desc: 'Cae derribado: pegarle de cerca va con ventaja; de lejos, con desventaja.', enabled: true, aim: choicesAim(close, 'harm'),
                            next: { title: 'Tirar al suelo: ¿a quién?', items: close.map(t => targetItem(t, 'unarmed:tirar')) },
                        },
                    ],
                },
            },
        ],
    });

    // Las técnicas de tu clase que van contra un enemigo y gastan la acción.
    const techniques = (s.abilities || []).filter(a => a.spellLevel === null && a.cost === 'action' && a.target === 'enemy');
    if (techniques.length > 0) sections.push({ title: 'De tu clase', items: techniques.map(a => abilityItem(a, s)) });

    const spareOk = (s.spareWeapons || []).length > 0;
    const swapWhy = !s.isPlayerTurn ? 'No es tu turno.' : !spareOk ? 'No llevas otra arma.' : !s.swap.ok ? s.swap.reason : '';
    return {
        id: 'atacar', title: 'Atacar', icon: 'fa-hand-fist', sections,
        headAction: {
            label: 'Cambiar de arma · gratis', icon: 'fa-repeat', enabled: !swapWhy, reason: swapWhy,
            next: {
                title: 'Cambiar de arma',
                items: (s.spareWeapons || []).map(weapon => {
                    const face = weaponFace(weapon);
                    return {
                        kind: /** @type {const} */ ('card'), key: `swap:${weapon.id}`, pick: `swap:${weapon.id}`, name: weapon.name, art: weapon.art || '',
                        icon: weapon.ranged ? 'fa-crosshairs' : 'fa-khanda', tone: 'weapon', desc: face.desc, tags: face.tags,
                        badges: [...face.badges, { text: 'Gratis', kind: /** @type {const} */ ('cost') }], enabled: !swapWhy, reason: swapWhy,
                    };
                }),
                empty: 'No llevas otra arma.',
            },
        },
    };
}

// ---------------------------------------------------------------- conjuros y técnicas

/**
 * La etiqueta de lo que gasta una habilidad.
 *
 * @param {AbilityView} a
 * @returns {Badge[]}
 */
function abilityCost(a) {
    /** @type {Badge[]} */
    const out = [];
    if (a.spellLevel === 0) out.push({ text: 'Truco', kind: 'cost' });
    else if (typeof a.spellLevel === 'number') out.push({ text: `Espacio de nivel ${a.slotLevel || a.spellLevel}`, kind: 'cost' });
    if (a.cost !== 'action' || a.spellLevel === null) out.push({ text: COST_WORDS[a.cost] ?? 'Acción', kind: 'cost' });
    if (a.uses) out.push({ text: a.uses, kind: 'plain' });
    return out;
}

/**
 * El color de un conjuro, por su daño o lo que hace.
 *
 * @param {AbilityView} a
 * @returns {string}
 */
function abilityTone(a) {
    const type = `${text(a.damageType)} ${text(a.name)}`.toLowerCase();
    if (a.healing) return 'heal';
    if (/fuego|fire|llama|ardient/.test(type)) return 'fire';
    if (/fr[ií]o|cold|escarcha|hielo/.test(type)) return 'cold';
    if (/rayo|relámpago|trueno|lightning|thunder/.test(type)) return 'storm';
    if (/necr|veneno|poison|ácido|acid/.test(type)) return 'dark';
    if (/radiante|radiant|sagrad/.test(type)) return 'holy';
    return a.spellLevel === null ? 'action' : 'magic';
}

/**
 * Un icono para un conjuro o una técnica sin dibujo.
 *
 * @param {AbilityView} a
 * @returns {string}
 */
function abilityIcon(a) {
    const tone = abilityTone(a);
    return ({
        heal: 'fa-hand-holding-heart', fire: 'fa-fire', cold: 'fa-snowflake', storm: 'fa-bolt', dark: 'fa-skull',
        holy: 'fa-sun', action: a.target === 'enemy' ? 'fa-khanda' : 'fa-person-rays', magic: 'fa-wand-sparkles',
    })[tone] ?? 'fa-wand-sparkles';
}

/**
 * J19.3: lo que cambia un conjuro con un espacio mayor, en palabras para el botón del nivel.
 *
 * @param {AbilityView} a
 * @param {Upcast} up
 * @returns {string}
 */
function upcastWords(a, up) {
    const bits = [`Con un espacio de nivel ${up.level}`];
    if (up.healing) bits.push(`cura ${up.healing}`);
    else if (up.damage) bits.push(`${up.damage} ${damageWord(a.damageType || '')}`.trim());
    if (Number(up.targets) > 1) bits.push(`a ${up.targets}`);
    bits.push(`quedan ${up.left}`);
    return bits.join(' · ');
}

/**
 * Una habilidad (conjuro o técnica) como tarjeta. Contra alguien, su paso siguiente es a quién.
 * J19.3: si se puede lanzar con más de un espacio, la tarjeta lleva los niveles para elegir, y
 * sus números (daño, curación) son los del nivel elegido.
 *
 * @param {AbilityView} a
 * @param {BarSnapshot} s
 * @param {number} [chosenLevel] El espacio elegido; sin decir, el más bajo que queda.
 * @returns {MenuItem}
 */
export function abilityItem(a, s, chosenLevel = 0) {
    const turnWhy = !s.isPlayerTurn ? 'No es tu turno.'
        : a.cost === 'action' && !s.ready.action ? 'Ya has gastado la acción de este turno.'
            : a.cost === 'bonus' && !s.ready.bonus ? 'Ya has gastado la acción adicional de este turno.'
                : '';
    const why = turnWhy || (a.enabled ? '' : a.reason);
    const ups = (a.upcasts || []).filter(u => u.left > 0).sort((x, y) => x.level - y.level);
    const up = ups.length > 1 ? (ups.find(u => u.level === chosenLevel) ?? ups[0]) : null;
    const shown = up ? { ...a, damage: up.damage ?? a.damage, healing: up.healing ?? a.healing, slotLevel: up.level } : a;
    /** @type {Badge[]} */
    const badges = badgesOf([
        shown.healing ? { text: `Cura ${shown.healing}`, kind: 'heal' } : damageBadge(shown.damage || '', a.damageType || ''),
        { text: reachWords(a.rangeFeet, a.target), kind: 'reach' },
        ...abilityCost(shown),
    ]);
    /** @type {Badge[]} */
    const tags = [];
    if (a.concentration) tags.push({ text: 'Concentración', kind: 'plain' });
    if (a.area) tags.push({ text: a.area, kind: 'plain' });
    if (up && Number(up.targets) > 1) tags.push({ text: `A ${up.targets}`, kind: 'plain' });
    // Con el espacio más bajo, como siempre; con uno mayor, «cast:nivel:id».
    const pick = up && up.level > ups[0].level ? `cast:${up.level}:${a.id}` : `ability:${a.id}`;
    /** @type {MenuItem} */
    const item = {
        kind: /** @type {const} */ ('card'), key: pick, name: a.name, art: a.art || '', icon: abilityIcon(a), tone: abilityTone(a),
        desc: a.desc, tags, badges, enabled: !why, reason: why,
    };
    if (up && !why) {
        item.levels = {
            id: a.id,
            options: ups.map(u => ({ level: u.level, label: `Nivel ${u.level}`, title: upcastWords(a, u), active: u.level === up.level })),
        };
    }
    // J12.18: sobre ti, tu ficha en azul; contra alguien, todos a los que se puede apuntar (rojo
    // si hace daño o va contra ellos, azul si cura o ayuda).
    if (a.target === 'self') return { ...item, pick, aim: why ? undefined : selfAim(s) };
    const tone = a.target === 'ally' ? 'help' : 'harm';
    const who = a.target === 'ally' ? '¿a quién de los tuyos?' : '¿contra quién?';
    return {
        ...item,
        aim: why ? undefined : choicesAim(a.targets || [], tone),
        next: {
            title: `${a.name}: ${who}`,
            // Primero a los que llega, del más cerca al más lejos; detrás, los apagados con su porqué.
            items: [...(a.targets || [])]
                .sort((x, y) => Number(y.enabled !== false) - Number(x.enabled !== false) || (Number(x.distanceFeet) || 0) - (Number(y.distanceFeet) || 0))
                .map(t => targetItem(t, pick, { showChance: true, tone })),
            empty: a.target === 'ally' ? 'No hay nadie de los tuyos a su alcance.' : 'No hay nadie a su alcance.',
        },
    };
}

// ---------------------------------------------------------------- Magia

/**
 * Los filtros de Magia: todos, trucos, cada nivel que se tenga y los objetos.
 *
 * @param {BarSnapshot} s
 * @param {string} active
 * @returns {Array<{id: string, label: string, active: boolean}>}
 */
function magicFilters(s, active) {
    const spells = (s.abilities || []).filter(a => typeof a.spellLevel === 'number');
    const levels = [...new Set(spells.map(a => Number(a.spellLevel)))].sort((a, b) => a - b);
    const list = [{ id: 'todos', label: 'Todos' }];
    if (levels.includes(0)) list.push({ id: 'trucos', label: 'Trucos' });
    for (const level of levels.filter(l => l > 0)) list.push({ id: `n${level}`, label: `Nivel ${level}` });
    if ((s.magicItems || []).length > 0) list.push({ id: 'objetos', label: 'Objetos' });
    const chosen = list.some(f => f.id === active) ? active : 'todos';
    return list.map(f => ({ ...f, active: f.id === chosen }));
}

/**
 * Un objeto mágico (pergamino, varita) o algo que se lanza, como tarjeta.
 *
 * @param {JudgedOption} option
 * @param {BarSnapshot} s
 * @param {string} prefix El pick de antes de su id («maneuver»).
 * @param {string} tone
 * @returns {MenuItem}
 */
function optionItem(option, s, prefix, tone) {
    const pick = `${prefix}:${option.id}`;
    const why = !s.isPlayerTurn ? 'No es tu turno.' : (option.enabled ? '' : option.detail);
    const byId = new Map((s.enemies || []).map(e => [e.id, e]));
    const allies = new Map((s.adjacentAllies || []).map(a => [a.id, a]));
    /** @type {MenuItem} */
    const item = {
        kind: 'card', key: pick, name: option.label, icon: option.icon || 'fa-gear', tone,
        desc: option.enabled ? option.detail : '', badges: [{ text: 'Acción', kind: 'cost' }], enabled: !why, reason: why,
    };
    if (!option.needsTarget) return { ...item, pick };
    const views = (option.targets || []).map(t => byId.get(t.id) ?? allies.get(t.id) ?? { id: t.id, name: t.name, distanceFeet: 0 });
    return {
        ...item,
        aim: why ? undefined : { marks: views.map(t => ({ id: String(t.id), token: t.token, tone: /** @type {'harm'|'help'} */ (t.side === 'ally' ? 'help' : 'harm') })) },
        next: {
            title: `${option.label}: ¿a quién?`,
            items: views.map(t => targetItem(t, pick)),
        },
    };
}

/**
 * El menú de Magia: las gemas de los espacios que quedan, los filtros y los conjuros.
 *
 * @param {BarSnapshot} s
 * @param {string} [filter] `todos`, `trucos`, `n1`…, `objetos`.
 * @param {Record<string, number>} [slotChoice] J19.3: el espacio elegido para cada conjuro.
 * @returns {MenuView}
 */
export function buildMagicMenu(s, filter = 'todos', slotChoice = {}) {
    const filters = magicFilters(s, filter);
    const active = filters.find(f => f.active)?.id ?? 'todos';
    const spells = (s.abilities || [])
        .filter(a => typeof a.spellLevel === 'number')
        .sort((a, b) => Number(a.spellLevel) - Number(b.spellLevel) || a.name.localeCompare(b.name));
    const shown = active === 'todos' ? spells
        : active === 'trucos' ? spells.filter(a => a.spellLevel === 0)
            : active.startsWith('n') ? spells.filter(a => a.spellLevel === Number(active.slice(1)))
                : [];
    /** @type {MenuView['sections']} */
    const sections = [];
    if (shown.length > 0) sections.push({ title: '', items: shown.map(a => abilityItem(a, s, Number(slotChoice[a.id]) || 0)) });
    if ((active === 'todos' || active === 'objetos') && (s.magicItems || []).length > 0) {
        sections.push({ title: 'Objetos', items: s.magicItems.map(o => optionItem(o, s, 'maneuver', 'magic')) });
    }
    return {
        id: 'magia', title: 'Magia', icon: 'fa-wand-magic-sparkles', gems: (s.slots || []).filter(g => g.max > 0), filters, sections,
        empty: spells.length === 0 && (s.magicItems || []).length === 0
            ? 'No sabes conjuros ni llevas objetos mágicos.'
            : 'Nada con este filtro.',
    };
}

// ---------------------------------------------------------------- Acciones

/**
 * Lo juzgado por el motor (`judgeManeuvers`) de una maniobra, por su id.
 *
 * @param {BarSnapshot} s
 * @param {string} id
 * @returns {JudgedOption|null}
 */
function maneuver(s, id) {
    return (s.maneuvers || []).find(m => m.id === id) ?? null;
}

/**
 * El menú de Acciones de 2024: Correr, Destrabarse, Esquivar, Ayudar, Ocultarse, Estudiar,
 * Utilizar y Preparar; hablar para salir de la pelea, si se puede; y lo de tu clase que gasta
 * la acción sin ir contra un enemigo.
 *
 * @param {BarSnapshot} s
 * @param {Record<string, {label: string, short: string, icon: string}>} words `ACTIONS_2024`.
 * @param {{hideDc: number, studyDc: (cr: number) => number}} numbers
 * @returns {MenuView}
 */
export function buildActionsMenu(s, words, numbers) {
    const blocked = actionBlocked(s);
    const card = (/** @type {string} */ id, /** @type {Partial<MenuItem>} */ extra = {}) => {
        const w = words[id];
        /** @type {MenuItem} */
        const item = {
            kind: 'card', key: `act:${id}`, pick: `act:${id}`, name: w.label, icon: w.icon, tone: 'action', desc: w.short,
            badges: [{ text: 'Acción', kind: 'cost' }], enabled: !blocked, reason: blocked, ...extra,
        };
        if (!item.enabled && !item.reason) item.reason = blocked;
        return item;
    };
    const judged = (/** @type {string} */ id, /** @type {string} */ wordId) => {
        const m = maneuver(s, id);
        const why = blocked || (m && !m.enabled ? m.detail : '') || (m ? '' : 'Ahora no se puede.');
        return card(wordId, { enabled: !why, reason: why });
    };

    /** @type {MenuItem[]} */
    const items = [];
    items.push(card('correr', { badges: [{ text: `+${s.move.speed} pies`, kind: 'reach' }, { text: 'Acción', kind: 'cost' }] }));
    items.push(judged('destrabarse', 'destrabarse'));
    items.push(judged('esquivar', 'esquivar'));

    // Ayudar: contra un enemigo pegado a ti.
    const help = maneuver(s, 'ayudar');
    const helpWhy = blocked || (help && !help.enabled ? help.detail : '') || (help ? '' : 'Ahora no se puede.');
    const byId = new Map((s.enemies || []).map(e => [e.id, e]));
    const helpViews = (help?.targets || []).map(t => byId.get(t.id) ?? { id: t.id, name: t.name, distanceFeet: 5 });
    items.push({
        ...card('ayudar'), pick: undefined, enabled: !helpWhy, reason: helpWhy, aim: helpWhy ? undefined : choicesAim(helpViews, 'harm'),
        next: { title: 'Ayudar: ¿a quién distraes?', items: helpViews.map(t => targetItem(t, 'act:ayudar', { tone: 'harm' })) },
    });

    // Tanda 16: Estabilizar a uno de los tuyos que ha caído (2024: Ayudar a quien está a 0 PG,
    // Medicina contra 10). Solo sale si hay alguien en el suelo; se hace pegado a él.
    const fallen = s.dying || [];
    if (fallen.length > 0) {
        const near = fallen.filter(t => (Number(t.distanceFeet) || 0) <= 5);
        const steadyWhy = blocked || (near.length === 0 ? `Tienes que estar pegado a ${fallen.length === 1 ? fallen[0].name : 'quien ha caído'}.` : '');
        items.push({
            ...card('estabilizar', { tags: [{ text: 'CD 10 · Medicina', kind: 'dc' }] }), pick: undefined, enabled: !steadyWhy, reason: steadyWhy,
            aim: steadyWhy ? undefined : choicesAim(near, 'help'),
            next: {
                title: 'Estabilizar: ¿a quién?',
                items: fallen.map(t => ({
                    ...targetItem({ ...t, note: 'en el suelo', enabled: (Number(t.distanceFeet) || 0) <= 5, reason: (Number(t.distanceFeet) || 0) <= 5 ? '' : 'No está pegado a ti.' }, 'act:estabilizar', { tone: 'help' }),
                    icon: 'fa-kit-medical',
                })),
            },
        });
    }

    const hideWhy = blocked || (s.hide.ok ? '' : s.hide.reason);
    items.push(card('ocultarse', { tags: [{ text: `CD ${numbers.hideDc} · Sigilo`, kind: 'dc' }], badges: [{ text: 'Invisible', kind: 'cost' }, { text: 'Acción', kind: 'cost' }], enabled: !hideWhy, reason: hideWhy }));

    // Estudiar: a cualquiera que siga en pie.
    const studyWhy = blocked || ((s.enemies || []).length === 0 ? 'No queda nadie a quien estudiar.' : '');
    items.push({
        ...card('estudiar', { tags: [{ text: 'Inteligencia', kind: 'dc' }] }), pick: undefined, enabled: !studyWhy, reason: studyWhy,
        aim: studyWhy ? undefined : choicesAim(s.enemies || [], 'harm'),
        next: {
            title: 'Estudiar: ¿a quién?',
            items: (s.enemies || []).map(t => {
                const known = Number(s.studied?.[t.id]) || 0;
                const row = targetItem({ ...t, note: known > 0 ? `ya sabes ${known} cosa${known === 1 ? '' : 's'}` : '' }, 'act:estudiar');
                return { ...row, badges: [{ text: `CD ${numbers.studyDc(Number(/** @type {any} */ (t).cr) || 0)}`, kind: /** @type {const} */ ('dc') }] };
            }),
        },
    });

    // Utilizar: dar una poción a quien tienes al lado, lanzar aceite o una red, lo que hay a mano.
    /** @type {MenuItem[]} */
    const uses = [];
    for (const potion of s.potions || []) {
        uses.push({
            kind: 'card', key: `give:${potion.itemId}`, name: `Darle ${potion.name.toLowerCase()}`, icon: 'fa-flask', tone: 'heal',
            desc: 'Se la das a quien tienes pegado y se la bebe.', badges: [{ text: `Cura ${potion.heal}`, kind: 'heal' }, { text: `×${potion.count}`, kind: 'plain' }],
            enabled: (s.adjacentAllies || []).length > 0, reason: (s.adjacentAllies || []).length > 0 ? '' : 'No tienes a nadie de los tuyos pegado a ti.',
            aim: choicesAim(s.adjacentAllies || [], 'help'),
            next: { title: `${potion.name}: ¿a quién?`, items: (s.adjacentAllies || []).map(a => targetItem(a, `give:${potion.itemId}`, { tone: 'help' })) },
        });
    }
    for (const option of s.throws || []) uses.push(optionItem(option, s, 'maneuver', 'action'));
    const useWhy = blocked || (uses.length === 0 ? 'No llevas nada que usar ahora: una poción para darla, aceite o una red.' : '');
    items.push({
        ...card('utilizar'), pick: undefined, enabled: !useWhy, reason: useWhy,
        next: { title: 'Utilizar: ¿qué?', items: uses.map(u => (blocked ? { ...u, enabled: false, reason: blocked } : u)) },
    });

    items.push(judged('preparar', 'preparar'));

    // J8.5: salir de la pelea hablando, como una acción más.
    if (s.canParley) {
        items.push({
            kind: 'card', key: 'parley', pick: 'parley', name: 'Parlamentar', icon: 'fa-comments', tone: 'action',
            desc: 'Rendirse, sobornar, convencer o engañar: cada cosa con su tirada.', badges: [{ text: 'Hablar', kind: 'cost' }],
            enabled: s.isPlayerTurn, reason: s.isPlayerTurn ? '' : 'No es tu turno.',
        });
    }

    /** @type {MenuView['sections']} */
    const sections = [{ title: '', items }];
    const own = (s.abilities || []).filter(a => a.spellLevel === null && a.cost === 'action' && a.target !== 'enemy');
    if (own.length > 0) sections.push({ title: 'De tu clase', items: own.map(a => abilityItem(a, s)) });
    return { id: 'acciones', title: 'Acciones', icon: 'fa-list-check', sections };
}

// ---------------------------------------------------------------- Adicional

/**
 * El menú de Adicional: beber una poción (en 2024 es acción adicional), el golpe con la otra
 * mano, y lo de tu clase y tus conjuros que se hace con la adicional o gratis.
 *
 * @param {BarSnapshot} s
 * @param {Record<string, number>} [slotChoice] J19.3: el espacio elegido para cada conjuro.
 * @returns {MenuView}
 */
export function buildBonusMenu(s, slotChoice = {}) {
    const blocked = bonusBlocked(s);
    /** @type {MenuItem[]} */
    const items = [];
    for (const potion of s.potions || []) {
        items.push({
            kind: 'card', key: `drink:${potion.itemId}`, pick: `drink:${potion.itemId}`, name: `Beber ${potion.name.toLowerCase()}`, icon: 'fa-flask', tone: 'heal',
            desc: 'Te la bebes tú. Dársela a otro es «Utilizar», en Acciones.',
            badges: [{ text: `Cura ${potion.heal}`, kind: 'heal' }, { text: `×${potion.count}`, kind: 'plain' }, { text: 'Adicional', kind: 'cost' }],
            enabled: !blocked, reason: blocked, aim: blocked ? undefined : selfAim(s),
        });
    }
    if ((s.potions || []).length === 0) {
        items.push({
            kind: 'card', key: 'drink:none', name: 'Beber una poción', icon: 'fa-flask', tone: 'heal',
            desc: 'Te la bebes tú, sin gastar la acción.', badges: [{ text: 'Adicional', kind: 'cost' }],
            enabled: false, reason: 'No llevas pociones de curación.',
        });
    }

    // La otra mano.
    const off = s.offHand;
    const offWhy = !s.isPlayerTurn ? 'No es tu turno.' : (off.ok ? '' : off.reason);
    const offWeapon = off.weapon;
    const offWords = offWeapon ? /** @type {Record<string, {label: string}>} */ (MASTERY_WORDS)[offWeapon.mastery] : null;
    items.push({
        kind: 'card', key: 'offhand', name: offWeapon ? `Golpe con la otra mano: ${offWeapon.name.toLowerCase()}` : 'Golpe con la otra mano',
        art: offWeapon?.art || '', icon: 'fa-khanda', tone: 'weapon',
        desc: 'Tras atacar con un arma ligera, otro golpe con la ligera de la otra mano, sin sumar tu modificador al daño.',
        tags: offWords && offWeapon?.masteryOn ? [{ text: offWords.label, kind: 'mastery' }] : [],
        badges: badgesOf([
            offWeapon ? damageBadge(offWeapon.damage, offWeapon.damageType) : null,
            { text: '5 pies', kind: 'reach' },
            { text: off.free ? 'Gratis (Mellar)' : 'Adicional', kind: 'cost' },
        ]),
        enabled: !offWhy, reason: offWhy, aim: offWhy ? undefined : choicesAim(offWeapon?.targets || [], 'harm'),
        next: { title: 'Otra mano: ¿a quién?', items: (offWeapon?.targets || []).map(t => targetItem(t, 'offhand', { showChance: true })) },
    });

    /** @type {MenuView['sections']} */
    const sections = [{ title: '', items }];
    const bonus = (s.abilities || []).filter(a => a.cost === 'bonus');
    if (bonus.length > 0) sections.push({ title: 'De tu clase y tu magia', items: bonus.map(a => abilityItem(a, s, Number(slotChoice[a.id]) || 0)) });
    const free = (s.abilities || []).filter(a => a.cost === 'free');
    if (free.length > 0) sections.push({ title: 'Sin gastar nada', items: free.map(a => abilityItem(a, s)) });
    return { id: 'adicional', title: 'Acción adicional', icon: 'fa-bolt-lightning', sections };
}

// ---------------------------------------------------------------- la barra

/**
 * @typedef {Object} BarView
 * @property {boolean} active
 * @property {boolean} isPlayerTurn
 * @property {string} turnLabel
 * @property {Array<{id: string, label: string, ready: boolean, title: string}>} pills
 * @property {string} move «15/30 pies».
 * @property {{on: boolean, label: string, title: string, enabled: boolean, pick: string}} prone
 * @property {Array<{id: string, label: string, icon: string, key: string, enabled: boolean, title: string, tone: string}>} buttons
 * @property {boolean} canAuto
 */

/**
 * La barra: quién juega, lo que le queda y los botones.
 *
 * @param {BarSnapshot} s
 * @returns {BarView}
 */
export function buildBar(s) {
    const mine = Boolean(s.isPlayerTurn);
    const pill = (/** @type {string} */ id, /** @type {string} */ label, /** @type {boolean} */ ready) => ({
        id, label, ready: mine && ready,
        title: !mine ? 'No es tu turno' : ready ? `${label}: lista` : `${label}: gastada este turno`,
    });
    const prone = s.posture?.prone;
    const proneTitle = prone
        ? (s.posture.canStand ? `Levantarte cuesta ${s.posture.standCost} pies de tu movimiento.` : s.posture.standWhy)
        : 'Tirarte al suelo es gratis: de lejos te dan peor, de cerca mejor. Levantarte cuesta la mitad de tu movimiento.';
    const magicCount = typeof s.magicCount === 'number' ? s.magicCount
        : (s.abilities || []).filter(a => typeof a.spellLevel === 'number').length + (s.magicItems || []).length;
    const menuTitle = /** @type {Record<string, string>} */ ({
        atacar: 'Tus armas, el golpe sin armas, agarrar y empujar',
        magia: magicCount > 0 ? 'Tus conjuros y objetos mágicos' : 'No sabes conjuros ni llevas objetos mágicos',
        acciones: 'Correr, destrabarse, esquivar, ayudar, ocultarse, estudiar y utilizar',
        adicional: 'Beber una poción, la otra mano y lo que se hace con la acción adicional',
    });
    return {
        active: Boolean(s.active),
        isPlayerTurn: mine,
        turnLabel: s.turnLabel,
        pills: [pill('action', 'Acción', s.ready?.action), pill('bonus', 'Adicional', s.ready?.bonus), pill('reaction', 'Reacción', s.ready?.reaction)],
        move: mine ? `${Math.max(0, Math.round(s.move.left))}/${Math.round(s.move.speed)} pies` : '',
        prone: {
            on: Boolean(prone),
            label: prone ? 'Levantarse' : 'Cuerpo a tierra',
            title: proneTitle,
            enabled: mine && (!prone || Boolean(s.posture.canStand)),
            pick: prone ? 'stand' : 'prone',
        },
        buttons: [
            // Todo lo de Atacar gasta la acción: gastada, se apaga (y el turno se acaba con
            // «Fin de turno», no abriendo una lista en la que no se puede pulsar nada).
            ...MENUS.map(m => ({
                id: m.id, label: m.label, icon: m.icon, key: m.key, tone: m.tone,
                enabled: mine && (m.id !== 'magia' || magicCount > 0) && (m.id !== 'atacar' || Boolean(s.ready?.action)),
                title: !mine ? 'No es tu turno'
                    : m.id === 'atacar' && !s.ready?.action ? 'Ya has gastado la acción de este turno'
                        : `${menuTitle[m.id]} (${m.key})`,
            })),
            { id: 'end', label: 'Fin de turno', icon: 'fa-forward-step', key: '', tone: 'end', enabled: mine, title: mine ? 'Pasar el turno' : 'No es tu turno' },
            { id: 'flee', label: 'Abandonar', icon: 'fa-person-running', key: '', tone: 'quiet', enabled: true, title: 'Salir de la pelea huyendo' },
        ],
        canAuto: Boolean(s.canAuto),
    };
}

/**
 * Las opciones que se pueden pulsar de una lista, en orden (para las teclas 1 a 9).
 *
 * @param {MenuItem[]} items
 * @returns {MenuItem[]}
 */
export function pickable(items) {
    return (items || []).filter(i => i.kind !== 'weapon' && i.enabled);
}
