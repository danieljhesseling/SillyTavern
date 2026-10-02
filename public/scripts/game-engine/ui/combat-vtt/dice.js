/**
 * Tanda 17 (Daniel, 2026-10-02): «una animación de dado… algún dado 1d20 guay». El d20 de la
 * secuencia del combate (`fx.js`): una cara de icosaedro en SVG que cae dando vueltas, enseña el
 * número y se enciende en oro con un 20 natural o se agrieta en rojo con un 1. Debajo, la cuenta
 * dicha llana: «14 + 5 = 19 contra CA 13: impacta».
 *
 * Lo que se dice (`rollSentence`, `rollVerdict`) no toca el documento y se prueba sin navegador;
 * `buildDie` y `tumbleDie` dibujan.
 */

/**
 * @typedef {Object} RollShown Lo que se enseña de una tirada de d20.
 * @property {number} natural Lo que sale en el dado (el que se queda, con ventaja o desventaja).
 * @property {number} total Con el modificador.
 * @property {number|null} [dc] Contra qué: la CA de un golpe o la CD de una prueba.
 * @property {'CA'|'CD'|''} [against] Cómo se llama ese número.
 * @property {boolean|null} [hit] Lo que ha decidido el motor (si entra el golpe, si se supera la
 *   prueba). Manda sobre la cuenta: un Escudo puede parar un golpe que la cuenta daba por bueno.
 * @property {number[]} [rolls] Los dos dados de una tirada con ventaja o desventaja.
 * @property {'advantage'|'disadvantage'|'normal'} [edge]
 */

/**
 * Cómo acaba una tirada, en una palabra o dos.
 *
 * @param {RollShown} roll
 * @returns {{word: string, good: boolean|null, crit: boolean, fumble: boolean}}
 */
export function rollVerdict(roll) {
    const natural = Number(roll?.natural) || 0;
    const total = Number(roll?.total) || 0;
    const dc = roll?.dc == null || !Number.isFinite(Number(roll.dc)) ? null : Number(roll.dc);
    const against = roll?.against ?? (dc == null ? '' : 'CA');
    const crit = natural === 20;
    const fumble = natural === 1;
    if (dc == null) return { word: '', good: null, crit, fumble };
    const good = typeof roll?.hit === 'boolean' ? roll.hit : total >= dc;
    if (against === 'CA') {
        if (crit && good) return { word: '¡crítico!', good, crit, fumble };
        if (fumble && !good) return { word: 'pifia: falla', good, crit, fumble };
        // El motor dice que no aunque la cuenta llegaba: algo lo ha parado (Escudo).
        if (!good && total >= dc) return { word: 'lo paran', good, crit, fumble };
        return { word: good ? 'impacta' : 'falla', good, crit, fumble };
    }
    return { word: good ? 'lo supera' : 'no lo supera', good, crit, fumble };
}

/**
 * La cuenta de una tirada, como se diría en la mesa: «14 + 5 = 19 contra CA 13: impacta». Sin
 * modificador, «14 contra CA 13: impacta»; sin nada contra lo que tirar, «14 + 5 = 19».
 *
 * @param {RollShown} roll
 * @returns {string}
 */
export function rollSentence(roll) {
    const natural = Number(roll?.natural) || 0;
    const total = Number(roll?.total) || 0;
    const modifier = total - natural;
    const sum = modifier === 0 ? `${natural}` : `${natural} ${modifier > 0 ? '+' : '−'} ${Math.abs(modifier)} = ${total}`;
    const dc = roll?.dc == null || !Number.isFinite(Number(roll.dc)) ? null : Number(roll.dc);
    if (dc == null) return sum;
    const against = roll?.against || 'CA';
    const { word } = rollVerdict({ ...roll, against });
    return `${sum} contra ${against} ${dc}: ${word}`;
}

/**
 * Con ventaja o desventaja: los dos dados y cuál se queda («con ventaja: 7 y 14, se queda el 14»).
 *
 * @param {RollShown} roll
 * @returns {string}
 */
export function edgeSentence(roll) {
    const rolls = Array.isArray(roll?.rolls) ? roll.rolls.map(Number).filter(Number.isFinite) : [];
    if (rolls.length < 2 || !roll?.edge || roll.edge === 'normal') return '';
    return `con ${roll.edge === 'advantage' ? 'ventaja' : 'desventaja'}: ${rolls.join(' y ')}, se queda el ${Number(roll.natural) || 0}`;
}

/** Un número al azar de la cara, para lo que se ve mientras rueda. */
function anyFace() {
    return 1 + Math.floor(Math.random() * 20);
}

/**
 * La cara del d20 en SVG: el hexágono de fuera, el triángulo del centro (donde va el número) y
 * las aristas que los unen, como se ve un icosaedro de frente.
 */
const D20_SVG = `
<svg class="vfx-die-svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
  <polygon class="vfx-die-body" points="50,3 91,26.5 91,73.5 50,97 9,73.5 9,26.5"/>
  <polygon class="vfx-die-face-tri" points="50,21 79,69 21,69"/>
  <g class="vfx-die-edges">
    <line x1="50" y1="21" x2="50" y2="3"/><line x1="50" y1="21" x2="9" y2="26.5"/><line x1="50" y1="21" x2="91" y2="26.5"/>
    <line x1="79" y1="69" x2="91" y2="26.5"/><line x1="79" y1="69" x2="91" y2="73.5"/><line x1="79" y1="69" x2="50" y2="97"/>
    <line x1="21" y1="69" x2="9" y2="26.5"/><line x1="21" y1="69" x2="9" y2="73.5"/><line x1="21" y1="69" x2="50" y2="97"/>
  </g>
  <polyline class="vfx-die-crack" points="30,12 41,30 35,41 52,52 46,64 61,78 57,92"/>
</svg>`;

/**
 * Un d20 para la tarjeta. `side` lo tiñe: el tuyo, azul noche con los números en oro; el de un
 * enemigo, granate.
 *
 * @param {{side?: 'party'|'enemy', kept?: boolean}} [options] `kept: false`, el dado que no se queda.
 * @returns {HTMLElement}
 */
export function buildDie({ side = 'party', kept = true } = {}) {
    const die = document.createElement('div');
    die.className = `vfx-die vfx-die-${side === 'enemy' ? 'enemy' : 'party'}${kept ? '' : ' vfx-die-dropped'}`;
    die.innerHTML = D20_SVG;
    const face = document.createElement('span');
    face.className = 'vfx-die-face';
    face.textContent = '20';
    die.appendChild(face);
    return die;
}

/**
 * Echa a rodar un dado ya puesto en la página: da vueltas mientras cambian los números. Devuelve
 * con qué pararlo en lo que ha salido; quien lo echa decide cuándo (y lo para antes si se pasa la
 * secuencia). Con 20, el brillo de oro; con 1, la grieta. Con `ms` 0, no rueda.
 *
 * @param {HTMLElement} die
 * @param {number} ms Lo que dura la vuelta en el CSS.
 * @returns {(natural: number) => void}
 */
export function spinDie(die, ms) {
    const face = /** @type {HTMLElement|null} */ (die.querySelector('.vfx-die-face'));
    /** @type {ReturnType<typeof setInterval>|null} */
    let timer = null;
    if (ms > 0) {
        die.style.setProperty('--vfx-tumble-ms', `${Math.round(ms)}ms`);
        die.classList.add('vfx-die-rolling');
        const started = Date.now();
        let ticks = 0;
        timer = setInterval(() => {
            ticks += 1;
            // Más despacio al final, como un dado que se para: la última parte, una de cada tres.
            if (Date.now() - started > ms * 0.65 && ticks % 3 !== 0) return;
            if (face) face.textContent = String(anyFace());
        }, 55);
    }
    return (natural) => {
        if (timer) clearInterval(timer);
        timer = null;
        die.classList.remove('vfx-die-rolling');
        die.classList.add('vfx-die-landed');
        if (face) face.textContent = String(natural);
        die.classList.toggle('vfx-die-nat20', natural === 20);
        die.classList.toggle('vfx-die-nat1', natural === 1);
    };
}

/**
 * El daño, dicho llano: «Daño: 7 (1d8 + 2)». Con crítico, los dados dos veces y lo dice.
 *
 * @param {{total: number, dice?: string, modifier?: number, crit?: boolean}} damage
 * @returns {string}
 */
export function damageSentence({ total, dice = '', modifier = 0, crit = false }) {
    const mod = Number(modifier) || 0;
    const parts = String(dice || '').trim();
    const how = parts ? `${parts}${mod ? ` ${mod > 0 ? '+' : '−'} ${Math.abs(mod)}` : ''}` : '';
    const said = how ? ` (${how}${crit ? ', crítico' : ''})` : (crit ? ' (crítico)' : '');
    return `Daño: ${Math.max(0, Number(total) || 0)}${said}`;
}
