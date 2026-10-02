/**
 * Ayuda la primera vez y glosario (ideas 155 y 156).
 *
 * - **Consejos**: la primera vez que aparece cada cosa (el combate, la exploración, el diario),
 *   un aviso corto que dice qué hacer con ella. Una vez, y ya: el que se repite molesta.
 *   Desde J2.2 («Enseña jugando»), también la primera vez que **pasa** algo: te toca andar,
 *   tienes a alguien al alcance, sale una tirada, hablas con alguien, se apunta algo en el
 *   Diario. Y de uno en uno: si ya hay uno en pantalla, el siguiente espera a que se cierre.
 * - **Glosario**: las palabras de las reglas, dichas en llano. Se abre con la L o desde
 *   «¿Qué hago?».
 *
 * Los vistos se guardan en el navegador, no en el héroe: quien aprende es quien juega, y el
 * segundo personaje no tiene que volver a leerlos.
 *
 * Puro: qué consejo toca, cuál espera y qué dice cada palabra.
 */

/** Un consejo por situación, la primera vez que se ve. */
export const TIPS = {
    dialogue: 'Escribe lo que hace tu personaje, o usa las fichas de abajo. Arriba, el diario (D) y «¿Qué hago?» (H).',
    exploration: 'Aquí están los servicios del sitio y el mapa: pulsa un sitio para viajar. Cada viaje cuesta días y comida.',
    // J2.2: al empezar la primera pelea, no al abrir el tablero (sin pelea, el tablero solo se mira).
    combat: 'Empieza la pelea: cada uno en su turno. Abajo, tu barra: lo que te queda (Acción, Adicional, Reacción, pies) y «Atacar», «Magia», «Acciones» y «Adicional».',
    travel: 'El ritmo decide: rápido llega antes pero sin dormir; con cuidado se esquivan contratiempos.',
    prisoners: 'Un prisionero se puede interrogar (da un rumor), entregar donde hay autoridad o soltar.',
    // H1 de wiki/LO_QUE_FALTA.md: lo nuevo, un sistema cada vez, cuando aparece por primera vez.
    high: 'Estás en alto: desde aquí se ataca con ventaja a quien está abajo. Subir cuesta el doble.',
    // J15.4: cada consejo nombra el botón, no el comando: sin conexión no hay dónde escribirlo.
    spell: 'Los conjuros gastan cargas por círculo, que vuelven con el descanso largo. La ficha de quien lanza (pulsa su retrato) dice cuántas quedan y qué componente piden los gordos.',
    // D-J49: la ficha «Magia» de la escena solo sale cuando algo sirve ahí; lo demás, en la ficha.
    fieldMagic: 'Para curar, alumbrar o hacer rituales sin pelear: pulsa tu retrato, abajo, y «Magia fuera de combate». En la escena solo sale cuando sirve ahí mismo.',
    pet: 'Tu mascota no ocupa plaza ni cobra: comenta lo que pasa y ayuda en el tablero sin pelear en serio. En la pausa, «Mascota», para verla y acariciarla.',
    bill: 'Ha llegado la cuenta de la semana: comida, sueldos y posada. La «Mesa», arriba, dice qué se paga; quien no cobra acaba yéndose.',
    // J2.2 («Enseña jugando»): lo que se aprende en el momento en que pasa por primera vez.
    move: 'Te toca. Para andar, pulsa tu ficha y luego una casilla encendida, o arrástrala. Cuando acabes, «Fin de turno».',
    attack: 'Tienes un enemigo al alcance: púlsalo para ver cuánto le das, y luego «Atacar».',
    // Sale también con la tirada de un enemigo: por eso «quien tira», y no «tú».
    roll: 'Una tirada: un dado de 20 más lo que sabe hacer quien tira. Si llega a la Dificultad (la CA de quien recibe el golpe, o la CD), sale.',
    talk: 'Pulsa un tema para preguntar: cuánto te cuenta depende de cómo te mire. «Despedirse» acaba la charla.',
    journal: 'Queda apuntado en el Diario (tecla D): lo que habéis hecho y lo que toca ahora.',
};

/** Los consejos de J2.2, los de un momento: salen cuando pasa la cosa, estés en la escena que estés. */
export const MOMENT_TIPS = ['combat', 'move', 'attack', 'roll', 'talk', 'journal'];

/**
 * El consejo que toca ahora, si no se ha visto ya.
 *
 * @param {string} situation Una de las claves de `TIPS`.
 * @param {string[]} seen
 * @returns {{id: string, text: string}|null}
 */
export function tipFor(situation, seen) {
    const id = String(situation ?? '');
    if (!(id in TIPS) || (seen || []).includes(id)) return null;
    return { id, text: TIPS[/** @type {keyof typeof TIPS} */ (id)] };
}

/**
 * J2.2: un consejo cada vez. Si ya hay uno en pantalla, el nuevo espera detrás, en el orden
 * en que pasaron las cosas; si ya se vio o ya espera, no se hace nada.
 *
 * @param {{situation: string, seen: string[], queue: string[], busy: boolean}} input
 *   `busy`: si hay un consejo a la vista.
 * @returns {{show: {id: string, text: string}|null, queue: string[]}}
 */
export function planTip({ situation, seen, queue, busy }) {
    const waiting = (Array.isArray(queue) ? queue : []).filter(id => tipFor(id, seen));
    const tip = tipFor(situation, seen);
    if (!tip) return { show: null, queue: waiting };
    if (busy) return { show: null, queue: waiting.includes(tip.id) ? waiting : [...waiting, tip.id] };
    return { show: tip, queue: waiting.filter(id => id !== tip.id) };
}

/**
 * J2.2: el siguiente que espera y aún no se ha visto. Los que se vieron mientras esperaban
 * (en otra pestaña, o porque se marcaron a mano) se quitan. Y los que ya no vienen a cuento
 * también: «tienes un enemigo al alcance» con la pelea acabada confunde. Esos no cuentan
 * como vistos: saldrán la próxima vez que pase la cosa.
 *
 * @param {string[]} queue
 * @param {string[]} seen
 * @param {(id: string) => boolean} [fits] Si lo que enseña sigue ahí (tu turno, la charla…).
 * @returns {{id: string, queue: string[]}} `id` vacío si no queda ninguno.
 */
export function nextQueuedTip(queue, seen, fits = () => true) {
    const waiting = (Array.isArray(queue) ? queue : []).filter(id => tipFor(id, seen));
    const index = waiting.findIndex(id => fits(id));
    if (index === -1) return { id: '', queue: [] };
    return { id: waiting[index], queue: waiting.slice(index + 1) };
}

/** Las palabras de las reglas, en llano. */
export const GLOSSARY = [
    { term: 'CA (clase de armadura)', means: 'Lo difícil que es acertarte. Para dar, la tirada de ataque tiene que llegar a la CA del otro.' },
    { term: 'CD (dificultad)', means: 'Lo que hay que sacar en una tirada para que salga. 10 es fácil; 15, difícil; 20, casi imposible.' },
    { term: 'PG (puntos de golpe)', means: 'La vida. A 0 caes y empiezas a tirar salvaciones de muerte.' },
    { term: 'Ventaja y desventaja', means: 'Se tiran dos d20: con ventaja te quedas el mayor; con desventaja, el menor. Una anula a la otra.' },
    { term: 'Iniciativa', means: 'El orden del combate. La moral del grupo y un centinela la suben.' },
    { term: 'Ataque de oportunidad', means: 'Si te alejas de un enemigo que te tiene pegado, te golpea gratis. Destrabarse lo evita.' },
    { term: 'Cobertura', means: 'Estar detrás de algo suma a tu CA: media, +2; tres cuartos, +5.' },
    { term: 'Salvación de muerte', means: 'A 0 PG, un d20 por turno: tres éxitos y te estabilizas; tres fallos y se acabó.' },
    { term: 'Crítico', means: 'Un 20 natural: siempre acierta, hace el doble de daño y, según el arma, algo más.' },
    { term: 'Competencia', means: 'Lo que se te da bien por tu clase o tu trasfondo: suma a esas tiradas.' },
    { term: 'Descanso corto y largo', means: 'El corto cura un poco gastando dados de golpe; el largo, del todo, y amanece.' },
    { term: 'Vínculo', means: 'Lo que te une a un compañero. Sube con lo que vivís juntos y da ventajas en combate.' },
    { term: 'Reputación', means: 'Lo que una facción piensa de vosotros, de −5 a +5. Mueve precios, peajes y cartas.' },
    { term: 'Hito', means: 'Un paso del hilo de la historia. El diario dice cuál tenéis entre manos.' },
    // Lo que llegó con la profundidad (R1–R10) y con B1 y B2.
    { term: 'Modo', means: 'Cuánto pesa la partida: Relajado, Normal, Supervivencia o a tu medida. Seis letras que encienden heridas, cuenta, mundo, cuerpo, hierro e intemperie. Se cambia en la pausa.' },
    { term: 'Carga (de conjuro)', means: 'Cuántos conjuros de cada círculo quedan: tres de primero, dos de segundo, uno de tercero. Vuelven con el descanso largo.' },
    { term: 'Componente', means: 'Lo que gasta un conjuro gordo: polvo de hueso, ámbar, una pluma. Sale de los trofeos de caza y de la tienda.' },
    { term: 'En alto', means: 'Una casilla elevada (torre, escalones, empalizada). Subir cuesta el doble; desde arriba se ataca con ventaja.' },
    { term: 'Salida', means: 'Una casilla por la que irse de la pelea. Quien sale ya no pelea; cuando salís todos, se acaba en huida.' },
];
