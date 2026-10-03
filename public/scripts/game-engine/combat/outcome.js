/**
 * J12.21 (Daniel, 2026-10-03; wiki/maquetas/ENCARGO_COMBATE_MUELLE_Y_RESULTADO.md y la maqueta
 * wiki/maquetas/resultado-combate.html): la pantalla de victoria o de derrota.
 *
 * Antes, al golpear al último enemigo la pelea se acababa de golpe («puum, se acabó») y salía una
 * tarjetita arriba que se iba sola. Ahora, cuando se ha visto todo el último golpe (la embestida,
 * el dado, el número y la ficha que cae), sale una pantalla que se queda hasta que eliges:
 *
 * - **Victoria:** el balance de cada uno (su cara, su clase y su nivel, su vida en una barra, cómo
 *   ha quedado, los PX que gana y «Subir a nivel N» si le toca), el botín con su icono y su tipo
 *   (común, misión, material), la hora del juego y lo que tiene sentido hacer: seguir con la
 *   historia (D-J45: lo que toque, o volver al sitio si el tablero se queda vacío), registrar la
 *   sala si quedan cofres o puertas, y un descanso corto si hay heridos.
 * - **Derrota:** quién cayó, sus heridas y las secuelas que se quedan; quién os recoge, cuánto
 *   cobra y el tiempo en cama; «Despertar en …» y «Volver al punto guardado» si se puede. En el
 *   modo de hierro (D-J64: el modo duro) la pantalla dice claro que quien muere no vuelve,
 *   tampoco un confidente.
 *
 * Sin narrador (D-J60): la línea de debajo del título es un dato («Encuentro superado en La
 * bodega · ronda 3»), no una narración.
 *
 * Puro: de lo que se le da (el grupo ya contado, el botín, lo que toca después) a lo que se pinta.
 * Lo pinta `ui/combat-vtt/outcome-screen.js` y lo junta y lo hace `party/combat-flow.js`.
 */

/** Lo que cobran por recoger a cada uno de los vuestros que sigue con vida (rescate y curas). */
export const RESCUE_FEE_EACH = 10;

/** Los días que se pasan en cama tras caer todo el grupo. */
export const RESCUE_DAYS = 1;

/**
 * @typedef {Object} OutcomeInjury Una herida que lleva encima.
 * @property {string} label
 * @property {boolean} [permanent] Si es para siempre (una secuela).
 * @property {number} [daysLeft]
 */

/**
 * @typedef {Object} OutcomeMember Alguien del grupo al acabar la pelea.
 * @property {string} id
 * @property {string} name
 * @property {string} [face] Su cara (la URL), o vacío.
 * @property {string} [className]
 * @property {number} [level]
 * @property {number} hp
 * @property {number} maxHp
 * @property {boolean} [dead]
 * @property {boolean} [downed] Si cayó a 0 PG en esta pelea.
 * @property {OutcomeInjury[]} [injuries]
 * @property {number} [xp] Los PX que ha ganado en esta pelea.
 * @property {number} [nextLevel] Si ya puede subir: a qué nivel.
 * @property {boolean} [guest] Un invitado (el mercenario, el escoltado).
 * @property {boolean} [confidant] Uno de los confidentes escritos de la campaña.
 * @property {string} [gender] `m`, `f` o vacío: para «malherido» o «malherida».
 */

/**
 * @typedef {Object} OutcomeItem Algo del botín.
 * @property {string} name
 * @property {string} [type] El tipo del objeto (`weapon`, `armor`, `potion`, `gear`…).
 * @property {string} [subcategory] `material`, `tool`…
 * @property {string} [rarity]
 * @property {boolean} [quest] Si es de una misión (una llave, una reliquia).
 * @property {string} [art] Su dibujo, si lo hay.
 */

/**
 * @typedef {Object} OutcomeButton
 * @property {string} id Qué hace: `continue`, `search`, `rest`, `wake`, `back`, `load`, `home`, `close`.
 * @property {string} label
 * @property {string} icon Un icono de Font Awesome.
 * @property {'gold'|'red'|'subtle'} tone
 * @property {string} [title]
 * @property {string} [className] Las clases de siempre que llevan (`pf-back`, `pf-load`, `pf-home`).
 * @property {boolean} [main] El de por defecto (Intro).
 */

/**
 * @typedef {Object} OutcomeRescue Quién os recoge tras caer todo el grupo, y lo que cuesta.
 * @property {string} who
 * @property {string} where Dónde despertáis.
 * @property {number} cost Lo que cobran, en oro (lo que haya, como mucho).
 * @property {number} wanted Lo que piden (puede ser más de lo que lleváis).
 * @property {number} days
 */

/**
 * @typedef {Object} OutcomeInput
 * @property {'victory'|'defeat'} kind
 * @property {string} [place] Dónde ha sido (el tablero, o la localización).
 * @property {number} [round]
 * @property {OutcomeMember[]} members
 * @property {{gold?: number, items?: OutcomeItem[]}} [loot]
 * @property {string} [time] La hora del juego («Día 3 · Tarde»).
 * @property {{kind: string, title: string, next?: string}|null} [step] D-J45: a dónde sigue
 *   (`afterFightStep`): `story`, `next`, `board` o `place`.
 * @property {string} [here] La localización (para «Volver a …»).
 * @property {{chests?: number, rooms?: number, clues?: number}|null} [leftovers] Lo que queda en el tablero.
 * @property {boolean} [canRest] Si se puede descansar aquí.
 * @property {OutcomeRescue|null} [rescue] Derrota: quién os recoge (sin nadie con vida, nada).
 * @property {boolean} [hard] D-J64: el modo de hierro (quien muere no vuelve).
 * @property {boolean} [checkpoint] Si hay un punto guardado al que volver.
 * @property {boolean} [saves] Si se puede cargar una partida guardada.
 * @property {boolean} [home] Si se puede volver al gremio.
 * @property {string} [failed] Derrota sin caer: lo que dice la misión («El ratero ha escapado»).
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {number} */
const num = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

/**
 * «uno», «dos» y «tres»: lo que se lee mejor que la cifra en una frase corta.
 *
 * @param {number} n
 * @param {string} one
 * @param {string} many
 * @returns {string}
 */
function counted(n, one, many) {
    const words = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco'];
    const said = n < words.length ? words[n] : String(n);
    return `${said} ${n === 1 ? one : many}`;
}

/**
 * «A», «A y B», «A, B y C».
 *
 * @param {string[]} list
 * @returns {string}
 */
function listed(list) {
    const parts = list.filter(Boolean);
    if (parts.length <= 1) return parts[0] ?? '';
    return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
}

/**
 * Cómo ha quedado alguien: en pie, magullado, malherido, inconsciente o muerto.
 *
 * @param {OutcomeMember} member
 * @param {{hard?: boolean}} [options]
 * @returns {{label: string, tone: 'ok'|'wound'|'down'|'dead', icon: string}}
 */
export function memberState(member, { hard = false } = {}) {
    const female = text(member?.gender).toLowerCase().startsWith('f');
    const word = (/** @type {string} */ male, /** @type {string} */ fem) => (female ? fem : male);
    if (member?.dead) {
        return { label: hard && member.confidant ? word('Muerto para siempre', 'Muerta para siempre') : word('Muerto', 'Muerta'), tone: 'dead', icon: 'fa-skull' };
    }
    const hp = num(member?.hp);
    const max = Math.max(1, num(member?.maxHp));
    if (hp <= 0) return { label: 'Inconsciente', tone: 'down', icon: 'fa-bed' };
    if (hp <= max / 2) return { label: word('Malherido', 'Malherida'), tone: 'wound', icon: 'fa-droplet' };
    if (hp < max) return { label: word('Magullado', 'Magullada'), tone: 'wound', icon: 'fa-bandage' };
    return { label: 'En pie', tone: 'ok', icon: 'fa-check' };
}

/**
 * Una herida, dicha corta: «Pierna rota (para siempre)», «Tobillo torcido (3 días)».
 *
 * @param {OutcomeInjury} injury
 * @returns {{label: string, permanent: boolean}}
 */
export function injuryLine(injury) {
    const permanent = Boolean(injury?.permanent);
    const days = Math.max(0, Math.round(num(injury?.daysLeft)));
    const when = permanent ? 'para siempre' : days > 0 ? `${days} ${days === 1 ? 'día' : 'días'}` : '';
    return { label: `${text(injury?.label) || 'Herida'}${when ? ` (${when})` : ''}`, permanent };
}

/**
 * De qué tipo es algo del botín, para su etiqueta: misión, material o su rareza (común si no).
 *
 * @param {OutcomeItem} item
 * @returns {{kind: 'mision'|'material'|'comun'|'poco-comun'|'rara'|'muy-rara'|'legendaria', label: string}}
 */
export function lootKind(item) {
    const name = text(item?.name);
    if (item?.quest || /^llave\b/i.test(name)) return { kind: 'mision', label: 'Misión' };
    if (text(item?.subcategory) === 'material' || text(item?.type) === 'material') return { kind: 'material', label: 'Material' };
    const rarity = text(item?.rarity).toLowerCase().replace(/[\s_]+/g, '-');
    if (rarity === 'uncommon' || rarity === 'poco-común' || rarity === 'poco-comun') return { kind: 'poco-comun', label: 'Poco común' };
    if (rarity === 'rare' || rarity === 'rara' || rarity === 'raro') return { kind: 'rara', label: 'Rara' };
    if (rarity === 'very-rare' || rarity === 'muy-rara' || rarity === 'muy-raro') return { kind: 'muy-rara', label: 'Muy rara' };
    if (rarity === 'legendary' || rarity === 'legendaria' || rarity === 'legendario') return { kind: 'legendaria', label: 'Legendaria' };
    return { kind: 'comun', label: 'Común' };
}

/**
 * El icono de algo del botín, si no tiene dibujo.
 *
 * @param {OutcomeItem} item
 * @returns {string}
 */
export function lootIcon(item) {
    const name = text(item?.name).toLowerCase();
    const type = text(item?.type).toLowerCase();
    if (/^llave\b/.test(name)) return 'fa-key';
    if (text(item?.subcategory) === 'material') return /piel|cuero|pelaje/.test(name) ? 'fa-scroll' : 'fa-bone';
    if (type === 'weapon' || /espada|daga|hacha|maza|lanza|arco|ballesta/.test(name)) return 'fa-khanda';
    if (type === 'armor' || /escudo|armadura|cota/.test(name)) return 'fa-shield-halved';
    if (type === 'potion' || /poci[oó]n|elixir|t[oó]nico/.test(name)) return 'fa-flask';
    if (/pergamino|carta|mapa|libro|nota/.test(name)) return 'fa-scroll';
    if (/anillo|amuleto|colgante|collar/.test(name)) return 'fa-ring';
    if (/gema|joya|diamante|rub[ií]|perla/.test(name)) return 'fa-gem';
    return 'fa-box';
}

/**
 * Quién os recoge tras caer todo el grupo, dónde despertáis y lo que cobran: en el gremio, los
 * del gremio; en una campaña, la gente del sitio. Diez de oro por cada uno de los vuestros que
 * sigue con vida, o lo que llevéis si es menos.
 *
 * @param {{inHub?: boolean, place?: string, alive: number, purse: number}} input
 * @returns {OutcomeRescue}
 */
export function rescueFor({ inHub = false, place = '', alive, purse }) {
    const where = text(place);
    const wanted = Math.max(0, Math.round(num(alive))) * RESCUE_FEE_EACH;
    return {
        who: inHub ? 'Los del gremio' : where ? `La gente de ${where}` : 'Unos viajeros',
        where: inHub ? 'la enfermería del gremio' : where || 'un sitio seguro',
        cost: Math.min(wanted, Math.max(0, Math.floor(num(purse)))),
        wanted,
        days: RESCUE_DAYS,
    };
}

/**
 * Lo que queda en el tablero, dicho: «Quedan 2 cofres y 1 puerta por abrir».
 *
 * @param {{chests?: number, rooms?: number, clues?: number}|null|undefined} leftovers
 * @returns {string}
 */
export function leftoversLine(leftovers) {
    const chests = Math.max(0, Math.round(num(leftovers?.chests)));
    const rooms = Math.max(0, Math.round(num(leftovers?.rooms)));
    const clues = Math.max(0, Math.round(num(leftovers?.clues)));
    const parts = [
        chests ? counted(chests, 'cofre', 'cofres') : '',
        rooms ? counted(rooms, 'puerta', 'puertas') : '',
        clues ? counted(clues, 'pista', 'pistas') : '',
    ].filter(Boolean);
    if (parts.length === 0) return '';
    const total = chests + rooms + clues;
    return `${total === 1 ? 'Queda' : 'Quedan'} ${listed(parts)} por mirar.`;
}

/**
 * Lo que se pinta de alguien: su fila del balance.
 *
 * @param {OutcomeMember} member
 * @param {{hard?: boolean, victory?: boolean}} options
 */
function memberRow(member, { hard = false, victory = true }) {
    const max = Math.max(1, num(member.maxHp));
    const hp = member.dead ? 0 : Math.max(0, num(member.hp));
    const pct = Math.round(Math.max(0, Math.min(100, (hp / max) * 100)));
    const level = Math.max(1, Math.round(num(member.level) || 1));
    const role = member.guest
        ? `${text(member.className) || 'Invitado'} · de paso`
        : `${text(member.className) || 'Aventurero'} · nivel ${level}`;
    const state = memberState(member, { hard });
    const scars = (Array.isArray(member.injuries) ? member.injuries : []).map(injuryLine);
    const xp = Math.max(0, Math.round(num(member.xp)));
    const next = Math.round(num(member.nextLevel));
    return {
        id: text(member.id),
        name: text(member.name),
        face: text(member.face),
        initial: text(member.name).slice(0, 1).toUpperCase() || '?',
        role,
        hp,
        max,
        pct,
        hpText: `${hp}/${max} PG`,
        hpTone: hp <= 0 ? 'fallen' : hp <= max / 2 ? 'low' : hp < max ? 'hurt' : 'full',
        state,
        // Lo de esta pelea (cayó a 0 PG) y lo que se queda.
        fell: Boolean(member.downed) && !member.dead,
        scars,
        xpText: victory && xp > 0 ? `+${xp} PX` : '',
        levelUp: victory && next > level ? `Subir a nivel ${next}` : '',
        nextLevel: next > level ? next : 0,
    };
}

/**
 * La pantalla entera: lo que dice y los botones que tiene ahora.
 *
 * @param {OutcomeInput} input
 */
export function outcomeView(input) {
    const victory = input.kind === 'victory';
    const hard = Boolean(input.hard);
    const place = text(input.place);
    const round = Math.max(1, Math.round(num(input.round) || 1));
    const members = (Array.isArray(input.members) ? input.members : []).map(m => memberRow(m, { hard, victory }));
    const allDead = members.length > 0 && (input.members ?? []).every(m => m.dead);
    const where = place ? `en ${place}` : '';

    if (victory) {
        const gold = Math.max(0, Math.round(num(input.loot?.gold)));
        const items = (Array.isArray(input.loot?.items) ? input.loot.items : []).filter(i => text(i?.name)).map(item => ({
            name: text(item.name), art: text(item.art), icon: lootIcon(item), ...lootKind(item),
        }));
        const leftovers = leftoversLine(input.leftovers);
        const step = input.step ?? null;
        const hurt = (input.members ?? []).some(m => !m.dead && num(m.hp) < num(m.maxHp));
        /** @type {OutcomeButton[]} */
        const buttons = [];
        if (hurt && input.canRest !== false) {
            buttons.push({ id: 'rest', label: 'Descanso corto', icon: 'fa-bed', tone: 'subtle', title: 'Gastáis dados de golpe para curaros; pasa una parte del día.' });
        }
        // D-J45: lo que toca después. Si es volver al tablero (o nada), y queda algo por mirar, el
        // botón grande es registrar la sala.
        const stays = !step || step.kind === 'board';
        if (leftovers && !stays) {
            buttons.push({ id: 'search', label: 'Registrar la sala', icon: 'fa-box-open', tone: 'subtle', title: leftovers });
        }
        const here = text(input.here);
        const main = step?.kind === 'story' ? { label: 'Seguir con la historia', icon: 'fa-book-open' }
            : step?.kind === 'next' ? { label: text(step.next) ? `Lo siguiente: ${text(step.next)}` : 'Lo siguiente', icon: 'fa-arrow-right' }
                : step?.kind === 'place' ? { label: here ? `Volver a ${here}` : 'Seguir', icon: 'fa-arrow-right' }
                    : leftovers ? { label: 'Registrar la sala', icon: 'fa-box-open' }
                        : { label: 'Seguir', icon: 'fa-arrow-right' };
        buttons.push({ id: 'continue', ...main, tone: 'gold', title: text(step?.title) || main.label, main: true });
        return {
            kind: /** @type {'victory'} */ ('victory'),
            title: 'Victoria',
            sub: `Encuentro superado${where ? ` ${where}` : ''} · ronda ${round}`,
            crest: 'fa-shield-halved',
            rosterTitle: 'Balance de la compañía',
            members,
            lootTitle: 'Botín',
            gold: gold > 0 ? `+${gold} de oro` : '',
            items,
            emptyLoot: gold > 0 || items.length > 0 ? '' : 'Nada que llevarse.',
            cost: null,
            note: { icon: 'fa-clock', text: [text(input.time), leftovers].filter(Boolean).join(' · ') },
            hardNote: '',
            buttons,
        };
    }

    // ---- Derrota
    const fellNames = (input.members ?? []).filter(m => m.dead || num(m.hp) <= 0).map(m => text(m.name));
    const hardNote = hard ? 'Modo de hierro: quien muere no vuelve, tampoco un confidente.' : '';
    /** @type {OutcomeButton[]} */
    const buttons = [];
    /** @type {{title: string, purse: string, lines: Array<{icon: string, title: string, text: string}>}|null} */
    let cost = null;
    let title = 'El grupo ha caído';
    let sub = `${place ? `En ${place}` : 'En la pelea'} · ronda ${round}`;
    let rosterTitle = 'Bajas y secuelas';
    let note = '';
    if (text(input.failed) && fellNames.length < (input.members ?? []).length) {
        // La misión se ha perdido, pero el grupo sigue en pie.
        title = 'La misión ha fracasado';
        sub = `${text(input.failed)}${place ? ` · ${place}` : ''}`;
        rosterTitle = 'Balance de la compañía';
        buttons.push({ id: 'close', label: 'Seguir', icon: 'fa-arrow-right', tone: 'red', main: true });
    } else if (allDead) {
        title = members.length === 1 ? `${members[0].name} ha muerto` : 'Ha caído todo el grupo';
        rosterTitle = 'Bajas';
        note = 'Sin nadie con vida, la campaña no puede seguir.';
        if (input.checkpoint) buttons.push({ id: 'back', label: 'Volver al punto guardado', icon: 'fa-clock-rotate-left', tone: 'red', className: 'pf-back', main: true });
        if (input.saves) buttons.push({ id: 'load', label: 'Cargar partida', icon: 'fa-floppy-disk', tone: buttons.length ? 'subtle' : 'red', className: 'pf-load', main: buttons.length === 0 });
        if (input.home) buttons.push({ id: 'home', label: 'Volver al gremio', icon: 'fa-house-flag', tone: buttons.length ? 'subtle' : 'red', className: 'pf-home', main: buttons.length === 0 });
        if (buttons.length === 0) buttons.push({ id: 'close', label: 'Cerrar', icon: 'fa-xmark', tone: 'red', main: true });
    } else {
        const rescue = input.rescue ?? null;
        if (rescue) {
            const lines = [
                { icon: 'fa-hand-holding-medical', title: 'Quién os recoge', text: `${rescue.who}. Os sacan de allí y os curan.` },
                {
                    icon: 'fa-coins', title: 'Lo que cobran',
                    text: rescue.cost >= rescue.wanted
                        ? `${rescue.cost} de oro, por el rescate y las curas.`
                        : `Piden ${rescue.wanted} de oro y se quedan con lo que lleváis: ${rescue.cost}.`,
                },
                { icon: 'fa-calendar-day', title: 'Tiempo en cama', text: rescue.days === 1 ? 'Un día entero. Despertáis a la mañana siguiente.' : `${rescue.days} días.` },
            ];
            cost = { title: 'El coste', purse: rescue.cost > 0 ? `−${rescue.cost} de oro` : '', lines };
            if (input.checkpoint) buttons.push({ id: 'back', label: 'Volver al punto guardado', icon: 'fa-clock-rotate-left', tone: 'subtle', className: 'pf-back' });
            buttons.push({ id: 'wake', label: `Despertar en ${rescue.where}`, icon: 'fa-bed-pulse', tone: 'red', main: true, title: `${rescue.days === 1 ? 'Un día' : `${rescue.days} días`} en cama` });
        } else {
            buttons.push({ id: 'close', label: 'Seguir', icon: 'fa-arrow-right', tone: 'red', main: true });
        }
        if (!hard && input.checkpoint) note = 'Si prefieres, puedes volver al punto guardado de antes.';
    }
    return {
        kind: /** @type {'defeat'} */ ('defeat'),
        title,
        sub,
        crest: 'fa-skull-crossbones',
        rosterTitle,
        members,
        lootTitle: '',
        gold: '',
        items: /** @type {Array<{name: string, art: string, icon: string, kind: string, label: string}>} */ ([]),
        emptyLoot: '',
        cost,
        note: { icon: hard ? 'fa-triangle-exclamation' : 'fa-circle-info', text: [hardNote, note].filter(Boolean).join(' ') },
        hardNote,
        buttons,
    };
}
