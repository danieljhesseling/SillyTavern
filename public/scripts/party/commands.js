/**
 * Los comandos de barra del juego: moverse (`/go`, `/enter`), pelear, descansar, el gremio,
 * los casos, hablar, tirar y los ajustes. Todos se registran en `registerPartyCommands`, en el
 * orden de siempre.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { POPUP_TYPE, Popup } from '../popup.js';
import { chat_metadata, saveMetadata } from '../../script.js';
import { getCurrentWorldLocationMaps, getCurrentWorldBoards, getCurrentWorldEnemies } from '../world-info.js';
import { SlashCommandParser } from '../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument } from '../slash-commands/SlashCommandArgument.js';
import { SlashCommandEnumValue } from '../slash-commands/SlashCommandEnumValue.js';
import { createSeededRandom, seedFrom } from '../game-engine/combat/seeded-random.js';
import { getDistanceInFeet, setRandomSource } from './combat-rules.js';
import { stanceOf, STANCES } from '../game-engine/combat/ally-ai.js';
import { toggleCondition } from '../game-engine/combat/initiative-tracker.js';
import { holdDuringCombat } from '../game-engine/combat/combat-hold.js';
import { SKILLS } from '../game-engine/rules/checks.js';
import { formatCalendar } from '../game-engine/campaign/calendar.js';
import { getBondProgress, BOND_EVENTS } from '../game-engine/campaign/bonds.js';
import { summariseContradictions } from '../game-engine/ui/contradiction-log.js';
import { normalizeCheckpoints, describeCheckpoint, CHECKPOINT_KEY } from '../game-engine/campaign/checkpoint.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import { CONTRADICTIONS_KEY, ROLL_GUARD_KEY, SEED_KEY } from './keys.js';
import {
    combatEncounter, currentBoardName, currentLocationName, partyMembers, setCurrentBoardName,
    setCurrentLocationName,
} from './state.js';
import { restoreCheckpoint, saveCheckpoint } from './checkpoints.js';
import { openPetPanel } from './pet.js';
import { learnFromScroll, openAbilitiesEditor, openGrimoire } from './magic.js';
import { openGuild, openHubCampaigns, openHubHire, skipHubTrial } from './hub.js';
import { askAboutCase, askTheDead, duelWith, openCaseBoard, searchCaseHere, startCase } from './cases.js';
import {
    getAttackableEnemiesForMember, getCurrentActingMember, getCurrentTurnEntry, getPartyMemberByTurnEntry,
    saveCombatState,
} from './combat-state.js';
import { answerTruce, endCombat, judgeCurrentScenario, leaveThroughExit, startCombat } from './combat-flow.js';
import {
    endPlayerCombatTurn, handleBatonPass, handlePlayerCombatAttack, handlePlayerCombatMove, performManeuver,
    resolveUltimateStrike, throwItem, throwScenery,
} from './player-actions.js';
import { enterBoard, stairsHere } from './board.js';
import { renderLocationMapsPreview } from './board-view.js';
import { getLocationBoards, lastHubHome, saveCurrentBoard, saveCurrentLocation, worldNpc } from './world.js';
import {
    advanceCampaignDay, advanceCampaignSlot, getCampaignBonds, getCampaignCalendar, openWeekTable,
    recordCampaignBondEvent, showWeeklyBill, takeRest,
} from './time.js';
import { openEnding } from './plot.js';
import { exploreHere } from './world-growth.js';
import { openGameMode } from './modes.js';
import { getRollGuardMode, postCombatNarration, tellBoard } from './narration.js';
import { savePartyState } from './roster.js';
import { changeAttitude, setMemberStance } from './companions.js';
import { acceptOffer, lookAt, offerItem, pryNpc, runSkillCheck, startTalk } from './talk.js';
import { campNight, runForage, travelWithTime } from './travel.js';
import { handlePrisoner, hearRumor } from './town.js';
import { toggleGameMode } from './shell.js';
import {
    checkCurrentWorld, editBoardEncounters, editBoardObjectives, exportCampaignPack, openAudioSettings,
    openCampaignBuilder, openHallOfFame, openHowToPlay, openRules, openStateView, openTextMap,
} from './menus.js';
import { setPartyTab } from './main.js';
import { registerSocialCommands } from './social.js';

/**
 * Los comandos del grupo (`/go`, `/fight`, `/tirada`...), con los proveedores de nombres que
 * los autocompletan. En el orden de siempre: `initPartyPanel` los registra al montar el panel.
 */
export function registerPartyCommands() {
    // ================================================================
    //  Slash commands: /go, /enter, /leave
    // ================================================================

    /** Helper: enum provider listing current world's location names */
    function locationEnumProvider() {
        return getCurrentWorldLocationMaps().map(l => new SlashCommandEnumValue(l.name, l.region || ''));
    }

    /** Helper: enum provider listing boards at the current location */
    function boardEnumProvider() {
        const loc = getCurrentWorldLocationMaps().find(l => l.name === currentLocationName);
        const locBoards = getLocationBoards(loc);
        const globalBoards = getCurrentWorldBoards();
        console.log('[party] boardEnumProvider', { currentLocationName, loc: loc?.name, locBoardsLength: locBoards.length, locBoards, globalBoardsLength: globalBoards.length });
        if (locBoards.length > 0) {
            return locBoards.map((/** @type {any} */ b) => new SlashCommandEnumValue(b.name));
        }
        if (globalBoards.length > 0) {
            console.log('[party] boardEnumProvider fallback to global boards', { globalBoards });
            return globalBoards.map((/** @type {any} */ b) => new SlashCommandEnumValue(b.name));
        }
        return [];
    }

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'go',
        helpString: '<div>Navigate to a location. Usage: <code>/go Oakhaven</code></div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Location name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: locationEnumProvider,
            }),
        ],
        // Sin confirmacion: escribir el comando ya es la decision. El clic del mapa si
        // pregunta, porque un clic no puede gastar dias sin avisar. Lo que no cambia es el
        // coste: dos formas de viajar y una gratis seria una forma de saltarse el hambre.
        callback: async (_args, value) => {
            // Escribirlo es decidir el viaje entero; pero se hace de vecino en vecino, llegando
            // de verdad a cada sitio de en medio, no de un salto.
            let { to, reason, via } = await travelWithTime(String(value));
            for (let hop = 0; !to && via && hop < 8; hop++) {
                const step = await travelWithTime(via);
                if (!step.to) {
                    reason = step.reason;
                    break;
                }
                ({ to, reason, via } = await travelWithTime(String(value)));
            }
            if (!to) {
                // El motivo que venga, una sola vez: antes esto decia «not found» aunque
                // el sitio existiera y lo que fallara fuese el camino.
                if (reason) toastr.warning(reason, 'No se puede viajar');
                return '';
            }
            setPartyTab('location');
            toastr.info(`📍 Llegáis a ${to}`);
            return to;
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'enter',
        helpString: '<div>Enter a board at your current location. Usage: <code>/enter Tavern</code></div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Board name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: boardEnumProvider,
            }),
        ],
        callback: (_args, value) => {
            const name = String(value).trim();
            console.log('[party] /enter called', { currentLocationName, name });
            if (!currentLocationName) {
                toastr.warning('Primero id a una localización (/go).');
                return '';
            }

            const entered = enterBoard(name);
            if (!entered) {
                if (!holdDuringCombat(combatEncounter, 'board')) {
                    toastr.warning(`En ${currentLocationName} no hay ningún tablero «${name}».`);
                }
                return '';
            }

            setPartyTab('location');
            toastr.info(`🎲 Entras en ${entered}`);
            tellBoard(String(entered));
            return entered;
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'narrador',
        helpString: '<div>Cambia <b>cuánto se extiende</b> quien narra esta campaña: de una o dos '
            + 'frases a sin freno. Se escribe en su ficha, que es lo que llega al modelo cada turno.</div>',
        callback: async () => {
            const { changeNarratorPace } = await import('../campaigns.js');
            return await changeNarratorPace();
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'gremio',
        helpString: '<div>El tablon de encargos, la casa y quien esta contratado. '
            + 'Aceptar un encargo <b>construye el sitio</b> donde se juega.</div>',
        callback: async () => await openGuild(),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'cuenta',
        helpString: '<div>Lo que debes esta semana y cuanto tienes: comida, posada, tasas, '
            + 'sueldos y lo que costaria curar a los heridos. Se pregunta cuando quieras, '
            + 'porque una factura que ves venir es una decision y una que te sorprende es un impuesto.</div>',
        callback: () => showWeeklyBill(),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'sandbox',
        helpString: '<div>Abre un tablero de pruebas con terreno, niebla, tokens y registro de combate. No guarda nada.</div>',
        callback: async () => {
            const { openSandbox } = await import('../game-engine/ui/sandbox.js');
            await openSandbox({ Popup, POPUP_TYPE });
            return '';
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'leave',
        helpString: '<div>Leave the current board or location. Cascading: board first, then location.</div>',
        callback: () => {
            const held = holdDuringCombat(combatEncounter, 'board');
            if (held) {
                toastr.warning(held, 'Combate en marcha');
                return '';
            }

            if (currentBoardName) {
                const leftBoard = currentBoardName;
                setCurrentBoardName('');
                saveCurrentBoard();
                setPartyTab('location');
                toastr.info(`← Sales de ${leftBoard}`);
                return leftBoard;
            }
            if (currentLocationName) {
                const leftLoc = currentLocationName;
                setCurrentLocationName('');
                setCurrentBoardName('');
                saveCurrentLocation();
                saveCurrentBoard();
                setPartyTab('location');
                toastr.info(`← Sales de ${leftLoc}`);
                return leftLoc;
            }
            toastr.info('No estáis dentro de nada de lo que salir.');
            return '';
        },
    }));

    // ================================================================
    //  Slash command: /fight
    // ================================================================

    /** Helper: enum provider listing enemies at the current board */
    function enemyEnumProvider() {
        const loc = getCurrentWorldLocationMaps().find(l => l.name === currentLocationName);
        const boards = getLocationBoards(loc);
        const board = boards.find((/** @type {any} */ b) => b.name === currentBoardName);
        if (!board || !board.isCombat || !Array.isArray(board.encounterRules) || !board.encounterRules.length) return [];
        const globalEnemies = getCurrentWorldEnemies();
        return board.encounterRules.map((/** @type {any} */ r) => {
            const template = globalEnemies.find(e => e.id === r.enemyId);
            if (!template) return null;
            return new SlashCommandEnumValue(template.name, `${r.minCount}-${r.maxCount} | HP:${template.hp} AC:${template.armorClass} CR:${template.cr}`);
        }).filter(Boolean);
    }

    function currentTurnTargetEnumProvider() {
        const member = getCurrentActingMember();
        if (!member) return [];
        return getAttackableEnemiesForMember(member).map(enemy => new SlashCommandEnumValue(
            enemy.name,
            `${getDistanceInFeet(member.mapPosition?.gridX || 0, member.mapPosition?.gridY || 0, enemy.gridX || 0, enemy.gridY || 0)} ft | HP:${enemy.currentHp}/${enemy.maxHp} AC:${enemy.armorClass}`,
        ));
    }

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'fight',
        helpString: '<div>Start a combat encounter. Usage: <code>/fight Goblin 3</code></div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Enemy name and optional count (e.g. "Goblin 3")',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: enemyEnumProvider,
            }),
        ],
        callback: (_args, value) => {
            const raw = String(value).trim();
            // Parse "EnemyName N" or just "EnemyName"
            const countMatch = raw.match(/^(.+?)\s+(\d+)$/);
            const enemyName = countMatch ? countMatch[1].trim() : raw;
            const countOverride = countMatch ? parseInt(countMatch[2], 10) : 0;

            if (!currentLocationName) {
                toastr.warning('Primero id a una localización (/go).');
                return '';
            }
            if (!currentBoardName) {
                toastr.warning('Primero entrad en un tablero (/enter).');
                return '';
            }

            const loc = getCurrentWorldLocationMaps().find(l => l.name === currentLocationName);
            const boards = getLocationBoards(loc);
            const board = boards.find((/** @type {any} */ b) => b.name === currentBoardName);

            if (!board || !board.isCombat) {
                toastr.warning('En este tablero no se pelea.');
                return '';
            }

            const globalEnemies = getCurrentWorldEnemies();
            const rule = (board.encounterRules || []).find((/** @type {any} */ r) => {
                const tmpl = globalEnemies.find(e => e.id === r.enemyId);
                return tmpl && tmpl.name.toLowerCase() === enemyName.toLowerCase();
            });
            if (!rule) {
                toastr.warning(`«${enemyName}» no es de los enemigos de este tablero.`);
                return '';
            }

            const template = globalEnemies.find(e => e.id === rule.enemyId);
            if (!template) {
                toastr.warning('Ese enemigo no está en el bestiario del mundo.');
                return '';
            }

            const gw = loc?.gridWidth || 50;
            const gh = loc?.gridHeight || 50;
            const count = countOverride > 0
                ? countOverride
                : Math.floor(Math.random() * (rule.maxCount - rule.minCount + 1)) + rule.minCount;
            const summary = startCombat(template, count, gw, gh);

            toastr.success(`⚔️ ¡Empieza el combate!\n${summary}`, '', { timeOut: 8000 });

            // Re-render board to show enemy tokens + combat UI
            setPartyTab('location');
            return summary;
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'combat-attack',
        helpString: '<div>Attack an enemy during your current turn. Usage: <code>/combat-attack Goblin 1</code></div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Enemy name in range',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: currentTurnTargetEnumProvider,
            }),
        ],
        callback: (_args, value) => handlePlayerCombatAttack(String(value || '')),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'combat-move',
        helpString: '<div>Move your current combatant on the board. Usage: <code>/combat-move 12 8</code></div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Target coordinates X Y',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
            }),
        ],
        callback: (_args, value) => handlePlayerCombatMove(String(value || '')),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'combat-end',
        helpString: '<div>End the current player turn and advance combat. '
            + 'To leave the fight entirely, use <code>/combat-stop</code>.</div>',
        callback: () => endPlayerCombatTurn(),
    }));

    // Until this existed, a fight could only be left by winning it or dying: there was no
    // way out of an encounter started by mistake, and no way to reach the epilogue except
    // through a body count.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'combat-stop',
        helpString: '<div>Abandona el combate en curso sin resolverlo. '
            + 'Publica el resumen final igual que una victoria o una derrota.</div>',
        callback: () => {
            if (!combatEncounter.active) {
                toastr.info('No hay ningun combate en curso.');
                return '';
            }
            endCombat('manual');
            renderLocationMapsPreview();
            return 'combate abandonado';
        },
    }));

    // Opens the rules editor for the open campaign and saves what comes back into the
    // world, which is where a campaign's rules belong: exporting the world takes them
    // along, and two campaigns can disagree about what a weapon is.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'rules',
        helpString: '<div>Abre el editor de reglas de la campaña: tipos de daño, propiedades de armas y armaduras, condiciones, rarezas. '
            + 'Lo que guardes se aplica al recargar.</div>',
        callback: () => openRules(),
    }));

    // The prompt preview (wiki/ROADMAP.md, T3). Recording is a listener rather than a
    // rebuild for display: what it shows is the request the app actually sent.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'prompt',
        helpString: '<div>Muestra qué se envía al modelo en cada turno, desglosado por bloque, '
            + 'y lo que lleva gastado la sesión. <code>/prompt reset</code> pone el contador a cero.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'reset para reiniciar el contador de la sesión',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
            }),
        ],
        callback: async (_args, value) => {
            const { openPromptPreview, resetSession, getSession } = await import('../game-engine/ui/prompt-preview.js');

            if (String(value ?? '').trim().toLowerCase() === 'reset') {
                resetSession();
                toastr.success('Contador de la sesión reiniciado.');
                return '0';
            }

            await openPromptPreview({ Popup, POPUP_TYPE });
            return String(getSession().promptTokens);
        },
    }));

    // Conditions could only be set by opening a character sheet, or by the combat putting
    // them there itself. Marking someone poisoned mid-scene is a table gesture, so it
    // belongs in the chat next to /fight.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'time',
        helpString: '<div>Muestra el día y el momento actual. <code>/time next</code> pasa al siguiente bloque '
            + 'y <code>/time sleep</code> al día siguiente.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'next | sleep',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                enumList: [
                    new SlashCommandEnumValue('next', 'Siguiente bloque del día'),
                    new SlashCommandEnumValue('sleep', 'Dormir hasta mañana'),
                ],
            }),
        ],
        callback: (_args, value) => {
            const what = String(value ?? '').trim().toLowerCase();

            if (what === 'next') advanceCampaignSlot();
            else if (what === 'sleep') advanceCampaignDay();
            else toastr.info(formatCalendar(getCampaignCalendar()));

            return formatCalendar(getCampaignCalendar());
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'bond',
        helpString: '<div>Registra algo que ha pasado con un compañero: '
            + '<code>/bond Lyra confidant_scene</code>. Sin evento, muestra el rango actual. '
            + 'Los vínculos suben por hechos registrados, no por lo que diga la narración.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Nombre del compañero, y el evento',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
            }),
        ],
        callback: (_args, value) => {
            const raw = String(value ?? '').trim();
            if (!raw) {
                toastr.warning('Usa: /bond <nombre> <evento>');
                return '';
            }

            const parts = raw.split(/\s+/);
            const known = parts.length > 1 && Object.prototype.hasOwnProperty.call(BOND_EVENTS, parts[parts.length - 1]);
            const targetName = known ? parts.slice(0, -1).join(' ') : raw;
            const eventType = known ? parts[parts.length - 1] : '';

            const member = partyMembers.find(m => m.name.toLowerCase() === targetName.toLowerCase());
            if (!member) {
                toastr.warning(`No encuentro a "${targetName}" en el grupo.`);
                return '';
            }

            if (!eventType) {
                const { rank, points, nextAt } = getBondProgress(getCampaignBonds(), String(member.id));
                const text = nextAt
                    ? `${member.name}: rango ${rank} (${points}/${nextAt}).`
                    : `${member.name}: rango máximo (${points} puntos).`;
                toastr.info(text);
                return String(rank);
            }

            recordCampaignBondEvent(String(member.id), eventType);
            return String(getBondProgress(getCampaignBonds(), String(member.id)).rank);
        },
    }));

    // The rank-5 perk, spent deliberately. Giving away your leftover movement is a
    // decision, so it is a command rather than something the engine does for you.
    // The contract for the Gem that processes a book. The Gem itself lives outside this
    // program — in a Gemini subscription — so the one thing the code owes it is an exact,
    // generated schema: a copy kept by hand goes stale and the failure shows up a whole
    // book later. See wiki/archivo/ROADMAP_INGESTA_CAMPANAS_LIBROS.md.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'esquema-campana',
        helpString: '<div>Entrega el contrato del paquete de campaña para pegarlo en tu Gem: '
            + 'el esquema JSON, las reglas que el esquema no puede comprobar y un ejemplo de salida correcta.</div>',
        callback: async () => {
            const { openCampaignSchema } = await import('../game-engine/ui/campaign-schema-panel.js');
            await openCampaignSchema({ Popup, POPUP_TYPE });
            return 'esquema mostrado';
        },
    }));

    // El camino de vuelta del importador: sin esto se puede meter el libro de otro y no
    // mandar el tuyo, que es media historia de "sin marketplace".
    // U8 del pegamento: el caso.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'caso',
        helpString: '<div>El caso abierto: <code>/caso</code> abre su tablero; <code>/caso preguntar Giles</code> le pregunta; '
            + '<code>/caso buscar</code> busca aquí; <code>/caso nuevo</code> empieza uno si no hay ninguno; '
            + '<code>/caso muerto</code> le pregunta a la víctima, si alguien sabe Hablar con los muertos.</div>',
        unnamedArgumentList: [SlashCommandArgument.fromProps({ description: 'preguntar <nombre> | buscar | nuevo', typeList: [ARGUMENT_TYPE.STRING], isRequired: false })],
        callback: async (_args, value) => {
            const raw = String(value ?? '').trim();
            const [verb, ...rest] = raw.split(/\s+/);
            if (/^preguntar$/i.test(verb)) return askAboutCase(rest.join(' '));
            if (/^buscar$/i.test(verb)) {
                await searchCaseHere();
                return '';
            }
            if (/^nuevo$/i.test(verb)) return (await startCase(true)) ? 'caso abierto' : '';
            // R4: el muerto contesta, si alguien sabe preguntarle.
            if (/^muerto$/i.test(verb)) return askTheDead();
            await openCaseBoard();
            return '';
        },
    }));

    // U6 del pegamento: convencer a alguien, en un duelo de palabras.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'convencer',
        helpString: '<div>Convencer a alguien del mundo en un duelo de palabras: tres rondas, con lo que tengáis. Una vez al día por persona.</div>',
        unnamedArgumentList: [SlashCommandArgument.fromProps({ description: 'a quién', typeList: [ARGUMENT_TYPE.STRING], isRequired: true })],
        callback: async (_args, value) => duelWith(String(value ?? '')),
    }));

    // Ideas 69 y 70: el mapa en texto.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'mapa',
        helpString: '<div>El mapa en texto: los sitios y sus caminos, lo no visitado en gris, y tus notas.</div>',
        callback: async () => {
            await openTextMap();
            return '';
        },
    }));

    // J4 de ROADMAP_SIN_CONEXION: el gremio.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'campanas',
        helpString: '<div>El tablón de campañas del gremio: empezar una o seguir la que dejaste. Tu grupo va entero.</div>',
        callback: async () => await openHubCampaigns(),
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'contratar',
        helpString: '<div>Los mercenarios del gremio: contratar a uno (se paga una vez y va contigo hasta que le despidas) o despedirle.</div>',
        callback: async () => await openHubHire(),
    }));
    // J2.3: saltar la prueba de la bodega, para quien ya sabe jugar.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'saltar-prueba',
        helpString: '<div>Saltar la prueba del gremio: cuenta como ganada, sin pelea y sin botín, y el hilo sigue con el tablón de campañas.</div>',
        callback: async () => await skipHubTrial(),
    }));
    // No `/gremio`: ese nombre es del panel de la compañía (el tablón de encargos y los edificios).
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'volver-gremio',
        helpString: '<div>Volver al gremio desde una campaña, con todo lo ganado. La campaña queda donde la dejas.</div>',
        callback: async () => {
            if (combatEncounter.active) {
                toastr.warning('No mientras peleáis.');
                return '';
            }
            if (!lastHubHome) {
                toastr.info('Esta campaña no sale de ningún gremio.', 'El gremio');
                return '';
            }
            const { returnToHub } = await import('../campaigns.js');
            await returnToHub();
            return '';
        },
    }));
    // J4.5 y J3.9: el final de la campaña, otra vez, y el salón de la fama.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'final',
        helpString: '<div>Volver a ver el final de la campaña: lo que pasó, qué fue de cada uno y lo que se lleva.</div>',
        callback: async () => await openEnding(),
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'salon',
        helpString: '<div>El salón de la fama: las campañas terminadas y los caídos de todas las partidas.</div>',
        callback: () => {
            openHallOfFame();
            return '';
        },
    }));

    // R5 del roadmap de profundidad: la mascota.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'mascota',
        helpString: '<div>La mascota del héroe: tenerla, preguntarle lo que aprieta, acariciarla. No ocupa plaza ni cobra.</div>',
        callback: async () => await openPetPanel(),
    }));

    // R4: aprender de un pergamino.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'pergamino',
        helpString: '<div>Aprender el conjuro de un pergamino, en vez de leerlo: solo quien ha estudiado (el mago o el erudito). El pergamino se gasta.</div>',
        unnamedArgumentList: [SlashCommandArgument.fromProps({ description: 'de qué pergamino (opcional)', typeList: [ARGUMENT_TYPE.STRING], isRequired: false })],
        callback: async (_args, value) => learnFromScroll(String(value ?? '').trim()),
    }));

    // R4 del roadmap de profundidad: el grimorio del grupo.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'grimorio',
        helpString: '<div>Lo que el grupo sabe lanzar: cada conjuro con su escuela y su círculo, las cargas que quedan '
            + 'y lo que se gasta. No existe más magia que la del grimorio.</div>',
        unnamedArgumentList: [SlashCommandArgument.fromProps({ description: '«todo» para ver toda la magia que existe', typeList: [ARGUMENT_TYPE.STRING], isRequired: false })],
        callback: async (_args, value) => {
            await openGrimoire(/^todo$/i.test(String(value ?? '').trim()));
            return '';
        },
    }));

    // R1 del roadmap de profundidad: el modo de juego.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'modo',
        helpString: '<div>El modo de juego: Relajado, Normal, Supervivencia o a tu medida. Dice qué está encendido '
            + 'y deja cambiarlo; el cambio queda en la crónica.</div>',
        callback: async () => await openGameMode(),
    }));

    // U5 del pegamento: la mesa de la semana.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'mesa',
        helpString: '<div>La mesa de la semana: los asuntos que no caben todos, con su plazo y lo que pasa si no se atienden; '
            + 'cómo os ven, y lo que viene.</div>',
        callback: async () => {
            await openWeekTable();
            return '';
        },
    }));

    // U2 del pegamento: lo que el juego da por cierto.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'estado',
        helpString: '<div>Lo que el juego da por cierto: cada cosa que la partida guarda, con cuánto hay, '
            + 'y qué vuelve con un punto de retorno.</div>',
        callback: async () => {
            await openStateView();
            return '';
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'punto',
        helpString: '<div>Puntos de retorno. <code>/punto</code> los lista, '
            + '<code>/punto guardar Antes del jefe</code> guarda uno y '
            + '<code>/punto volver 1</code> devuelve la partida al numero que diga la lista. '
            + 'No toca la conversacion: solo el estado del juego.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'guardar <nombre> | volver <numero>',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
            }),
        ],
        callback: async (_args, value) => {
            const raw = String(value ?? '').trim();
            const list = normalizeCheckpoints(chat_metadata?.[CHECKPOINT_KEY]);

            if (!raw) {
                if (list.length === 0) return 'No hay ningun punto de retorno todavia.';
                const lines = list.map((cp, i) => `${i + 1}. ${describeCheckpoint(cp)}`);
                toastr.info(lines.join('\n'), 'Puntos de retorno', { timeOut: 15000 });
                return lines.join(' | ');
            }

            const [verb, ...rest] = raw.split(/\s+/);
            const argument = rest.join(' ').trim();

            if (/^guardar$/i.test(verb)) {
                saveCheckpoint(argument || 'Guardado a mano');
                return 'punto guardado';
            }

            if (/^volver$/i.test(verb)) {
                const index = parseInt(argument, 10) - 1;
                const target = list[index];
                if (!target) {
                    toastr.warning(`No hay un punto numero ${argument}. Escribe /punto para verlos.`);
                    return '';
                }
                return (await restoreCheckpoint(target.id)) ? `vuelta a ${target.label}` : '';
            }

            toastr.warning('Usa /punto, /punto guardar <nombre> o /punto volver <numero>.');
            return '';
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'campana',
        helpString: '<div>El editor de la campana abierta: el mundo y sus localizaciones, con sus tableros. '
            + 'Escribe donde escribe el importador de libros.</div>',
        callback: async () => await openCampaignBuilder(),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'habilidades',
        helpString: '<div>Escribe conjuros, tecnicas y recursos de clase, y reparte quien se sabe cada uno. '
            + 'Se guardan con las reglas de la campa\u00f1a.</div>',
        callback: async () => await openAbilitiesEditor(),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'sonido',
        helpString: '<div>Ajusta que suena en cada escena del Modo Juego. Las pistas las pones tu: '
            + 'una direccion de tu servidor o una URL.</div>',
        callback: async () => await openAudioSettings(),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'exportar-campana',
        helpString: '<div>Empaqueta la campaña abierta en un archivo que se puede importar '
            + 'en otra instalación: mundo, tableros, bestiario, compañeros y misiones.</div>',
        callback: async () => await exportCampaignPack(),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'semilla',
        helpString: '<div>Fija la semilla de los dados para que una partida se repita igual. '
            + '<code>/semilla molino</code> la fija, <code>/semilla</code> sola vuelve al azar. '
            + 'Sirve para saber si un cambio mejoro algo, en vez de suponerlo.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'La semilla, o nada para volver al azar',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
            }),
        ],
        callback: (_args, value) => {
            const raw = String(value ?? '').trim();

            if (!raw) {
                setRandomSource(null);
                if (chat_metadata) {
                    delete chat_metadata[SEED_KEY];
                    saveMetadata();
                }
                toastr.info('Los dados vuelven a ser aleatorios.', 'Semilla');
                return '';
            }

            setRandomSource(createSeededRandom(raw));
            if (chat_metadata) {
                chat_metadata[SEED_KEY] = raw;
                saveMetadata();
            }
            toastr.success(`Semilla "${raw}" (${seedFrom(raw)}). Las tiradas se repetiran igual.`, 'Semilla');
            return raw;
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'contradicciones',
        helpString: '<div>Lo que la narracion ha dicho y el motor no confirma, agrupado por tipo. '
            + 'No corrige nada: dice donde falla el prompt.</div>',
        callback: () => {
            const summary = summariseContradictions(chat_metadata?.[CONTRADICTIONS_KEY]);
            if (summary.total === 0) {
                toastr.success('La narracion no ha contradicho al motor ni una vez.', 'Contradicciones');
                return '0';
            }

            const lines = summary.byKind
                .map(k => `${k.count} de ${k.kind} — ultima: ${k.last}`)
                .join(String.fromCharCode(10));
            toastr.info(lines, `${summary.total} contradiccion(es)`, { timeOut: 20000 });
            return String(summary.total);
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'enemigos',
        helpString: '<div>Abre los enemigos que este tablero puede sacar, y cuantos. '
            + 'Lo que <code>/fight</code> encuentra sale de aqui.</div>',
        callback: () => editBoardEncounters(),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'definitivo',
        helpString: '<div>El golpe definitivo del vinculo de rango 10: impacta sin tirar y hace el maximo del arma '
            + 'mas el nivel. Una vez al dia. Usage: <code>/definitivo Goblin 1</code></div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Enemigo al alcance',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: currentTurnTargetEnumProvider,
            }),
        ],
        callback: (_args, value) => resolveUltimateStrike(String(value || '')),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'descanso',
        helpString: '<div>Descansa. <code>/descanso corto</code> gasta dados de golpe y un bloque del dia; '
            + '<code>/descanso largo</code> cura del todo, devuelve la mitad de los dados y amanece.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'corto o largo',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                enumProvider: () => [
                    new SlashCommandEnumValue('corto', 'Gasta dados de golpe y un bloque del dia'),
                    new SlashCommandEnumValue('largo', 'Cura del todo, devuelve dados y amanece'),
                ],
            }),
        ],
        callback: (_args, value) => {
            const kind = String(value ?? '').trim().toLowerCase();
            if (kind !== 'corto' && kind !== 'largo') {
                toastr.info('Di que descanso quieres: /descanso corto o /descanso largo.');
                return '';
            }
            return takeRest(kind);
        },
    }));

    // El Modo Juego se enciende y se apaga con el mismo comando, a proposito: es una capa
    // de presentacion, y la garantia de que se pueda quitar vale tanto como la capa.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'modojuego',
        helpString: '<div>Enciende o apaga el Modo Juego: el tablero a pantalla completa, '
            + 'con el rastreador, el registro y la barra de acciones. Se sale con <code>Esc</code>.</div>',
        callback: () => toggleGameMode(),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'objetivos',
        helpString: '<div>Muestra los objetivos del escenario en curso. '
            + '<code>/objetivos editar</code> los abre para cambiarlos, o para que la IA los proponga.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'editar para abrirlos',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
            }),
        ],
        callback: (_args, value) => {
            if (String(value ?? '').trim().toLowerCase() === 'editar') {
                return editBoardObjectives();
            }
            const verdict = judgeCurrentScenario();
            if (!verdict) {
                toastr.info('Este tablero no tiene objetivos: gana quien limpie el tablero. Pruebalo con /objetivos editar.');
                return '';
            }
            toastr.info(verdict.summary, 'Objetivos', { timeOut: 10000 });
            return verdict.summary;
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'relevo',
        helpString: '<div>Cede el movimiento que te queda a un compañero, si tienes el vínculo de rango 5. '
            + '<code>/relevo Brand</code></div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Nombre del compañero',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
            }),
        ],
        callback: (_args, value) => handleBatonPass(String(value ?? '')),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'condition',
        helpString: '<div>Pone o quita una condición. <code>/condition Lyra Poisoned</code> la alterna, '
            + '<code>/condition Lyra</code> muestra las que tiene, y <code>/condition Lyra clear</code> las quita todas.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Nombre del personaje o enemigo, y la condición',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
            }),
        ],
        callback: (_args, value) => {
            const raw = String(value ?? '').trim();
            if (!raw) {
                toastr.warning('Usa: /condition <nombre> <condición>');
                return '';
            }

            // The name can hold spaces, so the condition is taken as the last word and
            // the rest is the name — the same shape /fight already uses for its count.
            const parts = raw.split(/\s+/);
            const targetName = parts.length > 1 ? parts.slice(0, -1).join(' ') : raw;
            const conditionName = parts.length > 1 ? parts[parts.length - 1] : '';

            const member = partyMembers.find(m => m.name.toLowerCase() === targetName.toLowerCase());
            const enemy = combatEncounter.enemies.find(e => e.name.toLowerCase() === targetName.toLowerCase());
            const target = member || enemy;

            if (!target) {
                toastr.warning(`No encuentro a "${targetName}".`);
                return '';
            }

            const current = Array.isArray(target.activeConditions) ? target.activeConditions : [];

            if (!conditionName) {
                const list = current.length ? current.join(', ') : 'ninguna';
                toastr.info(`${target.name}: ${list}.`);
                return list;
            }

            if (conditionName.toLowerCase() === 'clear') {
                target.activeConditions = [];
                postCombatNarration(`🧪 [BOARD] ${target.name} se libra de todas sus condiciones.`);
            } else {
                const { conditions, added } = toggleCondition(current, conditionName);
                target.activeConditions = conditions;
                postCombatNarration(added
                    ? `🧪 [BOARD] ${target.name} queda ${conditionName}.`
                    : `🧪 [BOARD] ${target.name} se libra de ${conditionName}.`);
            }

            if (member) savePartyState();
            if (enemy) saveCombatState();
            renderLocationMapsPreview();
            return (target.activeConditions || []).join(', ');
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'prisionero',
        helpString: '<div>Qué hacer con un prisionero: <code>/prisionero interrogar p1</code>, '
            + '<code>/prisionero entregar p1</code> o <code>/prisionero soltar p1</code>.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({ description: 'acción e id', typeList: [ARGUMENT_TYPE.STRING], isRequired: true }),
        ],
        callback: async (_args, value) => {
            const [what, id] = String(value ?? '').trim().split(/\s+/);
            const said = await handlePrisoner(String(what ?? ''), String(id ?? ''));
            if (isShellOpen()) refreshGameShell();
            return said;
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'forrajear',
        helpString: '<div>Cazar y forrajear: gasta un rato del día. Si sale, todos comen y beben; si no, al menos agua.</div>',
        callback: () => runForage(),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'explorar',
        helpString: '<div>Explorar los alrededores: gasta un rato del día y descubre un sitio nuevo junto a donde '
            + 'estás. Con un nombre, va a buscar lo que el narrador mencionó: <code>/explorar La cueva del norte</code>.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({ description: 'lo que se va a buscar', typeList: [ARGUMENT_TYPE.STRING], isRequired: false }),
        ],
        callback: (_args, value) => exploreHere(String(value ?? '').trim()),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'rumor',
        helpString: '<div>Escuchar lo que se cuenta donde estás. Uno cada vez, sin repetir; '
            + 'alguno lleva a sitios que no están en el mapa.</div>',
        callback: () => hearRumor(),
    }));

    // Z2 de ROADMAP_SIN_TOKENS: hablar con alguien escribiéndolo, igual que pulsando su ficha.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'hablar',
        helpString: '<div>Hablar con alguien de aquí: <code>/hablar Giles</code>. Abre la charla: qué sabe, qué busca, '
            + 'qué se cuenta, y convencer, sonsacar, amenazar o invitar a una ronda. Sin gastar tokens.</div>',
        unnamedArgumentList: [SlashCommandArgument.fromProps({ description: 'Con quién', typeList: [ARGUMENT_TYPE.STRING], isRequired: true })],
        callback: (_args, value) => {
            const who = String(value ?? '').trim();
            if (!who) return '';
            startTalk(worldNpc(who)?.name ?? who);
            return '';
        },
    }));

    // Z3: examinar algo de aquí, con su tirada y su consecuencia.
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'examinar',
        helpString: '<div>Examinar algo de aquí: <code>/examinar la cerradura del baúl</code>. Tira lo que toque '
            + '(Investigación, Percepción, Supervivencia…) y sale bien, a medias o mal, con su efecto.</div>',
        unnamedArgumentList: [SlashCommandArgument.fromProps({ description: 'Qué', typeList: [ARGUMENT_TYPE.STRING], isRequired: true })],
        callback: async (_args, value) => {
            await lookAt(String(value ?? ''));
            return '';
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'tirada',
        helpString: '<div>Intentar algo fuera de combate. El motor tira el dado con la ficha del tuyo y deja '
            + 'el resultado escrito en el chat, para que el narrador lo lea: <code>/tirada persuasion</code>. '
            + 'Una por mensaje.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'la habilidad',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumList: Object.entries(SKILLS).map(([id, def]) => new SlashCommandEnumValue(id, def.label)),
            }),
        ],
        callback: (_args, value) => runSkillCheck(String(value ?? '').trim().toLowerCase()),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'maniobra',
        helpString: '<div>En vez de atacar: <code>/maniobra esquivar</code>, <code>/maniobra destrabarse</code>, '
            + '<code>/maniobra empujar Goblin</code>, <code>/maniobra ayudar Goblin</code>, <code>/maniobra esconderse</code> '
            + 'o <code>/maniobra lanzar red Goblin</code> (y <code>aceite</code>, u <code>objeto</code> para lo que haya a mano en el tablero). Gasta la accion.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'la maniobra y, si hace falta, a quien',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
            }),
        ],
        callback: (_args, value) => {
            const [kind, ...rest] = String(value ?? '').trim().split(/\s+/);
            // Idea 122: «lanzar red Goblin» o «lanzar:red Goblin».
            if (/^lanzar/i.test(String(kind))) {
                const what = String(kind).includes(':') ? String(kind).split(':')[1] : String(rest.shift() ?? '');
                // Idea 8: «lanzar objeto Goblin» coge lo que haya a mano en el tablero.
                if (what.toLowerCase() === 'objeto') return throwScenery(rest.join(' '));
                return throwItem(what.toLowerCase(), rest.join(' '));
            }
            return performManeuver(String(kind || '').toLowerCase(), rest.join(' '));
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'tregua',
        helpString: '<div>T2: contestar a quien pide tregua. <code>/tregua sí</code> les deja ir (ganáis el tablero, sin su botín); <code>/tregua no</code>, sin cuartel.</div>',
        unnamedArgumentList: [SlashCommandArgument.fromProps({ description: 'sí o no', typeList: [ARGUMENT_TYPE.STRING], isRequired: true })],
        callback: (_args, value) => answerTruce(/^(s[ií]|si|yes|vale|dejar)/i.test(String(value ?? '').trim())),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'ayuda',
        helpString: '<div>H2: cómo se juega: tu modo, el tablero, la semana, la crónica y qué hacer si te pierdes.</div>',
        callback: async () => await openHowToPlay(),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'salir',
        helpString: '<div>B2: salir de la pelea por una salida del tablero (la casilla «x»). Sin nombre, quien tiene el turno.</div>',
        unnamedArgumentList: [SlashCommandArgument.fromProps({ description: 'quién sale', typeList: [ARGUMENT_TYPE.STRING], isRequired: false })],
        callback: (_args, value) => {
            const name = String(value ?? '').trim().toLowerCase();
            const current = getCurrentTurnEntry();
            const member = name
                ? partyMembers.find(m => String(m.name).toLowerCase() === name)
                : (current && !current.isEnemy ? getPartyMemberByTurnEntry(current) : partyMembers[0]);
            return leaveThroughExit(member);
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'bajar',
        helpString: '<div>Idea 75: bajar por la escalera al nivel siguiente, si alguien está en ella.</div>',
        callback: () => {
            const below = stairsHere();
            if (!below) {
                toastr.info('Aquí no hay escalera a mano: acercaos a ella.', 'Bajar');
                return '';
            }
            postCombatNarration(`🪜 [BOARD] Bajáis por la escalera: ${below.name}.`);
            return enterBoard(String(below.name));
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'actitud',
        helpString: '<div>Idea 140: lo mismo que el narrador con <code>cambiar_actitud</code>: <code>/actitud Giles +1</code>.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({ description: 'quién y +1 o -1', typeList: [ARGUMENT_TYPE.STRING], isRequired: true }),
        ],
        callback: (_args, value) => {
            const match = /^(.+?)\s+([+-]?1)$/.exec(String(value ?? '').trim());
            return match ? changeAttitude(match[1], Number(match[2]), '') : 'Usa: /actitud Nombre +1';
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'ofrecer-objeto',
        helpString: '<div>Idea 139: lo mismo que hace el narrador con <code>dar_objeto</code>: <code>/ofrecer-objeto Manta de lana</code> '
            + 'deja el objeto para cogerlo desde la fila de fichas.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({ description: 'qué es', typeList: [ARGUMENT_TYPE.STRING], isRequired: true }),
        ],
        callback: (_args, value) => offerItem(String(value ?? ''), '', ''),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'aceptar-objeto',
        helpString: '<div>Idea 139: coger lo que ofreció el narrador. <code>/aceptar-objeto Manta de lana</code>.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({ description: 'cuál', typeList: [ARGUMENT_TYPE.STRING], isRequired: true }),
        ],
        callback: (_args, value) => acceptOffer(String(value ?? '')),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'acampar',
        helpString: '<div>Idea 67: acampar aquí, donde no hay posada: el fuego, las guardias, la charla y la cena. '
            + 'Luego se duerme como un descanso largo.</div>',
        callback: async () => campNight(),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'sonsacar',
        helpString: '<div>Idea 110: sonsacarle a alguien de aquí lo que esconde (Perspicacia, una vez al día). '
            + '<code>/sonsacar Giles</code>.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({ description: 'a quién', typeList: [ARGUMENT_TYPE.STRING], isRequired: true }),
        ],
        callback: async (_args, value) => pryNpc(String(value ?? '')),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'comprobar-mundo',
        helpString: '<div>Idea 181: si el mundo abierto llega al listón, y el encargo para el Gem con lo que falta.</div>',
        callback: async () => checkCurrentWorld(),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'postura',
        helpString: '<div>Como pelea un companero cuando se lleva solo: '
            + '<code>/postura Bruna cerca</code> (a tu lado), <code>carga</code> o <code>atras</code>. '
            + 'Sin postura, dice la que tiene.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'nombre y postura',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
            }),
        ],
        callback: (_args, value) => {
            const parts = String(value ?? '').trim().split(/\s+/);
            const last = String(parts[parts.length - 1] || '').toLowerCase();
            const hasStance = parts.length > 1 && last in STANCES;
            const name = (hasStance ? parts.slice(0, -1) : parts).join(' ').toLowerCase();
            const member = partyMembers.find(m => String(m.name).toLowerCase() === name);
            if (!member) {
                toastr.warning(`No encuentro a "${name}" en el grupo.`);
                return '';
            }
            if (!hasStance) {
                const label = STANCES[/** @type {keyof typeof STANCES} */ (stanceOf(member))].label;
                toastr.info(`${member.name}: ${label.toLowerCase()}.`);
                return label;
            }
            return setMemberStance(member, last);
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'rollguard',
        helpString: '<div>Controla la correccion de tiradas inventadas por el modelo. '
            + '<code>/rollguard</code> muestra el modo actual. '
            + '<code>/rollguard imposibles</code> corrige solo totales que los dados no pueden dar (por defecto). '
            + '<code>/rollguard estricto</code> hace que el motor tire por todas. '
            + '<code>/rollguard off</code> lo desactiva.</div>',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'off | imposibles | estricto',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                enumList: [
                    new SlashCommandEnumValue('off', 'No tocar nada'),
                    new SlashCommandEnumValue('imposibles', 'Corregir solo lo imposible'),
                    new SlashCommandEnumValue('estricto', 'El motor tira por todas'),
                ],
            }),
        ],
        callback: (_args, value) => {
            const labels = {
                off: 'desactivado',
                impossible: 'solo corrige totales imposibles',
                strict: 'el motor tira por todas las tiradas',
            };
            const raw = String(value ?? '').trim().toLowerCase();

            if (!raw) {
                const mode = getRollGuardMode();
                toastr.info(`Guardian de tiradas: ${labels[mode]}.`);
                return mode;
            }

            /** @type {Record<string, 'off'|'impossible'|'strict'>} */
            const aliases = {
                off: 'off', no: 'off', desactivado: 'off',
                imposibles: 'impossible', impossible: 'impossible', posibles: 'impossible',
                estricto: 'strict', strict: 'strict',
            };
            const mode = aliases[raw];
            if (!mode) {
                toastr.warning('Usa: off, imposibles o estricto.');
                return getRollGuardMode();
            }

            chat_metadata[ROLL_GUARD_KEY] = mode;
            saveMetadata();
            toastr.success(`Guardian de tiradas: ${labels[mode]}.`);
            return mode;
        },
    }));

    // J14: `/quedar` y `/charlar`, con tu gente.
    registerSocialCommands();
}
