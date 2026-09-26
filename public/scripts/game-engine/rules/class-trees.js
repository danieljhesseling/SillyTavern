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
 * R3 del roadmap de profundidad: **el tercer paso de cada rama enseña algo**, no suma un
 * número. Dos guerreros de nivel 6 se distinguen por lo que hacen: uno barre a todo lo que
 * tiene delante y el otro tumba a todo lo que tiene alrededor. Los de Saber y Fe enseñan
 * un conjuro del grimorio (R4).
 *
 * Puro: datos, y qué rama le toca a quién.
 */

/** @param {any} value @returns {string} */
const plain = (value) => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * @typedef {{maxHp?: number, speed?: number, initiative?: number, attack?: number, armorClass?: number, skill?: string, amount?: number, ability?: string}} Effect
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
                ['Embestida de escudo', 'Aprende Embestida de escudo: tumba a todo lo que tiene alrededor.', { ability: 'tec-embestida' }],
            ]) },
            filo: { label: 'Filo', nodes: branchOf('marcial', 'filo', [
                ['Golpe seco', '+1 al ataque.', { attack: 1 }],
                ['Primero en entrar', '+2 a la iniciativa.', { initiative: 2 }],
                ['Barrido', 'Aprende Barrido: un tajo en cono que alcanza a todo lo que tiene delante.', { ability: 'tec-barrido' }],
            ]) },
            mando: { label: 'Mando', nodes: branchOf('marcial', 'mando', [
                ['Voz de mando', '+2 a Intimidación.', { skill: 'intimidation', amount: 2 }],
                ['Ojo de sargento', '+2 a Percepción.', { skill: 'perception', amount: 2 }],
                ['Nadie se queda atrás', 'Aprende Cerrar filas: los de alrededor recobran el aliento.', { ability: 'tec-cerrar-filas' }],
            ]) },
        },
    },
    astuto: {
        label: 'Astucia',
        branches: {
            sombra: { label: 'Sombra', nodes: branchOf('astuto', 'sombra', [
                ['Pisada suave', '+2 a Sigilo.', { skill: 'stealth', amount: 2 }],
                ['Desaparecer', '+5 pies de velocidad.', { speed: 5 }],
                ['Bomba de humo', 'Aprende Bomba de humo: una nube en la que nadie ve.', { ability: 'tec-bomba-humo' }],
            ]) },
            lengua: { label: 'Lengua', nodes: branchOf('astuto', 'lengua', [
                ['Pico de oro', '+2 a Persuasión.', { skill: 'persuasion', amount: 2 }],
                ['Cara de póquer', '+2 a Engaño.', { skill: 'deception', amount: 2 }],
                ['Lengua de víbora', 'Aprende Burla que escuece, que también es una carta en las conversaciones.', { ability: 'hab-burla' }],
            ]) },
            manos: { label: 'Manos', nodes: branchOf('astuto', 'manos', [
                ['Dedos rápidos', '+2 a Juego de manos.', { skill: 'sleight', amount: 2 }],
                ['Siempre alerta', '+2 a la iniciativa.', { initiative: 2 }],
                ['Abrojos', 'Aprende Abrojos: un suelo por el que se pasa despacio.', { ability: 'tec-abrojos' }],
            ]) },
        },
    },
    arcano: {
        label: 'Saber',
        branches: {
            estudio: { label: 'Estudio', nodes: branchOf('arcano', 'estudio', [
                ['Memoria de archivo', '+2 a Investigación.', { skill: 'investigation', amount: 2 }],
                ['Mente despierta', '+2 a la iniciativa.', { initiative: 2 }],
                ['Leer la mentira', 'Aprende Detectar mentiras: hablando, se sabe quién miente.', { ability: 'mag-detectar-mentiras' }],
            ]) },
            poder: { label: 'Poder', nodes: branchOf('arcano', 'poder', [
                ['Pulso firme', '+1 al ataque.', { attack: 1 }],
                ['Chispa', '+1 al ataque.', { attack: 1 }],
                ['Relámpago', 'Aprende Relámpago: una línea que atraviesa a todos (2.º círculo).', { ability: 'mag-relampago' }],
            ]) },
            velo: { label: 'Velo', nodes: branchOf('arcano', 'velo', [
                ['Escudo de voluntad', '+1 a la CA.', { armorClass: 1 }],
                ['Pasos ligeros', '+5 pies de velocidad.', { speed: 5 }],
                ['Velo', 'Aprende Invisibilidad (2.º círculo).', { ability: 'mag-invisibilidad' }],
            ]) },
        },
    },
    devoto: {
        label: 'Fe',
        branches: {
            amparo: { label: 'Amparo', nodes: branchOf('devoto', 'amparo', [
                ['Manos que curan', '+4 PG máximos.', { maxHp: 4 }],
                ['Fe de roca', '+1 a la CA.', { armorClass: 1 }],
                ['Oración', 'Aprende Oración de curación: los de alrededor recobran vida (2.º círculo).', { ability: 'mag-oracion' }],
            ]) },
            juicio: { label: 'Juicio', nodes: branchOf('devoto', 'juicio', [
                ['Brazo justo', '+1 al ataque.', { attack: 1 }],
                ['Mirada que pesa', '+2 a Intimidación.', { skill: 'intimidation', amount: 2 }],
                ['Castigo', 'Aprende Ola de trueno: tumba a los de alrededor.', { ability: 'mag-ola-trueno' }],
            ]) },
            consejo: { label: 'Consejo', nodes: branchOf('devoto', 'consejo', [
                ['Escuchar', '+2 a Perspicacia.', { skill: 'insight', amount: 2 }],
                ['Palabra amable', '+2 a Persuasión.', { skill: 'persuasion', amount: 2 }],
                ['Vigilia', 'Aprende Luz: la noche da menos miedo.', { ability: 'mag-luz' }],
            ]) },
        },
    },
    cazador: {
        label: 'Monte',
        branches: {
            rastro: { label: 'Rastro', nodes: branchOf('cazador', 'rastro', [
                ['Leer el rastro', '+2 a Supervivencia.', { skill: 'survival', amount: 2 }],
                ['Oído fino', '+2 a Percepción.', { skill: 'perception', amount: 2 }],
                ['Trampa de lazo', 'Aprende Trampa de lazo: el primero que pasa se queda sujeto.', { ability: 'tec-lazo' }],
            ]) },
            arco: { label: 'Arco', nodes: branchOf('cazador', 'arco', [
                ['Tiro tenso', '+1 al ataque.', { attack: 1 }],
                ['Primero en ver', '+2 a la iniciativa.', { initiative: 2 }],
                ['Lluvia de flechas', 'Aprende Lluvia de flechas: cae sobre todo lo que hay en un círculo.', { ability: 'tec-lluvia-flechas' }],
            ]) },
            monte: { label: 'Monte', nodes: branchOf('cazador', 'monte', [
                ['Piel de intemperie', '+4 PG máximos.', { maxHp: 4 }],
                ['Sigilo del monte', '+2 a Sigilo.', { skill: 'stealth', amount: 2 }],
                ['Camuflaje', 'Aprende Camuflaje: quieto entre la maleza, el primer golpe va con ventaja.', { ability: 'tec-camuflaje' }],
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
