/**
 * Verbo + objeto + giro + recompensa = mision.
 *
 * Una tabla de recados da recados: «mata diez ratas» escrito de quince formas. Lo que
 * separa un recado de una mision es **el giro** —quien te contrata miente, lo que buscas
 * ya no esta alli, hay otro buscandolo— y por eso aqui es una columna y no un adorno.
 *
 * Doce verbos por veinte objetos por quince giros por diez recompensas son decenas de
 * miles de misiones escribiendo cincuenta y siete filas. Y ninguna se parece a la
 * anterior en lo unico que importa: en la decision que te obliga a tomar.
 *
 * La recompensa casi nunca es oro, a proposito (#150): un favor, un contacto o una llave
 * se recuerdan mas y son mucho mas faciles de equilibrar que una cifra.
 *
 * Lo que sale tiene **exactamente** los cuatro campos de la ficha de mision del editor
 * —nombre, donde se juega, acto y descripcion— y se puede cambiar antes de guardarla.
 *
 * Puro: recibe el compendio y el azar, y devuelve un borrador.
 *
 * Ver wiki/ALGORITMOS_GENERACION.md (#145-#158) y wiki/ROADMAP_COMPENDIO.md, B9.
 */

import { fillPattern } from './names.js';

/**
 * Que clase de cosa puede ser el objeto de una mision.
 *
 * `animado` y `cosa` era demasiado grueso: dejaba pasar «Entregar la cripta» y «Cerrar el
 * molino», que no se pueden leer en voz alta. Un verbo declara a cuales le pega, y esta
 * escrito en el archivo porque cambiar que se puede rescatar no deberia costar una linea
 * de JavaScript.
 */
export const SORTS = ['persona', 'bestia', 'cosa', 'sitio', 'idea'];

/**
 * @param {any} value
 * @returns {string}
 */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * Con mayuscula al principio, que es como se escribe el nombre de una mision.
 *
 * @param {string} value
 * @returns {string}
 */
function capitalise(value) {
    const clean = text(value);
    return clean ? clean[0].toUpperCase() + clean.slice(1) : '';
}

/**
 * «a el» es «al», y «de el» es «del».
 *
 * Pegar trozos escritos por separado produce esa costura, y es la que primero delata que
 * detras hay una maquina. Se arregla una vez aqui y no en cada fila del archivo, que es
 * donde alguien se olvidaria.
 *
 * @param {string} value
 * @returns {string}
 */
export function contract(value) {
    return text(value)
        .replace(/\ba el\b/g, 'al')
        .replace(/\bde el\b/g, 'del');
}

/**
 * Una mision entera.
 *
 * Devuelve null cuando la bateria no esta, y quien llama sigue con lo que hiciera antes.
 *
 * @param {Object} input
 * @param {any} input.compendium
 * @param {() => number} [input.random]
 * @param {number} [input.act]      En que acto cae. La ficha lo pide.
 * @param {string[]} [input.boards] Los tableros del mundo, para elegir donde se juega.
 *        Una mision que nombra un tablero inexistente no se puede guardar, asi que lo
 *        que no venga de aqui se queda en blanco.
 * @returns {{name: string, description: string, act: number, boardName: string,
 *   from: {verbo: string, objeto: string, giro: string, recompensa: string}}|null}
 */
export function writeQuest({ compendium, random = Math.random, act = 1, boards = [] }) {
    if (!compendium?.has?.('misiones')) return null;

    const verb = compendium.pick('misiones', { where: { kind: 'verbo' }, random });
    if (!verb) return null;

    // El verbo manda sobre el objeto: «escoltar el cargamento» vale y «convencer al pozo»
    // no. Se elige primero **que clase** de cosa —de las que el verbo admite— y luego cual
    // de esa clase, que es lo que evita que las clases grandes se coman a las pequenas.
    const wants = (Array.isArray(verb.wants) ? verb.wants : [text(verb.wants)])
        .map(text).filter((/** @type {string} */ sort) => SORTS.includes(sort));
    const sort = wants.length > 0
        ? wants[Math.floor(random() * wants.length) % wants.length]
        : '';

    const object = compendium.pick('misiones', {
        where: sort ? { kind: 'objeto', sort } : { kind: 'objeto' }, random,
    }) ?? compendium.pick('misiones', { where: { kind: 'objeto' }, random });
    if (!object) return null;

    // Un giro tampoco pega con todo: «no quiere que lo salven» pide alguien que pueda
    // querer, y «es una copia» pide algo que se pueda copiar. El giro que no diga nada
    // vale para cualquier cosa, que es la regla de siempre.
    const twist = compendium.pick('misiones', {
        where: { kind: 'giro', sort: text(object.sort) }, random,
    }) ?? compendium.pick('misiones', { where: { kind: 'giro' }, random });
    const reward = compendium.pick('misiones', { where: { kind: 'recompensa' }, random });

    const name = contract(capitalise(`${text(verb.name)} ${text(object.name)}`));

    const line = contract(fillPattern(text(verb.line) || '{objeto}', {
        objeto: [text(object.bare) || text(object.name)],
    }, random).replace(/\s+/g, ' ').trim());

    const description = [
        line,
        // El detalle es una oracion de relativo, asi que necesita su antecedente pegado
        // delante. Colgarla del final de la frase del verbo la ataba al sustantivo
        // equivocado: «quieren la campana de vuelta antes de que lo vendan, que dejo de
        // sonar» no lo escribe nadie.
        text(object.detail) ? contract(`Es ${text(object.bare)} ${text(object.detail)}.`) : '',
        text(twist?.note),
        text(reward?.note),
    ].filter(Boolean).join(' ');

    return {
        name,
        description,
        act: Math.max(1, Math.round(Number(act) || 1)),
        boardName: boards.length > 0
            ? text(boards[Math.floor(random() * boards.length) % boards.length])
            : '',
        from: {
            verbo: text(verb.id),
            objeto: text(object.id),
            giro: text(twist?.id),
            recompensa: text(reward?.id),
        },
    };
}

/**
 * Un tablon: varias misiones que no se parecen entre si.
 *
 * Tres recados con el mismo giro son el mismo recado tres veces, asi que lo que no se
 * repite es **la combinacion de verbo y giro**, que es de donde sale la sensacion de que
 * son cosas distintas.
 *
 * @param {Object} input
 * @param {any} input.compendium
 * @param {number} input.howMany
 * @param {() => number} [input.random]
 * @param {number} [input.act]
 * @param {string[]} [input.boards]
 * @returns {any[]}
 */
export function writeQuestBoard({ compendium, howMany, random = Math.random, act = 1, boards = [] }) {
    /** @type {any[]} */
    const out = [];
    const pairs = new Set();
    const twists = new Set();

    for (let i = 0; i < Math.max(0, howMany) * 6 && out.length < howMany; i++) {
        const quest = writeQuest({ compendium, random, act, boards });
        if (!quest) break;

        // Dos encargos sobre lo mismo se leen como uno repetido, y dos con el mismo giro
        // se juegan igual aunque cambie el objeto. Un tablon tiene que ofrecer opciones,
        // no variaciones.
        if (pairs.has(quest.from.objeto) || twists.has(quest.from.giro)) continue;

        pairs.add(quest.from.objeto);
        twists.add(quest.from.giro);
        out.push(quest);
    }

    return out;
}

/**
 * La mision en una linea, para el aviso de despues.
 *
 * @param {any} quest
 * @returns {string}
 */
export function describeQuest(quest) {
    if (!quest) return '';
    const bits = [text(quest.name), `acto ${quest.act}`];
    if (text(quest.boardName)) bits.push(text(quest.boardName));
    return bits.join(' · ');
}
