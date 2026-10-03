/**
 * Tanda 17: lo que el motor deja en la secuencia del combate (`game-engine/ui/combat-vtt/fx.js`).
 *
 * El motor sigue decidiendo como siempre; aquí solo se traduce lo que decide (quién pega a quién,
 * qué ha salido en el dado, cuánto daño) a pasos de la secuencia, con las fichas del tablero y la
 * vida que queda. Lo llaman los golpes (`player-actions.js`, `enemy-turn.js`, `combat-bar.js`), el
 * turno que pasa (`combat-flow.js`) y las dos puertas de lo que se ve de una tirada
 * (`showCombatDiceRoll` y `floatOnToken`, en `combat-log.js`).
 *
 * Fuera del Modo Juego, o sin pelea a la vista, nada de esto se usa y todo va como antes.
 */

import { combatEncounter, partyMembers } from './state.js';
import { afterFx as afterSequence, fxBusy, fxLength, holdRedraw as holdForSequence, pushFx } from '../game-engine/ui/combat-vtt/fx.js';

/**
 * Lo que quiere redibujar el tablero o la pantalla: con una secuencia enseñándose, se hace al
 * acabarla (y devuelve `true`). Ver `holdRedraw` en combat-vtt/fx.js.
 *
 * @param {() => void} redraw
 * @returns {boolean}
 */
export function holdRedraw(redraw) {
    return holdForSequence(redraw);
}

/**
 * Hacer algo cuando acabe la secuencia (el panel de victoria), o ya si no hay ninguna.
 *
 * @param {() => void} fn
 */
export function afterFx(fn) {
    afterSequence(fn);
}

/**
 * @typedef {Object} RollStage Lo que pide un golpe para verse en la secuencia (en
 *   `showCombatDiceRoll({..., stage})`).
 * @property {any} [by] Quien ataca (un miembro del grupo, un enemigo o una invocación).
 * @property {any} [at] A quién.
 * @property {'melee'|'ranged'|'spell'|'throw'} [style] Cómo sale el golpe.
 * @property {boolean} [hit] Lo que ha decidido el motor.
 * @property {{natural: number, rolls: number[]}} [roll] Los dados (dos, con ventaja o desventaja).
 * @property {'advantage'|'disadvantage'|'normal'} [edge]
 * @property {'CA'|'CD'} [against] Contra qué es el número de la tirada.
 * @property {'you'|'enemy'} [side] De qué lado es el dado (el color).
 * @property {boolean} [save] Tira quien lo recibe (una salvación, resistirse): si no la supera, no
 *   hay «Falla».
 * @property {string} [dice] El daño: sus dados («1d8», «1d8 + 1d8» con crítico).
 * @property {number} [modifier] El daño: lo que se suma.
 * @property {boolean} [crit]
 * @property {string} [damageType] J12.19: el tipo de daño o el arma, para dibujar cómo llega el
 *   golpe; sin decir, el del arma que lleva quien ataca.
 */

/**
 * J12.19: con qué pega alguien, en palabras («cortante Espada corta»), para que el golpe se dibuje
 * según lo que es: el tipo de daño y el nombre del arma que lleva puesta; un enemigo, lo que diga.
 *
 * @param {any} who
 * @returns {string}
 */
export function blowTypeOf(who) {
    if (!who) return '';
    const items = Array.isArray(who.items) ? who.items : [];
    const weaponId = who.equippedItems?.weapon;
    const weapon = weaponId ? items.find((/** @type {any} */ i) => i?.id === weaponId) : null;
    if (weapon) return `${weapon.damageType || ''} ${weapon.name || ''}`.trim();
    return String(who.damageType ?? who.attackName ?? who.weapon ?? '').trim();
}

/**
 * Si la secuencia se ve: hay una en marcha, o hay pelea y su tablero está en el Modo Juego.
 *
 * @returns {boolean}
 */
export function fxOn() {
    if (typeof document === 'undefined') return false;
    if (fxBusy()) return true;
    return Boolean(combatEncounter.active && document.querySelector('#game-shell .wm-token'));
}

/**
 * La ficha de alguien en el tablero: la de un enemigo va por su sitio en la lista (`-1`, `-2`…,
 * como `enemyTokenId`); la del grupo y la de una invocación, por su id.
 *
 * @param {any} who
 * @returns {number|string|null}
 */
export function tokenIdOf(who) {
    if (!who) return null;
    const index = combatEncounter.enemies.indexOf(who);
    if (index >= 0) return -(index + 1);
    return who.id ?? null;
}

/**
 * La ficha de quien tiene un turno.
 *
 * @param {{id: any, isEnemy?: boolean}} entry
 * @returns {number|string|null}
 */
function tokenIdOfEntry(entry) {
    if (!entry) return null;
    if (entry.isEnemy) {
        const index = combatEncounter.enemies.findIndex(e => String(e.instanceId) === String(entry.id));
        return index >= 0 ? -(index + 1) : null;
    }
    return entry.id ?? null;
}

/**
 * Quién hay detrás de una ficha, con la vida que le queda ahora: su fila en la iniciativa
 * (`entryId`), su vida y su máximo.
 *
 * J12.19: y su nombre y su lado, para decir quién cae.
 *
 * @param {any} tokenId
 * @returns {{entryId: string, hp: number, max: number, name: string, team: 'enemy'|'party'}|null}
 */
export function whoIsToken(tokenId) {
    const n = Number(tokenId);
    if (Number.isFinite(n) && n < 0 && n > -1000) {
        const enemy = combatEncounter.enemies[-n - 1];
        return enemy ? { entryId: String(enemy.instanceId), hp: Number(enemy.currentHp) || 0, max: Number(enemy.maxHp) || 0, name: String(enemy.name ?? ''), team: 'enemy' } : null;
    }
    const summons = Array.isArray(/** @type {any} */ (combatEncounter).summons) ? /** @type {any} */ (combatEncounter).summons : [];
    const member = partyMembers.find(m => String(m.id) === String(tokenId)) ?? summons.find((/** @type {any} */ s) => String(s.id) === String(tokenId));
    return member ? { entryId: String(member.id), hp: Number(member.hp) || 0, max: Number(member.maxHp) || 0, name: String(member.name ?? ''), team: 'party' } : null;
}

/**
 * Empieza el turno de alguien.
 *
 * @param {{id: any, name: string, isEnemy?: boolean}} entry
 * @param {'you'|'ally'|'enemy'} side Tuyo (o de quien mueves tú), de un compañero que va solo o
 *   de un enemigo.
 */
export function stageTurn(entry, side) {
    if (!entry || !fxOn()) return;
    // El tuyo cierra lo que estaba sonando (el turno de los demás); sin nada sonando, no hace falta
    // esperar a nada: el tablero lo dice al dibujarse.
    if (side === 'you' && !fxBusy()) return;
    pushFx({ kind: 'turn', entryId: String(entry.id), tokenId: tokenIdOfEntry(entry), name: String(entry.name ?? ''), side });
}

/**
 * Dónde va ahora el siguiente paso de la secuencia, para meter otro ahí después (`stageMove`).
 * Sirve dentro de una misma jugada del motor, que va de una vez.
 *
 * @returns {number}
 */
export function fxMark() {
    return fxLength();
}

/**
 * Alguien anda por un camino (de la casilla de salida a la de llegada). Con `at` (de `fxMark`), el
 * paso va ahí: antes de lo que le ha pasado por el camino.
 *
 * @param {any} who
 * @param {Array<{x: number, y: number}>} path
 * @param {number} [at]
 */
export function stageMove(who, path, at) {
    if (!who || !Array.isArray(path) || path.length < 2 || !fxOn()) return;
    pushFx({ kind: 'move', tokenId: tokenIdOf(who), path: path.map(c => ({ x: Number(c.x) || 0, y: Number(c.y) || 0 })) }, at);
}

/**
 * Algo que se hace en lo que se ve (una ficha que cae al vacío) en su sitio de la secuencia: si hay
 * una en marcha, cuando llegue; si no, ya.
 *
 * @param {() => void} fn
 */
export function stageCall(fn) {
    if (typeof fn !== 'function') return;
    if (fxOn() && fxBusy()) pushFx({ kind: 'call', fn });
    else fn();
}

/**
 * Un golpe que sale sin tirada propia en `showCombatDiceRoll` (un conjuro desde la barra).
 *
 * @param {any} by
 * @param {any} at
 * @param {'melee'|'ranged'|'spell'|'throw'} style
 * @param {number} [mark] De `fxMark`: el golpe va ahí, antes de lo que hizo al llegar.
 * @param {string} [damageType] J12.19: el tipo de daño o el nombre del conjuro (cómo se dibuja).
 */
export function stageAttack(by, at, style, mark, damageType = '') {
    if (!by || !at || by === at || !fxOn()) return;
    pushFx({ kind: 'attack', from: tokenIdOf(by), to: tokenIdOf(at), style, damageType: String(damageType || (style === 'spell' ? '' : blowTypeOf(by))) }, mark);
}

/**
 * La puerta de `showCombatDiceRoll`: una tirada con `stage` va a la secuencia (el golpe, el dado y,
 * si falla, el «Falla»); una sin él, con una secuencia en marcha, saca su ventana de siempre en su
 * sitio (después de lo que ya estaba). Si devuelve `false`, la tirada va como antes.
 *
 * @param {{title?: string, subtitle?: string, formula?: string, total?: number, dc?: number|null, natural?: number|null, glyph?: string, stage?: RollStage|null}} payload
 * @param {() => void} showWindow La ventana de dados de siempre, para cuando toque.
 * @returns {boolean}
 */
export function stageRoll(payload, showWindow) {
    if (!fxOn()) return false;
    const stage = payload?.stage;
    if (!stage) {
        if (!fxBusy()) return false;
        pushFx({ kind: 'call', fn: showWindow });
        return true;
    }
    if (payload.glyph === 'dmg') {
        pushFx({ kind: 'damage', total: Number(payload.total) || 0, dice: String(stage.dice ?? payload.formula ?? ''), modifier: Number(stage.modifier) || 0, crit: Boolean(stage.crit) });
        return true;
    }
    const from = tokenIdOf(stage.by);
    const to = tokenIdOf(stage.at);
    if (from !== null && to !== null && stage.by !== stage.at) {
        pushFx({ kind: 'attack', from, to, style: stage.style ?? 'melee', damageType: String(stage.damageType ?? blowTypeOf(stage.by)) });
    }
    const natural = Number(payload.natural ?? stage.roll?.natural) || 0;
    const enemySide = stage.side ? stage.side === 'enemy' : combatEncounter.enemies.includes(stage.by);
    pushFx({
        kind: 'roll',
        title: String(payload.title ?? ''),
        subtitle: String(payload.subtitle ?? ''),
        natural,
        total: Number(payload.total) || 0,
        dc: payload.dc ?? null,
        against: stage.against ?? (payload.dc == null ? '' : 'CA'),
        hit: typeof stage.hit === 'boolean' ? stage.hit : null,
        rolls: Array.isArray(stage.roll?.rolls) ? stage.roll.rolls : [natural],
        edge: stage.edge ?? 'normal',
        side: enemySide ? 'enemy' : 'you',
    });
    // Un golpe que no entra: el objetivo se aparta. Una salvación (tira quien la recibe), no.
    if (stage.hit === false && to !== null && !stage.save) pushFx({ kind: 'miss', tokenId: to });
    return true;
}

/**
 * La puerta de `floatOnToken`: en pelea, lo que sale de una ficha (el daño, la cura) llega en su
 * sitio de la secuencia, con la vida que deja. Un grito, solo si ya hay secuencia (si no, como antes).
 *
 * @param {number|string} tokenId
 * @param {string} text
 * @param {'damage'|'crit'|'heal'|'bark'} kind
 * @returns {boolean} Si va en la secuencia.
 */
export function stageFloat(tokenId, text, kind) {
    if (!fxOn()) return false;
    if (kind === 'bark') {
        if (!fxBusy()) return false;
        pushFx({ kind: 'bark', tokenId, text: String(text ?? '') });
        return true;
    }
    const who = whoIsToken(tokenId);
    pushFx({
        kind: 'impact', tokenId, entryId: who?.entryId ?? '', text: String(text ?? ''), style: kind, hp: who?.hp ?? 0, max: who?.max ?? 0,
        // J12.19: quién es, por si cae.
        name: who?.name ?? '', team: who?.team ?? 'enemy',
    });
    return true;
}
