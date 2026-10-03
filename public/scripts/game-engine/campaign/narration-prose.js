/**
 * Las notas del motor, contadas (J13.1 y J18.10 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * Todo lo que el motor deja en el chat pasa por `postCombatNarration` o `postForModel`
 * (`party/narration.js`). Muchas de esas notas se escribieron como un registro: «Turno de
 * Irene (Jugador)», «❤️ Estado de Rata: 2/6», «Irene: 34 → 34 PG.», «Comida caliente para
 * todos (1 de oro).», «📋 Resumen final / HP aliados: Irene 34/34». Con modelo, el modelo las
 * lee y las cuenta; sin modelo, es lo que se lee en la caja de la novela.
 *
 * `noteProse` las cuenta como un narrador, con los mismos datos: «Le toca a Irene.», «A la rata
 * le quedan 2 de sus 6 puntos de vida.», «Descanso largo. Irene no tenía heridas que curar.».
 * Lo que ya es prosa se deja como está.
 *
 * La etiqueta del principio («🍲 [POSADA]») se queda: la crónica del Diario la lee para saber
 * de qué es cada línea, y la caja y el registro ya la esconden (`ui/shell/engine-tags.js`).
 *
 * Puro: de texto a texto. Lo que entra dos veces sale igual (la prosa no casa con ninguna regla).
 */

import { tagLength } from '../ui/shell/engine-tags.js';
import { SKILLS } from '../rules/checks.js';
import { STATUS_ICONS } from '../combat/initiative-tracker.js';
import {
    countWord, foesWords, goldWords, hintProse, joinProse, lifeWords, listWords, mealProse, meetingProse, needsProse, readRoll,
    sellProse, slotWords, templeProse, variant,
} from './narration-notes.js';

/**
 * Los tipos de daño de 5e, como los escribe el motor («Daño fire: …»), dichos en una frase. Los
 * mismos trece de `DAMAGE_TYPES` (`rules/spell-catalogue.js`), con el artículo que pide cada uno.
 *
 * @type {Record<string, string>}
 */
const DAMAGE_WORDS = {
    acid: 'daño de ácido', bludgeoning: 'daño contundente', cold: 'daño de frío', fire: 'daño de fuego',
    force: 'daño de fuerza', lightning: 'daño de rayo', necrotic: 'daño necrótico', piercing: 'daño perforante',
    poison: 'daño de veneno', psychic: 'daño psíquico', radiant: 'daño radiante', slashing: 'daño cortante',
    thunder: 'daño de trueno',
    // Los que ya vienen en castellano.
    ácido: 'daño de ácido', contundente: 'daño contundente', frío: 'daño de frío', fuego: 'daño de fuego',
    fuerza: 'daño de fuerza', rayo: 'daño de rayo', necrótico: 'daño necrótico', perforante: 'daño perforante',
    veneno: 'daño de veneno', psíquico: 'daño psíquico', radiante: 'daño radiante', cortante: 'daño cortante',
    trueno: 'daño de trueno',
};

/** Los estados de 5e en inglés («queda Restrained»), para decirlos: «queda apresado». */
const CONDITION_EN = /\b(Blinded|Charmed|Deafened|Frightened|Grappled|Incapacitated|Paralyzed|Petrified|Poisoned|Prone|Restrained|Stunned|Unconscious|Exhaustion)\b/gu;

/**
 * Un estado, como se dice en una frase: «Restrained» → «apresado», «Bendecido» → «bendecido».
 *
 * @param {string} name
 * @returns {string}
 */
function conditionWord(name) {
    const said = text(name);
    const label = STATUS_ICONS[said.toLocaleLowerCase('es')]?.label ?? said;
    return label.toLocaleLowerCase('es');
}

/** «el segundo rayo»: los rayos de un conjuro que lanza varios, en orden. */
const RAY_ORDINALS = ['', 'el primer', 'el segundo', 'el tercer', 'el cuarto', 'el quinto', 'el sexto', 'el séptimo', 'el octavo'];

/** Cómo se dice el área de un conjuro: «un cono de 15 pies». */
const AREA_WORDS = { radio: 'un radio', línea: 'una línea', cono: 'un cono' };

/** Una tirada de 5e escrita a mano: «d20(13) +0 = 13». Lo que importa es el total. */
const D20_SUM = String.raw`d20\(\d+\)\s*[+-]?\s*\d+\s*=\s*(-?\d+)`;

/**
 * Las frases que son órdenes al narrador y que se cuelan en lo que se ve («Que lo diga con sus
 * palabras, en una frase.»): sin modelo no las lee nadie.
 */
const NARRATOR_ORDERS = /(?:^|\s+)(?:Que (?:lo|la|los|las|les|le) (?:diga|digan|pida|pidan|agradezca|agradezcan|cuente|cuenten|explique)\b|Ya se ha dicho: no lo repitas|Si lo cuentas, )[^.!?]*[.!?]?/gu;

/** Los nombres de las habilidades, para partir «Juego de manos de Irene» por el «de» que toca. */
const SKILL_LABELS = Object.values(SKILLS).map(skill => String(skill.label)).sort((a, b) => b.length - a.length);

/** Los emoji del principio de una línea («👹 », «❤️ », «⚔️ »): en la caja no dicen nada. */
const EMOJI_HEAD = /^(?:[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}][\u{FE0F}\u{200D}\p{Extended_Pictographic}]*\s*)+/u;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** La primera letra en mayúscula. @param {string} line @returns {string} */
const upperFirst = (line) => (line ? line[0].toLocaleUpperCase('es') + line.slice(1) : line);

/** Una frase acabada: con su punto si no lo traía. @param {string} line @returns {string} */
function closed(line) {
    const said = text(line);
    if (!said) return '';
    return /[.!?…»:;)]$/.test(said) ? said : `${said}.`;
}

/** «primera», «segunda»…: la ronda, en letra. */
const ORDINALS = ['', 'primera', 'segunda', 'tercera', 'cuarta', 'quinta', 'sexta', 'séptima', 'octava', 'novena', 'décima'];

/**
 * Un objetivo dicho como se escribe en una frase: «Parar al ratero» → «parar al ratero». Solo
 * si empieza por un verbo (acaba en -ar, -er, -ir): un nombre propio se queda como está.
 *
 * @param {string} label
 * @returns {string}
 */
function goalWords(label) {
    const said = text(label);
    return /^\p{Lu}\p{Ll}+(?:ar|er|ir)\b/u.test(said) ? said[0].toLocaleLowerCase('es') + said.slice(1) : said;
}

/**
 * «Rata de bodega x2, Ratero» → {Rata de bodega: 2, Ratero: 1}.
 *
 * @param {string} list
 * @returns {Record<string, number>}
 */
function countsOf(list) {
    /** @type {Record<string, number>} */
    const counts = {};
    for (const part of text(list).split(/,\s*/)) {
        const found = /^(.+?)(?:\s+x(\d+)|\s+\((\d+)\))?$/u.exec(part.trim());
        if (!found) continue;
        counts[found[1]] = (counts[found[1]] ?? 0) + (Number(found[2] ?? found[3]) || 1);
    }
    return counts;
}

/**
 * Cómo está alguien a mitad de pelea («Rata: 2/6»): «A Rata le quedan 2 de sus 6 puntos de vida.».
 *
 * @param {string} name
 * @param {number} hp
 * @param {number} max
 * @returns {string}
 */
function hpSentence(name, hp, max) {
    if (hp <= 0) return `${name} se queda sin puntos de vida.`;
    if (hp >= max) return `${name} sigue sin un rasguño.`;
    return `A ${name} le quedan ${hp} de sus ${max} puntos de vida.`;
}

/**
 * Los puntos de vida de alguien al acabar: «Irene sigue sin un rasguño», «a Gerd le quedan 3
 * de 20 puntos de vida», «Nella está en el suelo».
 *
 * @param {Array<{name: string, hp: number, max: number}>} people
 * @returns {string}
 */
function standingWords(people) {
    const whole = people.filter(p => p.hp >= p.max && p.max > 0);
    const down = people.filter(p => p.hp <= 0);
    const hurt = people.filter(p => p.hp > 0 && p.hp < p.max);
    /** @type {string[]} */
    const said = [];
    if (whole.length > 0) said.push(`${listWords(whole.map(p => p.name))} ${whole.length === 1 ? 'sigue' : 'siguen'} sin un rasguño.`);
    for (const one of hurt) said.push(`A ${one.name} le quedan ${one.hp} de sus ${one.max} puntos de vida.`);
    if (down.length > 0) said.push(`${listWords(down.map(p => p.name))} ${down.length === 1 ? 'está' : 'están'} en el suelo.`);
    return said.join(' ');
}

/**
 * «Irene 34/34 | Gerd 3/20» → quién, cuánto y de cuánto.
 *
 * @param {string} list
 * @returns {Array<{name: string, hp: number, max: number}>}
 */
function hpList(list) {
    return text(list).split(/\s*\|\s*/).map(part => /^(.+?)\s+(\d+)\/(\d+)$/u.exec(part.trim()))
        .filter(Boolean)
        .map(found => ({ name: /** @type {RegExpExecArray} */ (found)[1], hp: Number(/** @type {RegExpExecArray} */ (found)[2]), max: Number(/** @type {RegExpExecArray} */ (found)[3]) }));
}

/**
 * El resumen del final de una pelea (`buildCombatSummary`), contado.
 *
 * @param {string[]} lines Sin la primera («Resumen final»).
 * @returns {string}
 */
function summaryProse(lines) {
    /** @type {Record<string, string>} */
    const field = {};
    for (const line of lines) {
        const found = /^([^:]+):\s*(.*)$/u.exec(line);
        if (found) field[found[1].trim()] = found[2].trim();
    }
    const result = text(field.Resultado).replace(/\.$/, '');
    const outcome = result === 'victoria del grupo' ? 'La pelea acaba en victoria.'
        : result === 'derrota del grupo' ? 'La pelea acaba en derrota.'
            : result === 'combate finalizado' ? 'La pelea ha terminado.'
                : result === 'combate terminado manualmente' ? 'La pelea se da por terminada.'
                    : result ? `La pelea acaba así: ${closed(result)}` : 'La pelea ha terminado.';
    const foes = /^(\d+)\/(\d+)$/.exec(text(field['Enemigos derrotados']));
    let enemies = '';
    if (foes) {
        const [down, all] = [Number(foes[1]), Number(foes[2])];
        enemies = all > 0 && down >= all ? 'No queda ningún enemigo en pie.'
            : down === 0 ? 'No ha caído ningún enemigo.'
                : `${upperFirst(countWord(down))} de ${all === 1 ? 'un' : countWord(all)} enemigos ${down === 1 ? 'ha caído' : 'han caído'}.`;
    }
    const friends = standingWords(hpList(field['HP aliados'] ?? ''));
    return [outcome, enemies, friends].filter(Boolean).join(' ');
}

/**
 * El orden de la pelea (`¡Encuentro iniciado!` y la lista numerada), contado.
 *
 * @param {string[]} lines
 * @returns {string}
 */
function initiativeProse(lines) {
    const names = lines.map(line => /^\d+\.\s+(.+?)\s*\(\d+\)/u.exec(line)?.[1] ?? '').filter(Boolean);
    if (names.length === 0) return '¡Empieza la pelea!';
    if (names.length === 1) return `¡Empieza la pelea! Actúa ${names[0]}.`;
    return `¡Empieza la pelea! Actúa primero ${names[0]}; después, ${listWords(names.slice(1))}.`;
}

/** @param {number} n @returns {string} */
const diceWords = (n) => (n === 1 ? 'un dado de golpe' : `${countWord(n)} dados de golpe`);

/**
 * La rareza del botín, en castellano (H20: salía «un objeto common»). Lo corriente no se dice:
 * «llevaba encima una bolsa de canicas» y ya.
 *
 * @param {string} rarity
 * @returns {string}
 */
function rarityWords(rarity) {
    const key = text(rarity).toLocaleLowerCase('es').replace(/[\s_-]+/g, ' ');
    if (/^(?:common|com[uú]n|corriente)$/u.test(key)) return '';
    if (/^(?:uncommon|poco com[uú]n)$/u.test(key)) return 'poco común';
    if (/^(?:very rare|muy rar[ao])$/u.test(key)) return 'muy raro';
    if (/^(?:rare|rar[ao])$/u.test(key)) return 'raro';
    if (/^(?:legendary|legendari[ao])$/u.test(key)) return 'legendario';
    if (/^(?:artifact|artefacto)$/u.test(key)) return 'único';
    return /^[a-z ]+$/u.test(key) ? '' : key;
}

/**
 * El descanso (`describeRest`: «Descanso largo.» y una línea por persona), contado.
 *
 * @param {'corto'|'largo'} kind
 * @param {string[]} lines Las de cada persona.
 * @returns {string}
 */
function restNoteProse(kind, lines) {
    /** @type {string[]} */
    const said = [];
    /** @type {string[]} */
    const fine = [];
    for (const line of lines) {
        const found = /^(.+?): (\d+) → (\d+) PG(?:, (\d+) dados? de golpe(?: \([^)]*\))?|, recupera (\d+) dados? de golpe)?\.?$/u.exec(line);
        if (!found) {
            if (text(line)) said.push(closed(line));
            continue;
        }
        const [, name, before, after, spent, regained] = found;
        const healed = Number(after) > Number(before);
        const back = Number(regained) > 0 ? `recupera ${diceWords(Number(regained))}` : '';
        if (Number(spent) > 0) {
            said.push(`${name} gasta ${diceWords(Number(spent))} y pasa de ${before} a ${after} puntos de vida.`);
        } else if (healed) {
            said.push(`${name} pasa de ${before} a ${after} puntos de vida${back ? ` y ${back}` : ''}.`);
        } else if (back) {
            said.push(`${name} ${back}.`);
        } else {
            fine.push(name);
        }
    }
    if (fine.length > 0) said.push(`${listWords(fine)} no ${fine.length === 1 ? 'tenía' : 'tenían'} heridas que curar.`);
    return [`Descanso ${kind}.`, ...said].join(' ');
}

/**
 * Los objetivos de un tablero («✅ Parar al ratero · ⬜ Salir (opcional)»), contados.
 *
 * @param {string} line
 * @returns {string} Vacío si la línea no es eso.
 */
function objectivesProse(line) {
    const parts = line.split(/\s+·\s+/);
    /** @type {Record<string, string[]>} */
    const by = { '✅': [], '❌': [], '⬜': [] };
    for (const part of parts) {
        const found = /^([✅❌⬜])️?\s*(.+?)(\s*\(opcional\))?$/u.exec(part.trim());
        if (!found) return '';
        by[found[1]].push(`${goalWords(found[2])}${found[3] ? ', que era opcional' : ''}`);
    }
    return [
        by['✅'].length > 0 ? `Cumplido: ${listWords(by['✅'])}.` : '',
        by['❌'].length > 0 ? `Sin cumplir: ${listWords(by['❌'])}.` : '',
        by['⬜'].length > 0 ? `Queda por hacer: ${listWords(by['⬜'])}.` : '',
    ].filter(Boolean).join(' ');
}

/**
 * Una tirada al principio de la línea (`rollLine`: «Perspicacia de Irene: 14 contra CD 13 ✓
 * Éxito (d20 12 +2)»), contada; lo que venga detrás se queda.
 *
 * @param {string} line Sin el 🎲.
 * @param {string} before La frase de antes, por si ya dice quién ataca a quién.
 * @returns {string} Vacío si no es una tirada.
 */
function rollLineProse(line, before) {
    const found = /^([^:«»]+?):\s*(-?\d+)(\s+contra\s+(?:[A-Za-zÁÉÍÓÚáéíóúñ]+\s+)?-?\d+)?(\s*[✓✗])?((?:\s+(?!\()[^.(]*[^.(\s])?)(\s*\([^)]*\))?(\.?)(.*)$/u.exec(line);
    if (!found) return '';
    const roll = readRoll(`🎲 ${found[1]}: ${found[2]}${found[3] ?? ''}${found[4] ?? ''}${found[5] ?? ''}${found[6] ?? ''}`, SKILL_LABELS);
    if (!roll) return '';
    const rest = text(found[8]);
    /** @type {string} */
    let said;
    if (/^ataque$/i.test(roll.what) && roll.at && roll.against != null) {
        // «Rata ataca a Irene.» ya se ha dicho: aquí, solo el dado.
        const told = before.includes(roll.who) && before.includes(roll.at);
        said = told ? `Saca un ${roll.total} contra una defensa de ${roll.against}.`
            : `${roll.who} ataca a ${roll.at}: saca un ${roll.total} contra una defensa de ${roll.against}.`;
    } else if (/^guardia$/i.test(roll.what) && roll.who) {
        said = `${roll.who} hace la guardia: saca un ${roll.total}${roll.against != null ? `, y le hacía falta un ${roll.against}` : ''}.${roll.success === true ? ' No se le escapa nada.' : roll.success === false ? ' Se le cierran los ojos.' : ''}`;
    } else {
        const who = roll.who || 'Alguien';
        const tried = roll.at ? `${who} contra ${roll.at}, ${roll.what.toLocaleLowerCase('es')}` : `${who} prueba con ${roll.what}`;
        const need = roll.against == null ? '' : `, y le hacía falta un ${roll.against}`;
        const verdict = /rotundo/i.test(roll.verdict) && roll.success ? ' Sale redondo.'
            : /rotundo/i.test(roll.verdict) ? ' Sale todo al revés.'
                : /medias/i.test(roll.verdict) ? ' Sale a medias.'
                    : roll.success === true ? ' Sale bien.' : roll.success === false ? ' No sale.' : '';
        // Tanda 16: lo que suma o resta algo de fuera se sigue leyendo («+2 por la Luz», D-J51); el
        // desglose del dado («d20 12 +2»), no.
        const extras = text(found[6]).replace(/^\(|\)$/gu, '').split(/\s*·\s*/u).filter(part => part && !/^d20\b/u.test(part));
        said = `${tried}: saca un ${roll.total}${extras.length > 0 ? ` (${extras.join('; ')})` : ''}${need}.${verdict}`;
    }
    return rest ? `${said} ${upperFirst(rest.replace(/^[.,;:]\s*/, ''))}` : said;
}

/**
 * Lo que una regla sabe de alrededor: la etiqueta de la nota, la frase de antes, la clave de la
 * variante, a quién va (`aim`) o qué rayo es (`ray`), y si la línea traía icono delante.
 *
 * @typedef {{tag: string, before: string, key: string, aim?: string, ray?: string, icon?: boolean}} LineContext
 */

/**
 * Las reglas de una línea: la forma de registro y su frase. La primera que casa, gana.
 * Cada una recibe lo que casó y lo de alrededor.
 *
 * @type {Array<[RegExp, (found: RegExpExecArray, context: LineContext) => string|null]>}
 */
const LINE_RULES = [
    // --- La pelea ----------------------------------------------------------------------------
    [/^Turno de (.+?) \((?:Enemigo|Jugador|Aliado|Invocaci[oó]n)\)\.?$/u, (f) => `Le toca a ${f[1]}.`],
    [/^(.+?), elige acci[oó]n\..*?Movimiento restante: (\d+) ft\.(?:\s*Rango actual: \d+ ft\.)?\s*Objetivos en rango: (.+?)\.?$/u, (f) => {
        const none = /ning[uú]n enemigo/i.test(f[3]);
        return `${f[1]} puede moverse ${f[2]} pies${none ? '; no tiene a nadie a su alcance.' : ` y tiene a su alcance a ${listWords(f[3].split(/,\s*/))}.`}`;
    }],
    [/^Empieza el combate del tablero: (.+?)\.?$/u, (f) => `Empieza la pelea contra ${foesWords(countsOf(f[1]))}.`],
    [/^Ronda (\d+)\.?$/u, (f) => (ORDINALS[Number(f[1])] ? `Empieza la ${ORDINALS[Number(f[1])]} ronda.` : `Empieza la ronda ${f[1]}.`)],
    [/^Resultado: fallo\.?$/u, () => 'Falla.'],
    [/^Resultado: impacto( cr[ií]tico)?\.?$/u, (f) => (f[1] ? '¡Golpe crítico!' : 'Acierta.')],
    [/^Daño: (\d+)(?:\s*\([^)]*\))?\.?$/u, (f) => `El golpe hace ${f[1]} de daño.`],
    [/^Estado de (.+?): (\d+)\/(\d+)\.?$/u, (f) => hpSentence(f[1], Number(f[2]), Number(f[3]))],
    [/^(.+?) avanza a \(\d+,\s*\d+\)\.\s*(.*?)\s*\((\d+) ft\)\.?$/u, (f) => `${f[1]} avanza ${f[3]} pies.${f[2] ? ` ${closed(f[2])}` : ''}`],
    [/^(.+?) avanza hasta \(\d+,\s*\d+\) y se queda a medio camino\.?$/u, (f) => `${f[1]} avanza, pero se queda a medio camino.`],
    // Los conjuros y las habilidades (`planAbilityUse` de `rules/abilities.js`, y
    // `resolveAbilityOnBoard` de `party/magic.js`): «Ataque: d20(12) +5 = 17 vs CA 13».
    [/^(.+?) usa (.+?) \((radio|línea|cono) de (\d+) ft\)\.?$/u, (f) => `${f[1]} usa ${f[2]}, que alcanza ${AREA_WORDS[/** @type {keyof typeof AREA_WORDS} */ (f[3])]} de ${f[4]} pies.`],
    [new RegExp(String.raw`^Ataque: ${D20_SUM} vs CA (\d+)\.?$`, 'u'), (f, c) => {
        const roll = `saca un ${f[1]} contra una defensa de ${f[2]}.`;
        return c.ray ? `${upperFirst(c.ray)}: ${roll}` : c.aim ? `Contra ${c.aim}: ${roll}` : upperFirst(roll);
    }],
    [new RegExp(String.raw`^Salvación de (.+?): ${D20_SUM} vs CD (\d+)\.?$`, 'u'), (f) => {
        const done = Number(f[2]) >= Number(f[3]);
        return `${f[1]} intenta librarse: saca un ${f[2]}, y le hacía falta un ${f[3]}.${done ? ' Lo consigue.' : ' No lo consigue.'}`;
    }],
    [new RegExp(String.raw`^(.+?) salva contra (.+?): ${D20_SUM} vs CD (\d+)(: aguanta)?\.?$`, 'u'), (f) => {
        const what = f[2] === 'la zona' ? 'la zona' : f[2];
        return `${f[1]} intenta librarse de ${what}: saca un ${f[3]}, y le hacía falta un ${f[4]}.${f[5] ? ' Aguanta.' : ' No se libra.'}`;
    }],
    [new RegExp(String.raw`^(.+?) aguanta la concentración en (.+?): ${D20_SUM} vs CD (\d+)\.?$`, 'u'), (f) => `${f[1]} intenta no perder la concentración en ${f[2]}: saca un ${f[3]}, y le hacía falta un ${f[4]}.`],
    [/^Daño(?: (\p{L}+))?: [^=]+?( x2 \(crítico\))?( a la mitad \(salva\))? = (\d+)\.?$/u, (f) => {
        const kind = f[1] ? (DAMAGE_WORDS[f[1].toLocaleLowerCase('es')] ?? `daño ${f[1].toLocaleLowerCase('es')}`) : 'daño';
        const hurt = `Le hace ${f[4]} de ${kind}`;
        if (f[2]) return `¡Crítico! ${hurt}.`;
        if (f[3]) return `${hurt}: la mitad, porque aguanta en parte.`;
        return `${hurt}.`;
    }],
    [/^(.+?) queda (.+?) \((\d+) ronda\(s\)\)\.?$/u, (f) => {
        const rounds = Number(f[3]);
        return `${f[1]} queda ${conditionWord(f[2])} ${rounds === 1 ? 'durante una ronda' : `durante ${countWord(rounds, 'f')} rondas`}.`;
    }],
    [/^(.+?) aguanta y no queda (.+?)\.?$/u, (f) => `${f[1]} aguanta y no queda ${conditionWord(f[2])}.`],
    // Lo que el elemento le hace a quien está donde está («❄️ Rata: se queda helado.»). Solo con
    // el icono delante: «Hecho: se abre la puerta» es otra cosa.
    [/^([^:\d]+): (se \p{Ll}[^:]*)$/u, (f, c) => (c.icon ? `${f[1]} ${f[2]}` : null)],
    [/^([^:\d]+): ((?:el|la|lo) [^:]*\b(?:le|sus)\b[^:]*)$/u, (f, c) => (c.icon ? `A ${f[1]}, ${f[2]}` : null)],
    [/^Revienta un barril en \(\d+,\s*\d+\): (\d+) de fuego(?: a (.+?)|, y no pilla a nadie)\.?$/u, (f) => (f[2]
        ? `Revienta un barril, y la llamarada hace ${f[1]} de daño de fuego a ${listWords(f[2].split(/,\s*/))}.`
        : 'Revienta un barril, pero la llamarada no pilla a nadie.')],
    [/^(.+?) se acorrala: \+(\d+) a la CA, (.+)$/u, (f) => `${f[1]} se acorrala y se cubre mejor: ${Number(f[2]) === 1 ? 'un punto' : `${countWord(Number(f[2]))} puntos`} más de defensa, ${f[3]}`],
    [/^(.+?) cae a 0 PG y empieza a jug[aá]rsela:.*$/u, (f) => `${f[1]} cae al suelo y se desangra: con tres salvaciones buenas se estabiliza; con tres malas, muere.`],
    [/^(.+?) se interpone: (.+?) aguanta con 1 (?:HP|PG)\.?$/u, (f) => `${f[1]} se interpone, y ${f[2]} aguanta con un punto de vida.`],
    [/^Botín: (\d+) de oro y (\d+) PX \((\d+) y (\d+) para cada superviviente\)\.?$/u, (f) => {
        const [gold, xp, goldEach, xpEach] = f.slice(1, 5).map(Number);
        const loot = `Botín: ${goldWords(gold)} y ${xp} puntos de experiencia`;
        return gold === goldEach && xp === xpEach ? `${loot}.` : `${loot}. A cada superviviente le tocan ${goldEach} de oro y ${xpEach} de experiencia.`;
    }],
    [/^(.+?) llevaba: (.+?) \(([^)0-9]+)\)\.?$/u, (f) => {
        const rarity = rarityWords(f[3]);
        return rarity ? `${f[1]} llevaba encima ${f[2]}, un objeto ${rarity}.` : `${f[1]} llevaba encima ${f[2]}.`;
    }],
    [/^(.+?) sube al nivel (\d+) · \+(\d+) PG · \+(\d+) dado\(s\) de golpe(?: · ([^.]+?))?\.\s*(.*)$/u, (f) => {
        const points = f[5] ? /^(\d+) punto\(s\) de característica$/u.exec(f[5]) : null;
        const more = points ? `, y tiene ${Number(points[1]) === 1 ? 'un punto' : `${countWord(Number(points[1]))} puntos`} de característica para repartir` : f[5] ? `, y ${f[5]}` : '';
        return `${f[1]} sube al nivel ${f[2]}: gana ${lifeWords(Number(f[3]))} y ${diceWords(Number(f[4]))}${more}.${f[6] ? ` ${f[6]}` : ''}`;
    }],

    // --- El pueblo, el reloj y el cuerpo ------------------------------------------------------
    [/^Comida caliente para todos \((\d+) de oro\)\.?$/u, (f, c) => mealProse(Number(f[1]), c.key)],
    [/^(.+?) compra (.+?) por (\d+) de oro\.(.*)$/u, (f) => `${f[1]} compra ${f[2]} por ${goldWords(Number(f[3]))}.${f[4]}`],
    [/^Vendéis (.+?): (\d+) de oro\.?$/u, (f) => sellProse(f[1].split(/,\s*/), Number(f[2]))],
    [/^El pienso de las monturas: (\d+) de oro\.?$/u, (f) => `El pienso de las monturas cuesta ${goldWords(Number(f[1]))}.`],
    [/^(.+?) abre el cofre: (\d+) de oro(?: y (.+?))?\.?$/u, (f) => {
        const gold = Number(f[2]);
        const inside = [gold > 0 ? goldWords(gold) : '', f[3] ?? ''].filter(Boolean);
        return inside.length > 0 ? `${f[1]} abre el cofre, y dentro hay ${listWords(inside)}.` : `${f[1]} abre el cofre, pero está vacío.`;
    }],
    [/^Día (\d+) · (.+?)\.?$/u, (f, c) => {
        const now = slotWords(f[2]);
        return variant([
            `Pasan las horas. Ya es ${now}, el día ${f[1]}.`,
            `Las horas pasan despacio. Día ${f[1]}, ${now}.`,
            `El día sigue su curso: ya es ${now}, el día ${f[1]}.`,
        ], `${c.key}:${f[1]}:${f[2]}`);
    }],
    [/^.+ empieza a acusar .+$/u, (f) => needsProse(f[0].split(/(?<=\.)\s+/))],

    // --- Los tableros, los casos y las charlas --------------------------------------------------
    [/^La puerta de \(\d+,\s*\d+\) (.+)$/u, (f) => `La puerta ${f[1]}`],
    [/^(.+?) saca la ganzúa: la cerradura baja de CD (\d+) a (\d+)\.?$/u, (f) => `${f[1]} saca la ganzúa, y la cerradura se pone más fácil: su dificultad baja de ${f[2]} a ${f[3]}.`],
    [/^(.+?) golpea la barricada \([−-](\d+)\)\.\s*(.*)$/u, (f) => `${f[1]} golpea la barricada y le hace ${f[2]} de daño.${f[3] ? ` ${f[3]}` : ''}`],
    [/^(.+?) busca trampas alrededor \(Percepción: (\d+)\)\.\s*(.*)$/u, (f) => {
        // «Encuentra cepo de lobero en (5, 6) y …»: sin las casillas, cuántas y cuáles.
        const rest = f[3].replace(/^Encuentra (.+?)\.?$/u, (all, list) => {
            const names = String(list).split(/ en \(\d+,\s*\d+\)(?: y |$)/u).filter(Boolean);
            return names.length === 0 ? all : `Encuentra ${names.length === 1 ? 'una trampa' : `${countWord(names.length)} trampas`}: ${listWords(names)}.`;
        });
        return `${f[1]} busca trampas alrededor: saca un ${f[2]} en Percepción.${rest ? ` ${rest}` : ''}`;
    }],
    [/^(.+?) habla con (.+?): (cede a medias|no cede|cede)\.?$/u, (f) => {
        const end = f[3] === 'cede' ? `al final, ${f[2]} cede.` : f[3] === 'cede a medias' ? `al final, ${f[2]} cede a medias.` : `${f[2]} no cede.`;
        return `${f[1]} habla con ${f[2]}, y ${end}`;
    }],
    [/^(.+?) \((\d+) de oro\)\.?$/u, (f, c) => (/CASO/.test(c.tag) ? `${closed(f[1])} Os pagan ${goldWords(Number(f[2]))}.` : `${closed(f[1])} Son ${goldWords(Number(f[2]))}.`)],

    // --- El gremio, la partida y la taberna ----------------------------------------------------
    // `describeContract`: «Aceptado: [B] El faro — 50 de oro · 3 día(s) · Brunilda».
    [/^Aceptado: (?:\[[^\]]*\]\s*)?(.+?) — (\d+) de oro · (vencido|(\d+) día\(s\)) · (.+?)\.?$/u, (f) => {
        const days = Number(f[4]);
        const left = f[3] === 'vencido' ? ' Ya no le queda plazo.' : days === 1 ? ' Queda un día de plazo.' : ` Quedan ${countWord(days)} días de plazo.`;
        return `Aceptáis el encargo «${f[1]}», de ${f[5]}. Paga ${goldWords(Number(f[2]))}.${left}`;
    }],
    [/^El sitio ya existe: (.+?) — (.+?)\.?$/u, (f) => `${f[2]} ya está en el mapa, en ${f[1]}.`],
    [/^Se pas[oó] el plazo: (.+?)\.?$/u, (f) => `Se os ha pasado el plazo de «${f[1]}».`],
    // `describeCheckpoint`: «La bodega · 2026-10-01 05:30 · automático».
    [/^Punto de retorno: (.+?)(?: · [^·.]*\d{4}-\d{2}-\d{2}[^·.]*| · sin fecha)?(?: · automático)?\.?$/u, (f) => `Queda guardado un punto de retorno: ${f[1]}.`],
    [/^Vuelta a: (.+?)(?: · [^·.]*\d{4}-\d{2}-\d{2}[^·.]*| · sin fecha)?(?: · automático)?\.(.*)$/u, (f) => `Volvéis atrás, al punto de retorno «${f[1]}».${f[2]}`],
    // `describeGame` (los dados de la taberna): «Tú: 4 + 6 = 10 · La casa: 9 + 3 = 12 · Pierdes 5.»
    [/^(.*?)Tú: [\d +]+ = (\d+)(?: · La casa: [\d +]+ = (\d+))?(?: · (.+))?$/u, (f) => {
        const end = text(f[4])
            .replace(/^Ganas (\d+) de oro\.?$/u, (_, n) => `Ganas ${goldWords(Number(n))}.`)
            .replace(/pierdes (\d+)/iu, (all, n) => `${all.slice(0, 1)}ierdes ${goldWords(Number(n))}`);
        return `${f[1]}Tus dados suman ${f[2]}${f[3] ? `; los de la casa, ${f[3]}` : ''}.${end ? ` ${end}` : ''}`;
    }],

    // --- Las notas que se escribieron para el modelo, sin modelo ---------------------------------
    // `describeMeeting` (`campaign/recruit.js`): la escena, sin «Presenta a…» ni «Que deje claro…».
    [/^En (.+?)\. (.*?)\s*Presenta a (.+?) con esta escena, en su voz\.(?:\s*Que deje claro que trabaja por dinero \((\d+) de oro por adelantado\)\.)?\s*$/u,
        (f) => meetingProse({ name: f[3], description: f[2], motive: f[4] ? 'coin' : '', cost: Number(f[4]) || 0 }, f[1])],
    // `describeJoin`: «Gerd, guerrero, viene con vosotros (cobra 40 de oro).»
    [/^(.+?)(?:, ([^,]+))?, viene con vosotros(?: \(cobra (\d+) de oro\))?\.?$/u, (f) => joinProse({ name: f[1], className: f[2] ?? '', cost: Number(f[3]) || 0 })],
    // El templo (`party/town.js`): «En el templo de X os cosen y os vendan (10 de oro).»
    [/^En el templo de (.+?) os cosen y os vendan \((\d+) de oro\)\.(?:\s*Las heridas que se curan con tiempo quedan cerradas\.)?\s*$/u, (f) => templeProse(f[1], Number(f[2]))],
    // La pista que llega cuando el grupo no avanza (`party/plot.js`).
    [/^El grupo lleva días sin avanzar\. Que les llegue esto por boca de alguien del lugar,[^:]*: (.+)$/u, (f, c) => hintProse(f[1], c.key)],
    // El duelo de palabras (`duelPrompt` de `campaign/word-duel.js`): la cabecera y cada ronda.
    [/^Una conversación con (.+?) \([^)]*\) para (.+?)\. Así fue:$/u, (f) => `Habláis con ${f[1]} para ${f[2]}.`],
    [/^-\s*Ronda (\d+): (.+?)\.(?: ([^:«]+): «(.+)»)?$/u, (f) => duelRoundProse(Number(f[1]), f[2], f[3] ?? '', f[4] ?? '')],
];

/**
 * Una ronda del duelo de palabras, contada: «Primera ronda: convencer, y sale bien; le hace
 * mella. Brunilda responde: «Ya veremos.»».
 *
 * @param {number} round
 * @param {string} line Lo que se hizo: «Convencer: 14 contra 12 ✓ — le pesa más (orgulloso)».
 * @param {string} who Quien responde.
 * @param {string} reply Lo que responde.
 * @returns {string}
 */
function duelRoundProse(round, line, who, reply) {
    const parts = text(line).split(/\s+—\s+/u);
    const roll = /^(.+?): (-?\d+) contra (\d+) ([✓✗])$/u.exec(parts[0]);
    const label = roll ? roll[1] : parts[0];
    const tried = `${label[0]?.toLocaleLowerCase('es') ?? ''}${label.slice(1)}${roll ? (roll[4] === '✓' ? ', y sale bien' : ', y no sale') : ''}`;
    /** @type {string[]} */
    const after = [];
    for (const part of parts.slice(1)) {
        if (/^recuperáis aplomo/u.test(part)) after.push('recuperáis el aplomo');
        else if (/^y le endurece/u.test(part)) after.push('eso le endurece');
        else if (/^le pesa más/u.test(part)) after.push('le hace mella');
        else if (/^le pesa menos/u.test(part)) after.push('apenas le hace mella');
    }
    const named = ORDINALS[round] ? `${upperFirst(ORDINALS[round])} ronda` : `Ronda número ${round}`;
    const answer = reply && who ? ` ${who} responde: «${reply}»` : '';
    return `${named}: ${tried}${after.length > 0 ? `; ${after.join('; ')}` : ''}.${answer}`;
}

/**
 * Lo que queda de registro en cualquier línea, en palabras: las casillas y el desglose de los
 * dados fuera; los pies, la dificultad, la defensa, la vida y la experiencia, dichos.
 *
 * @param {string} line
 * @returns {string}
 */
function plainWords(line) {
    return line
        // Las casillas «(3, 4)» y el desglose de los dados «(d20 12 +2)», «(1d8 5 +3)».
        .replace(/\s*\(\s*\d+\s*,\s*\d+\s*\)/gu, '')
        .replace(/\s*\((?:d20|\d*d\d+)\b[^)]*\)/gu, '')
        .replace(/\s*\((\d+) ft\)/gu, '')
        .replace(/(\d+) ft\b/gu, '$1 pies')
        // Una tirada de 5e a mano que no tenía regla: «d20(9) +2 = 11 vs CD 12».
        .replace(new RegExp(String.raw`${D20_SUM}\s*vs\s*CD\s*(\d+)`, 'gu'), 'saca un $1, y le hacía falta un $2')
        .replace(new RegExp(String.raw`${D20_SUM}\s*vs\s*CA\s*(\d+)`, 'gu'), 'saca un $1 contra una defensa de $2')
        .replace(new RegExp(D20_SUM, 'gu'), 'saca un $1')
        .replace(/\bvs\.?(?=\s)/gu, 'contra')
        // El daño y los estados, en castellano: «daño fire» → «daño de fuego», «Restrained» → «apresado».
        .replace(/\bdaño (\p{L}+)/gu, (all, kind) => DAMAGE_WORDS[String(kind).toLocaleLowerCase('es')] && !/^(?:de|del|que|a|y|en)$/u.test(kind) ? DAMAGE_WORDS[String(kind).toLocaleLowerCase('es')] : all)
        .replace(CONDITION_EN, (_, name) => conditionWord(name))
        // «+2 a la CA», «la CA»: la defensa.
        .replace(/\+(\d+) a la CA\b/gu, (_, n) => `${Number(n) === 1 ? 'un punto' : `${countWord(Number(n))} puntos`} más de defensa`)
        .replace(/\bla CA\b/gu, 'la defensa')
        // «… os cosen (10 de oro).»: lo que cuesta, en la frase; y en la herrería, lo que se gasta.
        .replace(/\s*\((\d+) de oro\)/gu, (_, n) => `, por ${goldWords(Number(n))}`)
        .replace(/\s*\((\d+) de oro, ([^)]+)\)/gu, (_, n, used) => {
            const spent = String(used).split(/,\s*/);
            return `, por ${goldWords(Number(n))}; se ${spent.length === 1 ? 'gasta' : 'gastan'} ${listWords(spent)}`;
        })
        // «… 5 de daño. Rata: 2/6.»: cómo queda, en una frase.
        .replace(/(^|[.!?]\s+)([^.:!?]+?): (\d+)\/(\d+)\.?(?=\s|$)/gu, (_, head, name, hp, max) => `${head}${hpSentence(name, Number(hp), Number(max))}`)
        // «CA 14 → 16», «CD 12», «CA 15».
        .replace(/\bCA (\d+) → (\d+)/gu, 'defensa de $1 a $2')
        .replace(/\bCD (\d+)/gu, 'dificultad $1')
        .replace(/\bCA (\d+)/gu, 'defensa $1')
        .replace(/(\d+) PG\b/gu, (_, n) => lifeWords(Number(n)))
        .replace(/(\d+) HP\b/gu, (_, n) => lifeWords(Number(n)))
        .replace(/\bHP\b/gu, 'puntos de vida')
        .replace(/(\d+) PX\b/gu, '$1 puntos de experiencia')
        // «2 dado(s)», «1 punto(s)».
        .replace(/(\d+) (\p{L}+)\(s\)/gu, (_, n, word) => (Number(n) === 1 ? `un ${word}` : `${countWord(Number(n))} ${word}s`))
        // Una orden de la barra («/caso», «/combat-end») no se puede escribir sin caja.
        .replace(/[^.!?]*(?:^|\s)\/[a-z][a-z-]+\b[^.!?]*[.!?]?/gu, '')
        // Una fecha de registro («2026-10-01 05:30») no la dice nadie; el «·» de las listas, una coma.
        .replace(/\s*·?\s*\b\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?/gu, '')
        .replace(/\s+·\s+/gu, ', ')
        .replace(/\s*[✓✗]\s*/gu, ' ')
        .replace(/\s{2,}/gu, ' ')
        .trim();
}

/**
 * Una línea de una nota, contada.
 *
 * @param {string} raw Sin la etiqueta.
 * @param {{tag: string, before: string, key: string, aim?: string, ray?: string}} context
 * @returns {string}
 */
function lineProse(raw, context) {
    // Las órdenes al narrador que se cuelan («Que lo diga con sus palabras.») no se leen.
    const line = text(text(raw).replace(NARRATOR_ORDERS, ''));
    if (!line) return '';
    // El 🎲 y los ✅/❌ de los objetivos dicen qué es la línea: se miran antes de quitar el emoji.
    // Una nota «🎲 [TIRADA]» lleva el dado en la etiqueta.
    // Los dados de la taberna («Tú: 7 + 9 = 16») no son una tirada: tienen su regla.
    if ((/^🎲/u.test(line) || (context.before === '' && /🎲|\[TIRADA\]/u.test(context.tag))) && !/(?:^|\s)Tú: \d/u.test(line)) {
        const rolled = rollLineProse(line.replace(/^🎲️?\s*/u, ''), context.before);
        if (rolled) return plainWords(rolled);
    }
    // Los objetivos no acaban en punto; «❌ Falla.» es un golpe que no entra.
    if (/^[✅❌⬜]/u.test(line) && !/^.️?\s*Resultado:/u.test(line) && !/\.\s*$/u.test(line)) {
        const goals = objectivesProse(line);
        if (goals) return goals;
    }
    const bare = line.replace(EMOJI_HEAD, '').trim();
    const icon = line.length > bare.length;
    for (const [rule, tell] of LINE_RULES) {
        const found = rule.exec(bare);
        if (!found) continue;
        const said = tell(found, { ...context, icon });
        if (said != null) return plainWords(said);
    }
    return plainWords(bare);
}

/**
 * Una nota del motor, contada como la diría un narrador. La etiqueta del principio se queda
 * (la crónica la necesita); lo demás, en frases. Una nota de varias líneas se lee de corrido,
 * salvo si trae párrafos o un apunte «Hecho:» del hilo, que va aparte (la caja lo quita).
 *
 * @param {string} note
 * @param {{key?: string}} [options] `key`: lo que distingue esta nota de otra igual (su sitio en
 *   el chat), para que la comida o el paso de las horas no se cuenten siempre con la misma frase.
 * @returns {string}
 */
export function noteProse(note, { key = '' } = {}) {
    const source = String(note ?? '');
    if (!source.trim()) return source;
    const cut = tagLength(source);
    const head = source.slice(0, cut);
    const tag = head.trim();
    const lines = source.slice(cut).split('\n').map(line => line.slice(tagLength(line)));
    const first = text(lines[0]).replace(EMOJI_HEAD, '').trim();
    const rest = lines.slice(1).map(text).filter(Boolean);

    // Las notas que son un bloque: el resumen del final, el orden de la pelea y el descanso.
    /** @type {string} */
    let told = '';
    if (first === 'Resumen final') told = summaryProse(rest);
    else if (/^¡Encuentro iniciado!/u.test(first)) told = initiativeProse(rest.filter(line => /^\d+\./.test(line)));
    else if (/^Descanso (corto|largo)\.$/u.test(first)) told = restNoteProse(/** @type {'corto'|'largo'} */ (/^Descanso (corto|largo)/u.exec(first)?.[1] ?? 'corto'), rest);
    if (told) return `${head}${told}`;

    const apart = /\n\s*\n/.test(source) || lines.some(line => /^\s*Hecho:\s/u.test(line));
    /** @type {string[]} */
    const said = [];
    // «➤ Rata:» y «➤ Rayo 2:» (los conjuros de área y los de varios rayos) dicen a quién va lo
    // que sigue: no se leen solos, se meten en la línea de la tirada.
    let aim = '';
    let ray = '';
    for (const line of lines) {
        if (!text(line)) {
            if (apart && said.length > 0 && said[said.length - 1] !== '') said.push('');
            continue;
        }
        const pointed = /^➤\s*(.+?):?\s*$/u.exec(text(line));
        if (pointed) {
            const nth = /^Rayo (\d+)$/u.exec(pointed[1]);
            ray = nth ? (RAY_ORDINALS[Number(nth[1])] ? `${RAY_ORDINALS[Number(nth[1])]} rayo` : `el rayo número ${nth[1]}`) : '';
            aim = nth ? '' : pointed[1];
            continue;
        }
        const one = lineProse(line, { tag, before: said[said.length - 1] ?? '', key, aim, ray });
        if (one) said.push(apart ? one : closed(one));
    }
    while (said[said.length - 1] === '') said.pop();
    const body = apart ? said.join('\n') : said.join(' ');
    return `${head}${body}`;
}
