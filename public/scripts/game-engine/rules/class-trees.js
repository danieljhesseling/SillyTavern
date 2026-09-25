/**
 * Un árbol pequeño por clase: tres ramas de tres (idea 48).
 *
 * Con las mejoras sueltas (idea 46), dos guerreros de nivel 5 acababan siendo el mismo
 * guerrero con los números en otro orden. Ahora cada oficio tiene tres caminos, y al subir
 * de nivel se elige por cuál seguir: el siguiente paso de cada rama. Una rama se sube en
 * orden (primero el 1, luego el 2), así que elegir es comprometerse.
 *
 * Los efectos son los mismos que los de las mejoras sueltas (`level-perks.js`), así que se
 * notan en los mismos sitios: vida, iniciativa, ataque, CA, velocidad y habilidades.
 *
 * Puro: datos, y qué rama le toca a quién.
 */

/** @param {any} value @returns {string} */
const plain = (value) => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * @typedef {{maxHp?: number, speed?: number, initiative?: number, attack?: number, armorClass?: number, skill?: string, amount?: number}} Effect
 * @typedef {{id: string, label: string, describe: string, effect: Effect, branch: string, tier: number}} TreeNode
 */

/** @param {string} family @param {string} branch @param {Array<[string, string, Effect]>} nodes @returns {TreeNode[]} */
const branchOf = (family, branch, nodes) => nodes.map(([label, describe, effect], i) => ({
    id: `rama:${family}:${branch}:${i + 1}`, label, describe, effect, branch, tier: i + 1,
}));

/** Los árboles, por familia de oficio. */
export const TREES = {
    marcial: {
        label: 'Armas',
        branches: {
            baluarte: { label: 'Baluarte', nodes: branchOf('marcial', 'baluarte', [
                ['Guardia alta', '+1 a la CA.', { armorClass: 1 }],
                ['Cuero curtido', '+6 PG máximos.', { maxHp: 6 }],
                ['Muralla', '+1 a la CA.', { armorClass: 1 }],
            ]) },
            filo: { label: 'Filo', nodes: branchOf('marcial', 'filo', [
                ['Golpe seco', '+1 al ataque.', { attack: 1 }],
                ['Primero en entrar', '+2 a la iniciativa.', { initiative: 2 }],
                ['Maestro de armas', '+1 al ataque.', { attack: 1 }],
            ]) },
            mando: { label: 'Mando', nodes: branchOf('marcial', 'mando', [
                ['Voz de mando', '+2 a Intimidación.', { skill: 'intimidation', amount: 2 }],
                ['Ojo de sargento', '+2 a Percepción.', { skill: 'perception', amount: 2 }],
                ['Nadie se queda atrás', '+5 pies de velocidad.', { speed: 5 }],
            ]) },
        },
    },
    astuto: {
        label: 'Astucia',
        branches: {
            sombra: { label: 'Sombra', nodes: branchOf('astuto', 'sombra', [
                ['Pisada suave', '+2 a Sigilo.', { skill: 'stealth', amount: 2 }],
                ['Desaparecer', '+5 pies de velocidad.', { speed: 5 }],
                ['Golpe a traición', '+1 al ataque.', { attack: 1 }],
            ]) },
            lengua: { label: 'Lengua', nodes: branchOf('astuto', 'lengua', [
                ['Pico de oro', '+2 a Persuasión.', { skill: 'persuasion', amount: 2 }],
                ['Cara de póquer', '+2 a Engaño.', { skill: 'deception', amount: 2 }],
                ['Leer a la gente', '+2 a Perspicacia.', { skill: 'insight', amount: 2 }],
            ]) },
            manos: { label: 'Manos', nodes: branchOf('astuto', 'manos', [
                ['Dedos rápidos', '+2 a Juego de manos.', { skill: 'sleight', amount: 2 }],
                ['Siempre alerta', '+2 a la iniciativa.', { initiative: 2 }],
                ['Esquivo', '+1 a la CA.', { armorClass: 1 }],
            ]) },
        },
    },
    arcano: {
        label: 'Saber',
        branches: {
            estudio: { label: 'Estudio', nodes: branchOf('arcano', 'estudio', [
                ['Memoria de archivo', '+2 a Investigación.', { skill: 'investigation', amount: 2 }],
                ['Mente despierta', '+2 a la iniciativa.', { initiative: 2 }],
                ['Erudito', '+2 a Perspicacia.', { skill: 'insight', amount: 2 }],
            ]) },
            poder: { label: 'Poder', nodes: branchOf('arcano', 'poder', [
                ['Pulso firme', '+1 al ataque.', { attack: 1 }],
                ['Chispa', '+1 al ataque.', { attack: 1 }],
                ['Temple', '+4 PG máximos.', { maxHp: 4 }],
            ]) },
            velo: { label: 'Velo', nodes: branchOf('arcano', 'velo', [
                ['Escudo de voluntad', '+1 a la CA.', { armorClass: 1 }],
                ['Pasos ligeros', '+5 pies de velocidad.', { speed: 5 }],
                ['Ilusión', '+2 a Engaño.', { skill: 'deception', amount: 2 }],
            ]) },
        },
    },
    devoto: {
        label: 'Fe',
        branches: {
            amparo: { label: 'Amparo', nodes: branchOf('devoto', 'amparo', [
                ['Manos que curan', '+4 PG máximos.', { maxHp: 4 }],
                ['Fe de roca', '+1 a la CA.', { armorClass: 1 }],
                ['Aguante del peregrino', '+6 PG máximos.', { maxHp: 6 }],
            ]) },
            juicio: { label: 'Juicio', nodes: branchOf('devoto', 'juicio', [
                ['Brazo justo', '+1 al ataque.', { attack: 1 }],
                ['Mirada que pesa', '+2 a Intimidación.', { skill: 'intimidation', amount: 2 }],
                ['Castigo', '+1 al ataque.', { attack: 1 }],
            ]) },
            consejo: { label: 'Consejo', nodes: branchOf('devoto', 'consejo', [
                ['Escuchar', '+2 a Perspicacia.', { skill: 'insight', amount: 2 }],
                ['Palabra amable', '+2 a Persuasión.', { skill: 'persuasion', amount: 2 }],
                ['Vigilia', '+2 a Percepción.', { skill: 'perception', amount: 2 }],
            ]) },
        },
    },
    cazador: {
        label: 'Monte',
        branches: {
            rastro: { label: 'Rastro', nodes: branchOf('cazador', 'rastro', [
                ['Leer el rastro', '+2 a Supervivencia.', { skill: 'survival', amount: 2 }],
                ['Oído fino', '+2 a Percepción.', { skill: 'perception', amount: 2 }],
                ['Paso del lobo', '+5 pies de velocidad.', { speed: 5 }],
            ]) },
            arco: { label: 'Arco', nodes: branchOf('cazador', 'arco', [
                ['Tiro tenso', '+1 al ataque.', { attack: 1 }],
                ['Primero en ver', '+2 a la iniciativa.', { initiative: 2 }],
                ['Ojo de halcón', '+1 al ataque.', { attack: 1 }],
            ]) },
            monte: { label: 'Monte', nodes: branchOf('cazador', 'monte', [
                ['Piel de intemperie', '+4 PG máximos.', { maxHp: 4 }],
                ['Sigilo del monte', '+2 a Sigilo.', { skill: 'stealth', amount: 2 }],
                ['Duro de roer', '+1 a la CA.', { armorClass: 1 }],
            ]) },
        },
    },
};

/** Todos los pasos de todos los árboles. */
export const TREE_NODES = Object.values(TREES).flatMap(tree => Object.values(tree.branches).flatMap(branch => branch.nodes));

/**
 * La familia de oficio de alguien, por su clase, o vacío si no tiene árbol.
 *
 * @param {any} member
 * @returns {string}
 */
export function familyOf(member) {
    const kind = plain(member?.class ?? member?.charClass ?? member?.className);
    if (/guerr|soldad|barbar|paladin|fighter|caballer|mercenari/.test(kind)) return 'marcial';
    if (/picar|ladron|bardo|rogue|bard|contraband|asesin/.test(kind)) return 'astuto';
    if (/mago|maga|brujo|bruja|hechicer|wizard|sorcer|warlock|alquim/.test(kind)) return 'arcano';
    if (/cleri|sacerd|monj|druid|curand|acolit/.test(kind)) return 'devoto';
    if (/explor|montaraz|cazad|ranger|guardabosq/.test(kind)) return 'cazador';
    return '';
}

/**
 * Lo que se ofrece al subir: el siguiente paso de cada rama de su árbol.
 *
 * @param {any} member
 * @returns {TreeNode[]}
 */
export function nextTreeSteps(member) {
    const tree = TREES[/** @type {keyof typeof TREES} */ (familyOf(member))];
    if (!tree) return [];
    const taken = new Set((Array.isArray(member?.perks) ? member.perks : []).map(String));
    return Object.values(tree.branches).flatMap(branch => {
        const next = branch.nodes.find(node => !taken.has(node.id));
        if (!next) return [];
        const before = branch.nodes.filter(node => node.tier < next.tier);
        return before.every(node => taken.has(node.id)) ? [next] : [];
    });
}

/**
 * Lo andado de cada rama, para la ficha: «Baluarte 2/3».
 *
 * @param {any} member
 * @returns {string[]}
 */
export function describeTree(member) {
    const tree = TREES[/** @type {keyof typeof TREES} */ (familyOf(member))];
    if (!tree) return [];
    const taken = new Set((Array.isArray(member?.perks) ? member.perks : []).map(String));
    return Object.values(tree.branches)
        .map(branch => ({ label: branch.label, done: branch.nodes.filter(n => taken.has(n.id)).length }))
        .filter(b => b.done > 0)
        .map(b => `${b.label} ${b.done}/3`);
}
