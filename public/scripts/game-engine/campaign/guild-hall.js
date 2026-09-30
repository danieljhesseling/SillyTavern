/**
 * La sala del gremio (J3.1 de wiki/ROADMAP_SIN_CONEXION.md): uno de los sitios del pueblo, con
 * todo lo que se hace en casa entre campaña y campaña, repartido por partes.
 *
 * - **El tablón**: las campañas (`/campanas`) y los encargos cortos (J3.8).
 * - **Tu gente**: tus personajes del gremio (J1.6) y las espadas de alquiler.
 * - **La casa**: el cofre y el arca (J3.4), el patio donde se entrena y se sube de nivel (J3.5) y
 *   los edificios (J3.6).
 * - **La memoria**: el Salón de la fama (J3.9).
 * - **La salida**: a la plaza, o de vuelta a la campaña que dejasteis a medias.
 *
 * Arriba, el rango del gremio y su renombre (J3.7), y si ha subido desde la última vez, la
 * noticia.
 *
 * Cada botón es una ficha del gremio (`hub-…`, las que da `party/hub.js`), con una línea que
 * dice cómo está esa parte («4 cosas en el cofre · 120 de oro en el arca»). Lo que no está
 * todavía (en el prólogo solo está «Saltar la prueba», D-J28) no sale.
 *
 * Puro: con las fichas y lo que se sabe de la sala, dice qué partes hay y qué pone en cada una.
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Las fichas nuevas de la sala: cuáles son, cómo se llaman y qué orden abren. Las pone
 * `hubChips` (party/hub.js) cuando ya se ha pasado la prueba, junto a las de siempre.
 */
export const HALL_CHIPS = [
    { id: 'hub-errands', label: 'Encargos del tablón', icon: 'fa-clipboard-list', command: '/encargos-gremio' },
    { id: 'hub-heroes', label: 'Tus personajes', icon: 'fa-users', command: '/personajes' },
    { id: 'hub-chest', label: 'El cofre', icon: 'fa-box-archive', command: '/cofre' },
    { id: 'hub-train', label: 'Entrenar y subir de nivel', icon: 'fa-dumbbell', command: '/entrenar-gremio' },
    { id: 'hub-house', label: 'Los edificios', icon: 'fa-house-chimney', command: '/casa-gremio' },
];

/** Las partes de la sala, en orden, con las fichas que van en cada una. */
export const HALL_SECTIONS = [
    { id: 'tablon', title: 'El tablón', chips: ['hub-skip', 'hub-board', 'hub-errands'] },
    { id: 'gente', title: 'Tu gente', chips: ['hub-heroes', 'hub-hire'] },
    { id: 'casa', title: 'La casa', chips: ['hub-chest', 'hub-train', 'hub-house'] },
    { id: 'memoria', title: 'La memoria del gremio', chips: ['hub-hall', 'hub-memory'] },
];

/**
 * @typedef {Object} HallData Lo que se sabe de la sala, para las líneas de cada parte.
 * @property {{id: string, label: string, line: string}} [rank] El rango (`guildRank`).
 * @property {{line: string}|null} [news] Si ha subido de rango (`rankNews`).
 * @property {{used: number, slots: number, gold: number}} [chest]
 * @property {{ready: string[], can: boolean, why: string}} [training]
 * @property {{built: number, total: number}} [house]
 * @property {{offers: number, taken: string}} [errands]
 * @property {{resting: number}} [heroes]
 * @property {{open: number, locked: number, inProgress: Array<{id: string, name: string}>}} [campaigns]
 */

/**
 * @typedef {Object} HallAct
 * @property {string} id
 * @property {string} label
 * @property {string} icon
 * @property {string} detail Cómo está esa parte, en una línea (vacía si no hay nada que decir).
 * @property {any} [chip] La ficha que se pulsa.
 * @property {string} [campaign] La campaña que se sigue (en la salida).
 * @property {boolean} [exit] Salir a la plaza.
 */

/**
 * @param {number} n
 * @param {string} one
 * @param {string} many
 * @returns {string}
 */
function count(n, one, many) {
    return n === 1 ? `1 ${one}` : `${n} ${many}`;
}

/**
 * La línea de cada ficha, con lo que se sabe de la sala.
 *
 * @param {string} id
 * @param {HallData} hall
 * @returns {string}
 */
export function hallDetail(id, hall) {
    switch (id) {
        case 'hub-board': {
            const c = hall.campaigns;
            if (!c) return '';
            return [
                c.inProgress.length > 0 ? `En curso: ${c.inProgress.map(one => one.name).join(', ')}` : '',
                c.open > 0 ? count(c.open, 'por empezar', 'por empezar') : '',
                c.locked > 0 ? count(c.locked, 'cerrada hasta subir de rango', 'cerradas hasta subir de rango') : '',
            ].filter(Boolean).join(' · ');
        }
        case 'hub-errands': {
            const e = hall.errands;
            if (!e) return '';
            if (e.taken) return `Entre manos: «${e.taken}»`;
            return e.offers > 0 ? count(e.offers, 'encargo en el tablón', 'encargos en el tablón') : 'El tablón está vacío por ahora';
        }
        case 'hub-heroes': {
            const h = hall.heroes;
            if (!h) return '';
            return h.resting > 0 ? `${count(h.resting, 'descansa', 'descansan')} en el gremio` : 'Nadie más: puedes hacer otro';
        }
        case 'hub-chest': {
            const box = hall.chest;
            if (!box) return '';
            return [
                box.used > 0 ? `${count(box.used, 'cosa', 'cosas')} de ${box.slots}` : 'Vacío',
                box.gold > 0 ? `${box.gold} de oro en el arca` : '',
            ].filter(Boolean).join(' · ');
        }
        case 'hub-train': {
            const t = hall.training;
            if (!t) return '';
            if (t.ready.length === 1) return `${t.ready[0]} ya puede subir de nivel`;
            if (t.ready.length > 1) return `Pueden subir de nivel: ${t.ready.join(', ')}`;
            return t.can ? 'Se entrena por la mañana o por la tarde' : t.why;
        }
        case 'hub-house': {
            const h = hall.house;
            if (!h) return '';
            return h.built > 0 ? `${count(h.built, 'nivel levantado', 'niveles levantados')} de ${h.total}` : 'Nada levantado todavía';
        }
        default:
            return '';
    }
}

/**
 * Las partes de la sala con sus botones: las fichas del gremio que hay ahora, en su parte y
 * con su línea, y la salida.
 *
 * @param {Object} input
 * @param {any[]} input.chips Las fichas del gremio que da el juego ahora (`hub-…`).
 * @param {HallData} [input.hall]
 * @param {string} [input.town] El pueblo, para «Salir a la plaza de Puerto Alba».
 * @returns {Array<{id: string, title: string, acts: HallAct[]}>}
 */
export function hallSections({ chips, hall = {}, town = '' }) {
    const list = (Array.isArray(chips) ? chips : []).filter(chip => chip && text(chip.id).startsWith('hub-'));
    const placed = new Set(HALL_SECTIONS.flatMap(section => section.chips));
    /** @type {Array<{id: string, title: string, acts: HallAct[]}>} */
    const sections = HALL_SECTIONS.map(section => ({
        id: section.id,
        title: section.title,
        acts: section.chips
            .map(id => list.find(chip => chip.id === id))
            .filter(Boolean)
            .map(chip => ({ id: chip.id, label: text(chip.label), icon: text(chip.icon) || 'fa-circle', detail: hallDetail(chip.id, hall), chip })),
    }));
    // Las fichas del gremio que no son de ninguna parte (una nueva que aún no tiene sitio), con
    // el tablón: mejor ahí que perdidas.
    const loose = list.filter(chip => !placed.has(chip.id));
    if (loose.length > 0) {
        sections[0].acts.push(...loose.map(chip => ({ id: chip.id, label: text(chip.label), icon: text(chip.icon) || 'fa-circle', detail: '', chip })));
    }
    /** @type {HallAct[]} */
    const exit = [
        ...(hall.campaigns?.inProgress ?? []).slice(0, 2).map(one => ({
            id: `hub-continue:${one.id}`, label: `Seguir «${one.name}»`, icon: 'fa-route', detail: 'De vuelta a la campaña, donde la dejasteis.', campaign: one.id,
        })),
        { id: 'hub-exit', label: text(town) ? `Salir a la plaza de ${text(town)}` : 'Salir a la plaza', icon: 'fa-door-open', detail: '', exit: true },
    ];
    return [...sections.filter(section => section.acts.length > 0), { id: 'salida', title: 'La salida', acts: exit }];
}

/**
 * La cabecera de la sala: el rango, y la noticia si ha subido.
 *
 * @param {HallData} hall
 * @returns {{rank: string, line: string, news: string}}
 */
export function hallHeader(hall) {
    return {
        rank: text(hall?.rank?.id),
        line: text(hall?.rank?.line),
        news: text(hall?.news?.line),
    };
}
