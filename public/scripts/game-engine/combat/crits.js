/**
 * Criticos con efecto, rol del enemigo y moral (ideas 15, 13 y 6).
 *
 * - **Un critico se recuerda**: ademas del daño doble, hace algo segun el arma. Un golpe
 *   contundente derriba, uno cortante abre una herida que sangra al momento y uno
 *   perforante deja al enemigo clavado donde esta.
 * - **El rol del enemigo se ve en su ficha**: bruto, tirador, guardian, escaramuzador,
 *   cobarde o jefe. Se lee el tablero de un vistazo, antes de pulsar a nadie.
 * - **La moral**: con la mitad de su bando caido y malherido, el que no es jefe puede
 *   rendirse. Los combates de limpieza se acaban antes, y un jefe que aguanta solo se nota.
 *
 * Puro: decide. Quien llama aplica y cuenta.
 */

/**
 * @typedef {{kind: 'condition', condition: string, rounds: number, label: string}
 *   | {kind: 'damage', dice: string, label: string}} CritEffect
 */

/**
 * Lo que hace un critico, segun el tipo de daño del arma.
 *
 * @param {string} damageType bludgeoning, slashing, piercing (o en castellano). Sin arma, contundente.
 * @returns {CritEffect}
 */
export function critEffect(damageType) {
    const type = String(damageType ?? '').toLowerCase();
    if (/slash|cort/.test(type)) return { kind: 'damage', dice: '1d6', label: 'le abre una herida que sangra' };
    if (/pierc|perfor|punz/.test(type)) return { kind: 'condition', condition: 'Restrained', rounds: 1, label: 'lo deja clavado donde está' };
    return { kind: 'condition', condition: 'Prone', rounds: 1, label: 'lo tira al suelo' };
}

/** Los roles, con su icono y lo que dicen de un vistazo. */
export const ROLES = {
    jefe: { icon: 'fa-crown', label: 'Jefe: aguanta y no se rinde' },
    tirador: { icon: 'fa-crosshairs', label: 'Tirador: pega de lejos' },
    guardian: { icon: 'fa-shield-halved', label: 'Guardián: protege y aguanta' },
    escaramuzador: { icon: 'fa-wind', label: 'Escaramuzador: entra y sale' },
    cobarde: { icon: 'fa-person-running', label: 'Cobarde: huye en cuanto puede' },
    lanzador: { icon: 'fa-wand-sparkles', label: 'Lanzador: trae habilidades' },
    bruto: { icon: 'fa-hand-fist', label: 'Bruto: va de frente' },
};

/**
 * El rol de un enemigo, de lo que el motor ya sabe de el.
 *
 * @param {{boss?: boolean, profile?: string, attackRangeFeet?: number, range?: number, abilities?: any[]}} enemy
 * @returns {{id: string, icon: string, label: string}}
 */
export function roleOf(enemy) {
    const profile = String(enemy?.profile ?? '').toLowerCase();
    const reach = Number(enemy?.attackRangeFeet ?? enemy?.range) || 5;
    const abilities = Array.isArray(enemy?.abilities) ? enemy.abilities.length : 0;
    const id = enemy?.boss ? 'jefe'
        : profile === 'coward' ? 'cobarde'
            : reach > 10 || profile === 'ranged' ? 'tirador'
                : profile === 'guardian' ? 'guardian'
                    : profile === 'skirmisher' ? 'escaramuzador'
                        : abilities > 0 ? 'lanzador'
                            : 'bruto';
    return { id, ...ROLES[/** @type {keyof typeof ROLES} */ (id)] };
}

/**
 * Si un enemigo se rinde al empezar su turno.
 *
 * Se rinde quien no es jefe, esta por debajo de la mitad de su vida y ve caida a la mitad
 * (o mas) de su bando. Aun asi es una tirada: la mitad de las veces aguanta. El cobarde
 * no espera tanto: le basta con estar herido.
 *
 * @param {Object} input
 * @param {{boss?: boolean, profile?: string, currentHp: number, maxHp: number}} input.enemy
 * @param {number} input.started Cuantos empezaron el combate en su bando.
 * @param {number} input.standing Cuantos siguen en pie.
 * @param {() => number} input.random
 * @returns {boolean}
 */
export function breaksMorale({ enemy, started, standing, random }) {
    if (!enemy || enemy.boss) return false;
    const hp = Number(enemy.currentHp) || 0;
    const max = Math.max(1, Number(enemy.maxHp) || 1);
    if (hp <= 0 || hp / max >= 0.5) return false;
    const coward = String(enemy.profile ?? '').toLowerCase() === 'coward';
    const losing = Number(started) > 1 && Number(standing) / Number(started) <= 0.5;
    if (!coward && !losing) return false;
    return random() < (coward ? 0.75 : 0.5);
}

/**
 * Si el atacante tiene al objetivo flanqueado (idea 3): un aliado suyo pegado al objetivo
 * justo en el lado contrario. En 5e es una regla opcional; aqui da ventaja, y hace que la
 * postura «a la carga» y el colocarse importen.
 *
 * @param {{x: number, y: number}} attacker
 * @param {{x: number, y: number}} target
 * @param {Array<{x: number, y: number}>} allies Los demas de su bando, en pie.
 * @returns {boolean}
 */
export function isFlanked(attacker, target, allies) {
    const dx = Number(attacker?.x) - Number(target?.x);
    const dy = Number(attacker?.y) - Number(target?.y);
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== 1) return false;
    return (allies ?? []).some(ally => Number(ally?.x) - Number(target?.x) === -dx
        && Number(ally?.y) - Number(target?.y) === -dy);
}
