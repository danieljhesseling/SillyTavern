/**
 * Las claves con las que la partida guarda sus cosas: en los metadatos del chat (`*_KEY`)
 * y en este navegador (`*_STORAGE`, y `localFlag` para leerlo sin que falle).
 * Una hoja: no importa nada, y así cualquier módulo de `party/` la puede importar.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md).
 */

export const LOCATION_MAPS_MANUAL_HIDDEN_KEY = 'sillytavern_locationMapsManualHidden';

/**
 * Si el Modo Juego se abre solo al arrancar.
 *
 * Encendido por defecto: este fork es un juego, y un juego se abre por su pantalla de
 * titulo, no por la bandeja de entrada de un chat. Pero se apaga con un clic desde la
 * pausa, y apagado la aplicacion arranca exactamente como la de siempre.
 */
export const GAME_SHELL_AUTOSTART_KEY = 'sillytavern_gameShellAutostart';

/** Where the guard's mode lives, so it travels with the campaign. */
export const ROLL_GUARD_KEY = 'rollGuardMode';

/** Z1 de ROADMAP_SIN_TOKENS: las últimas frases del narrador del motor, para no repetirlas. */
export const NARRATOR_RECENT_KEY = 'narratorRecent';

/**
 * Z3: lo que ya se sacó hoy con tiradas en cada sitio (`keys`: sitio y habilidad) y lo que ya
 * se examinó (`looked`). Tirar veinte veces no da veinte bolsas.
 */
export const FIELD_GAINS_KEY = 'fieldGains';

/**
 * J19.10: la Luz lanzada fuera de combate (`castField` → `effects.light`): el día y la parte
 * del día en que se encendió, y quién. Dura lo que queda de esa parte del día.
 */
export const FIELD_LIGHT_KEY = 'fieldLight';
/** E2.1: la antorcha que arde, quién la lleva y desde qué parte del día (`board/light.js`). */
export const TORCH_KEY = 'torchLit';
/** E2.3: el descanso largo que una emboscada dejó a medias en la mazmorra, para reanudarlo. */
export const BROKEN_REST_KEY = 'restInterrupted';

/**
 * D-J50: el día en que se le preguntó a cada muerto con Hablar con los muertos (por su caso y su
 * nombre, `deadKey`). Hasta siete días después no se le vuelve a preguntar.
 */
export const SPOKEN_DEAD_KEY = 'spokenDead';

/** Z4: los sucesos que salieron, y los que volverán. */
export const SUCESOS_KEY = 'sucesos';

/** Z4: se pueden apagar (las vueltas de prueba lo hacen, para que no salgan tarjetas en medio). */
export const SUCESOS_STORAGE = 'sillytavern_gameSucesos';

/** R8: los que se fueron, con su ficha, por si vuelven. */
export const GONE_KEY = 'gone';

/** R7: los que escaparon y pueden volver. */
export const NEMESES_KEY = 'nemeses';

/** R5: la mascota del héroe, en los metadatos de la partida. */
export const PET_KEY = 'pet';

/** R1: el historial de modos de esta partida (DR2), para el salón de la fama. */
export const MODE_HISTORY_KEY = 'modeHistory';

/** J4.6: hacia dónde se dijo ya que se ajustan los enemigos (`up` o `down`). */
export const LEVEL_SAID_KEY = 'levelAdjustSaid';

/** Donde se apunta el dia en que vence la proxima cuenta. */
export const BILL_DUE_KEY = 'upkeepDueDay';

/** Los días de esta semana fuera (de camino o acampando): no se pagan comida ni posada. */
export const AWAY_DAYS_KEY = 'upkeepAwayDays';

/** El gremio y su tablon viven en la partida, no en la sesion. */
export const GUILD_KEY = 'guild';
export const BOARD_KEY = 'contractBoard';
export const TAKEN_KEY = 'contractTaken';

/** A quien se ha conocido ya en una posada: el paso antes de pedirle que venga. */
export const RECRUITS_MET_KEY = 'recruitsMet';
/** Lo que el grupo recuerda haber vivido junto (idea 34). */
export const MEMORIES_KEY = 'sharedMemories';

/** Los encargos escritos ya entregados, y los rumores ya oidos. */
export const WRITTEN_DONE_KEY = 'writtenDone';
export const RUMORS_HEARD_KEY = 'rumorsHeard';

/** U8 del pegamento: quién está fuera haciendo un encargo sin el héroe. */
export const DISPATCHES_KEY = 'dispatches';

/** U8 del pegamento: los casos con verdad. */
export const CASES_KEY = 'cases';
/** U6 del pegamento: con quién se ha tenido ya un duelo hoy. */
export const DUELS_KEY = 'duels';
/** Ideas 69 y 70: dónde se ha estado, y las notas del mapa. */
export const VISITED_KEY = 'visited';
export const MAP_NOTES_KEY = 'mapNotes';
/** J10.1: lo que abre caminos sin ser un objeto (una barca, un guía que se ofrece). */
export const WORLD_KEYS_KEY = 'worldKeys';
/** J10.1: los caminos con puerta que ya estaban abiertos, para decir una vez cuándo se abre uno. */
export const GATES_OPEN_KEY = 'gatesOpen';

/** U5 del pegamento: la mesa de la semana. */
export const WEEK_TABLE_KEY = 'weekTable';
/** Si se abre sola cada semana (ajuste); si no, solo la primera vez y luego un aviso (DU4). */
export const WEEK_TABLE_AUTO_KEY = 'weekTableAuto';

/** Donde se apunta el clima del sitio donde estais. */
export const CLIMATE_KEY = 'climate';

/** Donde se apunta lo que se debe, y a quien. */
export const DEBT_KEY = 'debt';

/** Lo que el grupo ha hecho y el mundo ha visto. */
export const DEEDS_KEY = 'deeds';

/** U0 del pegamento: el diario de sesión, en esta pestaña. */
export const SESSION_LOG_KEY = 'sillytavern_gameSession';

/** El hilo de la campana, y por donde va. */
export const PLOT_KEY = 'plot';
export const PLOT_STATE_KEY = 'plotState';
/** Si la mecha ya se ha contado. */
export const PLOT_ANNOUNCED_KEY = 'plotAnnounced';
/** J9.2: los hitos cuya escena ya se jugó en su ventana (no se juega dos veces). */
export const PLOT_SCENES_PLAYED_KEY = 'plotScenesPlayed';
/** J9.6: lo que se decidió en las escenas del hilo, y lo que se apuntó en ellas, para el Diario. */
export const PLOT_DECISIONS_KEY = 'plotDecisions';
/** J8.6: lo que se recuerda de las charlas con ramas (`readDialogueMemory`). */
export const DIALOGUE_MEMORY_KEY = 'dialogues';
/**
 * J9.2 y J8: las escenas y las charlas escritas se abren en su ventana. Se pueden apagar (las
 * vueltas de prueba que no miran eso lo hacen, como con los sucesos): entonces se cuentan en
 * el chat, como antes.
 */
export const STORY_WINDOWS_STORAGE = 'sillytavern_gameStoryWindows';

/** J4.5: cómo empezó el grupo la campaña, para contar al final lo que se lleva cada uno. */
export const CAMPAIGN_START_KEY = 'campaignStart';

/** Lo que el narrador ha propuesto y nadie ha ido a buscar todavia. */
export const PROPOSALS_KEY = 'placeProposals';
/** Cuantas veces se ha explorado: es parte de la semilla del siguiente hallazgo. */
export const EXPLORED_KEY = 'explored';

/** El dia en que se oyo cada rumor (idea 91). */
export const RUMORS_HEARD_ON_KEY = 'rumorsHeardOn';
/** Los prisioneros que lleva el grupo (idea 7). */
export const PRISONERS_KEY = 'prisoners';

/**
 * Los tableros cuya pelea escrita ya se ganó, como `sitio::tablero`: sus enemigos no vuelven a
 * dibujarse ni a ofrecer pelea (2026-09-28).
 */
export const BOARDS_WON_KEY = 'boardsWon';

/**
 * Tanda 16: la misión de un tablero que quedó a medias al acabar su pelea (sin nadie en pie, pero
 * sin haber llegado a la ventana): `{place, board, left, round}`. Se cumple andando, fuera de combate.
 */
export const OBJECTIVE_LEFT_KEY = 'objectiveLeft';

/** Los d20 que ha tirado el motor (idea 168). */
export const DICE_LOG_KEY = 'diceLog';
/** El regateo de hoy (idea 126): donde, que dia y si salio. */
export const HAGGLE_KEY = 'haggle';
/** Las cartas que esperan, y las ya mandadas (idea 113). */
export const LETTERS_KEY = 'letters';
export const LETTERS_SENT_KEY = 'lettersSent';
/** La ultima fiesta contada (idea 89): para no contarla dos veces el mismo dia. */
export const FESTIVAL_TOLD_KEY = 'festivalTold';
/** La partida en numeros (idea 200). */
export const STATS_KEY = 'stats';
/** El largo de la narracion elegido en la partida (idea 149). */
export const LENGTH_KEY = 'narrationLength';
/** Las tumbas de quien ha muerto, con su epitafio (idea 36). */
export const GRAVES_KEY = 'graves';
/** La fama del grupo, sitio a sitio (idea 52). */
export const FAME_KEY = 'fame';
/** Las reliquias ya entregadas (idea 132): cada una llega una vez. */
export const RELICS_GIVEN_KEY = 'relicsGiven';
/** Lo que ya han dicho los confidentes al llegar a cada sitio (idea 45). */
export const ARRIVALS_HEARD_KEY = 'arrivalsHeard';
/** Los secretos de la gente: los sabidos y los intentos de hoy (idea 110). */
export const SECRETS_KEY = 'npcSecrets';
/** Las monturas del grupo (idea 129). */
export const MOUNTS_KEY = 'mounts';
/** Las partidas de dados de hoy en la taberna (idea 128). */
export const DICE_GAME_KEY = 'tavernDice';
/** La letra del narrador (idea 195). */
export const NARRATOR_FONT_KEY = 'narratorFont';
/** El tiempo de hoy donde se está, cuando se sabe por el viaje (ideas 73 y 90). */
export const WEATHER_TODAY_KEY = 'weatherToday';
// Batería 7: lo que les parece a los compañeros (28, 32), a quién se le ofreció ya su
// encargo (30) y quién se queda en casa (42).
export const APPROVAL_KEY = 'approval';
export const PERSONAL_ASKED_KEY = 'personalAsked';
export const BENCH_KEY = 'bench';
// Idea 139: lo que el narrador ofrece coger.
export const OFFERS_KEY = 'itemOffers';
// Idea 142: el tono de la escena, elegido en la pausa.
export const TONE_KEY = 'sceneTone';
// Batería 8: la red de seguridad (25), quién ya avisó que se va (29), dónde os buscan (96) y
// el almacén del gremio (124).
export const SAFETY_KEY = 'safety';
export const SAFETY_ON_KEY = 'safetyNet';
export const LEAVE_ON_KEY = 'companionsLeave';
export const WARNED_KEY = 'departWarned';
export const WANTED_KEY = 'wanted';
export const STORAGE_KEY = 'guildStorage';
// Batería 8: las escenas del villano ya contadas (115), la actitud de la gente (140), los
// resúmenes de cada acto y dónde empezó cada uno en el chat (143), y si el hilo ya se adaptó
// al héroe (184).
export const VILLAIN_SEEN_KEY = 'villainSeen';
export const ATTITUDES_KEY = 'attitudes';
export const ACT_SUMMARIES_KEY = 'actSummaries';
export const ACT_STARTS_KEY = 'actStarts';
export const HERO_FIT_KEY = 'heroFit';
/** Idea 183: los ajustes de ilustraciones son de esta máquina (llevan una clave). */
export const ART_STORAGE = 'sillytavern_illustrations';

/** Lo que se guarda en este navegador, sin que falle si no se puede. */
export const localFlag = {
    /** @param {string} key @returns {string} */
    get(key) {
        try { return String(globalThis.localStorage?.getItem(key) ?? ''); } catch { return ''; }
    },
    /** @param {string} key @param {string} value */
    set(key, value) {
        try { globalThis.localStorage?.setItem(key, value); } catch { /* sin almacenamiento: se juega igual */ }
    },
};
/** Idea 148: el modo ahorro, en este navegador. */
export const SAVER_KEY = 'sillytavern_gameSaver';
/** Idea 172: los colores para daltonismo, en este navegador. */
export const COLORBLIND_KEY = 'sillytavern_gameColorblind';
/** Idea 155: los consejos ya vistos, en este navegador. */
export const TIPS_SEEN_KEY = 'sillytavern_gameTipsSeen';

/** Las pistas del hilo: cuando se abrio cada hito, que nivel se ha dado y cuales. */
export const HINTS_KEY = 'threadHints';
/** Las tiradas que ha pedido el narrador y esperan a que se tiren (idea 138). */
export const CHECK_REQUESTS_KEY = 'checkRequests';

/** Las noticias que esperan a que el grupo llegue a donde se oyen (idea 82). */
export const NEWS_KEY = 'newsPending';

/** Lo que se guarda con el chat y no vive en `party/campaign-state.js`. */
export const CONTRADICTIONS_KEY = 'contradictions';
export const SEED_KEY = 'diceSeed';

/** La tirada hecha que todavia no se ha enviado. Una por mensaje. */
export const PENDING_CHECK_KEY = 'pendingCheck';

/** Z6 de ROADMAP_SIN_TOKENS: quién cuenta la partida. Es de quien juega, no de la campaña. */
export const NARRATOR_MODE_STORAGE = 'sillytavern_gameNarrator';
