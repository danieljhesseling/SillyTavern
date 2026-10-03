/**
 * E8.5 y E8.6 de wiki/ROADMAP_ENTRETENIDO.md: por qué llevar mercenarios, y los que se ganan
 * su historia.
 *
 * **Por qué llevarlos (E8.5).** Al contratar se dice, en cuatro líneas, lo que cuesta y lo que
 * resuelve:
 * - **riesgo**: si cae, no vuelve; mejor él que uno de los tuyos en la mazmorra que da miedo;
 * - **disponibilidad**: siempre está, sin horarios ni heridas; y si alguno de los tuyos hoy no
 *   puede (herido, caído), se dice quién;
 * - **oficio**: lo que trae, y si es justo lo que le falta al grupo;
 * - **coste**: el oro al contratarle y, con la cuenta de la semana encendida, su sueldo.
 *
 * **Veteranos (E8.6).** Un mercenario que vuelve vivo de tres salidas (cada vuelta al gremio
 * desde una campaña) se gana su sitio: un apodo, un rasgo (una mejora de `level-perks.js`),
 * un recuerdo de lo que vivió con el grupo y una misión corta suya, que va al tablón con su
 * nombre (`personal-quests.js`). El cariño sale de jugar, como los soldados de *XCOM*.
 *
 * Puro: dice las razones, cuenta las salidas y decide el ascenso. Quien llama lo guarda,
 * pone la misión en el tablón y enseña la charla.
 */

import { PERKS, takePerk } from '../rules/level-perks.js';
import { readFeats } from './feats.js';
import { gendered } from './grammar.js';
import { personalQuestFor } from './personal-quests.js';

/** Las salidas con vida que hacen falta para ser veterano. */
export const VETERAN_TRIPS = 3;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string} */
const fold = (value) => text(value).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Lo que hace cada papel en el grupo, para decir qué trae un mercenario y qué os falta. */
const ROLES = [
    { id: 'frente', words: /guerrer|barbar|paladin|soldad|luchador|monj/, brings: 'Aguanta en primera fila y para los golpes que irían a los de atrás.', lacks: 'nadie aguanta delante' },
    { id: 'explora', words: /explorador|picaro|ladron|batidor/, brings: 'Ve las trampas, abre cerraduras y tira de lejos.', lacks: 'nadie ve las trampas ni abre cerraduras' },
    { id: 'cura', words: /clerig|druid|sanador|bardo/, brings: 'Cura y levanta a quien cae.', lacks: 'nadie cura' },
    { id: 'magia', words: /mago|hechicer|brujo|erudit/, brings: 'Hace magia: fuego, hielo y lo que no se para con una espada.', lacks: 'nadie hace magia' },
];

/**
 * El papel de una clase.
 *
 * @param {string} className
 * @returns {typeof ROLES[number]|null}
 */
function roleOf(className) {
    const key = fold(className);
    return ROLES.find(role => role.words.test(key)) ?? null;
}

/**
 * @typedef {Object} HireReason
 * @property {'riesgo'|'disponible'|'oficio'|'coste'} kind
 * @property {string} icon
 * @property {string} title
 * @property {string} text
 */

/**
 * Las razones para llevar a este mercenario, dichas al contratarle.
 *
 * @param {Object} input
 * @param {{name: string, className: string, fee: number, gender?: string, hired?: boolean}} input.offer
 * @param {any[]} input.party El grupo de ahora (el héroe primero).
 * @param {number} [input.wage] Lo que cobra cada semana (0 si la cuenta está apagada).
 * @param {number} [input.baseFee] Lo que costaría sin la rebaja de un maestro (E8.3), si la hay.
 * @param {string} [input.cheaperBy] Quién la consigue.
 * @returns {HireReason[]}
 */
export function hireReasons({ offer, party, wage = 0, baseFee = 0, cheaperBy = '' }) {
    const name = text(offer?.name) || 'Este mercenario';
    const short = name.split(/\s+/)[0];
    const he = gendered(offer?.gender ?? '', 'él', 'ella', 'él');
    const people = (Array.isArray(party) ? party : []).filter(m => m && !m.guest);
    // Los tuyos (no el héroe) que hoy no pueden: caídos o con una herida que aún no se cierra.
    const away = people.slice(1)
        .filter(m => m.dead || (Array.isArray(m.injuries) && m.injuries.some((/** @type {any} */ i) => !i?.permanent && (Number(i?.daysLeft) || 0) > 0)))
        .map(m => `${text(m.name)} (${m.dead ? gendered(m, 'caído', 'caída') : gendered(m, 'herido', 'herida')})`);
    const role = roleOf(offer?.className);
    const covered = new Set(people.filter(m => !m.dead).map(m => roleOf(text(m.charClass ?? m.class ?? m.className))?.id).filter(Boolean));
    const lacking = role && !covered.has(role.id);
    const fee = Math.max(0, Math.floor(Number(offer?.fee) || 0));
    const weekly = Math.max(0, Math.floor(Number(wage) || 0));
    const cheaper = baseFee > fee && text(cheaperBy) ? ` (${baseFee - fee} menos: lo consigue ${text(cheaperBy)})` : '';
    return [
        {
            kind: 'riesgo', icon: 'fa-skull', title: 'El riesgo',
            text: `Viene por la paga: si cae, no vuelve, y no es uno de los tuyos. A la mazmorra que da miedo, mejor ${he}.`,
        },
        {
            kind: 'disponible', icon: 'fa-calendar-check', title: 'Siempre está',
            text: away.length > 0
                ? `No tiene horarios ni heridas que esperar. Hoy no pueden venir: ${away.join(', ')}.`
                : 'No tiene horarios ni heridas que esperar, y nunca dice que no.',
        },
        {
            kind: 'oficio', icon: 'fa-screwdriver-wrench', title: 'Su oficio',
            text: role
                ? `${role.brings}${lacking ? ` Os viene justo: ahora ${role.lacks}.` : ''}`
                : `${short} pelea como uno más.`,
        },
        {
            kind: 'coste', icon: 'fa-coins', title: 'Lo que cuesta',
            text: `${fee} de oro al contratarle${cheaper}${weekly > 0 ? ` y ${weekly} cada semana` : ''}. Los tuyos no cobran.`,
        },
    ];
}

/**
 * @typedef {Object} VeteranState
 * @property {number} trips Las salidas de las que ha vuelto con vida.
 * @property {string[]} campaigns Dónde estuvo, sin repetir.
 * @property {boolean} promoted
 * @property {string} trait La mejora que ganó (id de `PERKS`).
 * @property {string} memory
 * @property {string} mission El título de su misión.
 */

/**
 * @param {any} member
 * @returns {VeteranState}
 */
export function readVeteran(member) {
    const raw = member?.veteran && typeof member.veteran === 'object' ? member.veteran : {};
    return {
        trips: Math.max(0, Math.floor(Number(raw.trips) || 0)),
        campaigns: (Array.isArray(raw.campaigns) ? raw.campaigns : []).map(text).filter(Boolean),
        promoted: Boolean(raw.promoted),
        trait: text(raw.trait),
        memory: text(raw.memory),
        mission: text(raw.mission),
    };
}

/**
 * Si es un mercenario del gremio (los que se ganan el ascenso).
 *
 * @param {any} member
 * @returns {boolean}
 */
export function isMercenary(member) {
    return member?.guest?.kind === 'mercenary';
}

/**
 * Una salida más para los mercenarios vivos del grupo: al volver al gremio desde una campaña.
 *
 * @param {any[]} party
 * @param {string} campaign Dónde fue.
 * @returns {any[]} El grupo, con la cuenta de cada uno al día.
 */
export function noteTrip(party, campaign) {
    return (Array.isArray(party) ? party : []).map(member => {
        if (!isMercenary(member) || member.dead) return member;
        const vet = readVeteran(member);
        const where = text(campaign);
        return {
            ...member,
            veteran: {
                ...vet,
                trips: vet.trips + 1,
                campaigns: where && !vet.campaigns.includes(where) ? [...vet.campaigns, where] : vet.campaigns,
            },
        };
    });
}

/**
 * Los que acaban de ganarse el ascenso.
 *
 * @param {any[]} party
 * @returns {any[]}
 */
export function dueVeterans(party) {
    return (Array.isArray(party) ? party : [])
        .filter(m => isMercenary(m) && !m.dead && !readVeteran(m).promoted && readVeteran(m).trips >= VETERAN_TRIPS);
}

/** Apodos de veterano, por papel: `[él, ella]`. */
const NICKS = {
    frente: [['el Muro', 'la Muralla'], ['Rompeescudos', 'Rompeescudos'], ['el Yunque', 'la Yunque']],
    explora: [['Ojo de Halcón', 'Ojo de Halcón'], ['Pasoquedo', 'Pasoquedo'], ['el Zorro', 'la Zorra Vieja']],
    cura: [['Manos Santas', 'Manos Santas'], ['el Remiendo', 'la Remiendos']],
    magia: [['Chispas', 'Chispas'], ['el Sabio', 'la Sabia']],
    otro: [['Cien Caminos', 'Cien Caminos'], ['el Superviviente', 'la Superviviente']],
};

/** El rasgo que gana, por papel: el primero que no tenga. */
const TRAITS = {
    frente: ['piel-dura', 'aguante', 'brazo-fuerte'],
    explora: ['ojo-avizor', 'reflejos', 'paso-de-gato'],
    cura: ['buen-ojo', 'aguante', 'labia'],
    magia: ['buen-ojo', 'reflejos', 'labia'],
    otro: ['aguante', 'reflejos', 'mano-firme'],
};

/** Lo que busca su misión, por papel. */
const WANTS = { frente: 'glory', explora: 'coin', cura: 'quiet', magia: 'knowledge', otro: 'blood' };

/**
 * Lo que recuerda de lo vivido con el grupo, en una frase dicha por él.
 *
 * @param {any} member
 * @param {string[]} campaigns
 * @param {string} heroName
 * @returns {string}
 */
export function veteranMemory(member, campaigns, heroName = '') {
    const feats = readFeats(member);
    const where = campaigns.length > 1
        ? `${campaigns.slice(0, -1).join(', ')} y ${campaigns[campaigns.length - 1]}`
        : campaigns[0] || 'el camino';
    const you = text(heroName) ? `, ${text(heroName)}` : '';
    const deed = feats.rescues > 0 ? 'la vez que me puse delante de ti y aguanté'
        : feats.downed > 0 ? `las ${feats.downed === 1 ? 'una vez' : `${feats.downed} veces`} que caí y me levantasteis`
            : feats.kills > 0 ? `los ${feats.kills} que tumbamos juntos`
                : 'las noches de guardia sin dormir';
    return `No olvido ${where}${you}. Ni ${deed}.`;
}

/**
 * El ascenso de un veterano: apodo, rasgo, recuerdo y misión.
 *
 * @param {any} member
 * @param {Object} input
 * @param {() => number} input.random Con la semilla de la partida y de quien asciende.
 * @param {string[]} input.places Los sitios conocidos (para su misión).
 * @param {string} [input.here]
 * @param {string[]} [input.bestiary]
 * @param {number} [input.day]
 * @param {string} [input.heroName]
 * @returns {{patch: Record<string, any>, nickname: string, trait: {id: string, label: string, describe: string}|null, memory: string, mission: any}}
 */
export function promoteVeteran(member, { random, places, here = '', bestiary = [], day = 1, heroName = '' }) {
    const vet = readVeteran(member);
    const roleId = /** @type {keyof typeof NICKS} */ (roleOf(text(member?.class ?? member?.className ?? member?.charClass))?.id ?? 'otro');
    const pool = NICKS[roleId];
    const pair = pool[Math.floor(random() * pool.length) % pool.length];
    const nickname = text(member?.nickname) || gendered(member, pair[0], pair[1], pair[0]);
    const owned = new Set((Array.isArray(member?.perks) ? member.perks : []).map(String));
    const traitId = TRAITS[roleId].find(id => !owned.has(id)) ?? '';
    const trait = PERKS.find(p => p.id === traitId) ?? null;
    const memory = veteranMemory(member, vet.campaigns, heroName);
    const mission = personalQuestFor({
        member, wants: WANTS[roleId], places, here, bestiary, random, day,
    });
    // Que se vea en el tablón que es de un veterano: su id y su nombre con el apodo.
    const said = `${text(member?.name)} «${nickname}»`;
    const contract = { ...mission, id: `v_${String(member?.id ?? text(member?.name))}`, title: mission.title.replace(text(member?.name), said), patron: said, veteran: true };
    const perkPatch = traitId ? takePerk(member, traitId) ?? {} : {};
    return {
        patch: {
            ...perkPatch,
            nickname,
            veteran: { ...vet, promoted: true, trait: traitId, memory, mission: contract.title },
        },
        nickname,
        trait: trait ? { id: trait.id, label: trait.label, describe: trait.describe } : null,
        memory,
        mission: contract,
    };
}

/**
 * La charla del ascenso: la dice el veterano, sin narrador (D-J60).
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {string} input.nickname
 * @param {{label: string, describe: string}|null} input.trait
 * @param {string} input.memory
 * @param {any} input.mission
 * @returns {import('./meetups.js').Scene}
 */
export function veteranScene({ member, nickname, trait, memory, mission }) {
    const name = text(member?.name) || 'Tu mercenario';
    const trips = readVeteran(member).trips;
    const words = ['Ninguna', 'Una', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho', 'Nueve', 'Diez'];
    const said = trips < words.length ? words[trips] : String(trips);
    return {
        id: `veterano-${fold(name).replace(/[^a-z0-9]+/g, '-')}`,
        kind: 'charla',
        who: name,
        key: fold(name),
        campaign: '',
        rank: 1,
        title: `${name}, veterano`,
        where: 'gremio',
        beats: [
            {
                note: '',
                say: `${said} ${trips === 1 ? 'salida' : 'salidas'} y aquí sigo. En el gremio ya me llaman «${nickname}», ¿sabes? ${memory}`,
                mood: 'alegre',
                replies: [],
            },
            {
                note: '',
                say: `${trait ? `Algo he aprendido por el camino: ${trait.label.toLowerCase()} (${trait.describe.replace(/\.$/, '').toLowerCase()}). ` : ''}`
                    + `Y tengo una cosa mía que arreglar: ${String(mission?.title ?? '').replace(/^.*? quiere /, 'quiero ').replace(/^.*? busca /, 'busco ')}. Lo he dejado en el tablón. ¿Me echas una mano?`,
                mood: 'neutral',
                replies: [
                    { text: 'Cuenta conmigo.', bond: 0, mood: 'alegre', gold: 0, then: 'Sabía que podía contar contigo. Cuando quieras, salimos.' },
                    { text: 'Más adelante.', bond: 0, mood: 'neutral', gold: 0, then: 'Vale. El papel no se va a ninguna parte.' },
                ],
            },
        ],
    };
}
