/**
 * Lo que el panel registra en SillyTavern además de los comandos: las herramientas del modelo
 * y lo que escucha del chat. `initPartyPanel` llama a `registerModelTools` y luego a
 * `registerChatEvents`, en el mismo punto donde estaba su código.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { Popup } from '../popup.js';
import { chat, chat_metadata, saveMetadata, eventSource, event_types, updateMessageBlock } from '../../script.js';
import { shouldSendOnEnter } from '../RossAscends-mods.js';
import { getCurrentWorldLocationMaps, METADATA_KEY } from '../world-info.js';
import { SKILLS } from '../game-engine/rules/checks.js';
import { keepSpeech } from '../game-engine/campaign/talk.js';
import { addRequest } from '../game-engine/campaign/check-requests.js';
import { noteSent, noteClick } from '../game-engine/campaign/session-log.js';
import { addProposal } from '../game-engine/world/growth.js';
import { ToolManager } from '../tool-calling.js';
import { intentSkills } from '../game-engine/campaign/intents.js';
import { readBox } from '../game-engine/campaign/read-box.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import { CHECK_REQUESTS_KEY, PENDING_CHECK_KEY, PROPOSALS_KEY } from './keys.js';
import {
    combatEncounter, currentBoardName, currentLocationName, narratorTurn, setCurrentBoardName, setNarratorTurn,
    setTalkingTo, setTypedIntents, talkingTo, typedIntents,
} from './state.js';
import { getCurrentTurnEntry } from './combat-state.js';
import { endPlayerCombatTurn, handlePlayerCombatAttack, handlePlayerCombatMove } from './player-actions.js';
import { placePartyAtStart } from './board.js';
import { getLocationBoards, hereLocation, saveCurrentBoard, worldNpc } from './world.js';
import { ensurePlot, notePlot } from './plot.js';
import { proposeFact, refreshWorldMemoryPrompt } from './world-growth.js';
import {
    applyRollGuard, decorateSpeakers, recordContradictions, scheduleFoldChat, showRecap, tellBoard,
    unfoldedMessages,
} from './narration.js';
import { changeAttitude } from './companions.js';
import { boxContext, offerItem, readTheBox, readingBox, routeTyped, speakingWith } from './talk.js';
import { travelWithTime } from './travel.js';
import { currentSessionLog, keepSessionLog } from './menus.js';
import { setPartyTab } from './main.js';

/** El contador de tokens del ultimo turno, ya escrito (idea 147). */
/** @type {{text: string, title: string, high: boolean}|null} */
export let lastMeter = null;

/**
 * Lo que tiene que ver con el modelo: lo que cuesta cada turno, lo que el mundo sabe del grupo
 * justo antes de montar el prompt, y las cinco herramientas que puede llamar. El orden de las
 * herramientas es el del prompt.
 */
export function registerModelTools() {
    // ================================================================
    //  What every turn costs
    // ================================================================

    // Loaded lazily so the meter never delays startup for a panel most turns never open.
    eventSource.on(event_types.GENERATE_AFTER_DATA, (/** @type {any} */ data, /** @type {boolean} */ dryRun) => {
        import('../game-engine/ui/prompt-preview.js')
            .then(({ recordPrompt, meterView }) => {
                recordPrompt(data, dryRun);
                // Idea 147: lo que cuesta cada turno, a la vista mientras se juega.
                if (!dryRun) {
                    lastMeter = meterView();
                    if (isShellOpen()) refreshGameShell();
                }
            })
            .catch(error => console.error('[party] prompt meter failed', error));
    });

    // ================================================================
    //  Dice claims the model made up
    // ================================================================

    // Runs before the message is rendered, so the player only ever sees the corrected
    // text. Corrections are announced rather than applied quietly: a number that changes
    // with no explanation is indistinguishable from a bug.
    // Lo que el mundo sabe del grupo, al dia justo antes de montar el prompt.
    eventSource.on(event_types.GENERATION_STARTED, () => {
        try {
            refreshWorldMemoryPrompt();
        } catch (error) {
            console.error('[party] world memory prompt failed', error);
        }
    });

    // G6: el narrador puede proponer un sitio. No lo crea: queda como opcion para quien juega.
    ToolManager.registerFunctionTool({
        name: 'proponer_sitio',
        displayName: 'Proponer un sitio',
        description: 'Úsala cuando la narración mencione un sitio concreto al que el grupo podría ir y que no está en el mapa '
            + '(una cueva, una granja, un paso). No lo crea: lo propone, y el jugador decide si va a buscarlo.',
        parameters: {
            type: 'object',
            properties: {
                nombre: { type: 'string', description: 'Nombre corto del sitio, como lo diría la gente.' },
                descripcion: { type: 'string', description: 'Una frase: lo que se sabe de él.' },
            },
            required: ['nombre'],
        },
        action: async (/** @type {{nombre: string, descripcion?: string}} */ params) => {
            const known = getCurrentWorldLocationMaps().map((/** @type {any} */ l) => String(l?.name || ''));
            const result = addProposal(chat_metadata?.[PROPOSALS_KEY], {
                name: params?.nombre, note: params?.descripcion, near: currentLocationName,
            }, known);
            if (!result.added) return `No se apunta: ${result.reason}`;
            chat_metadata[PROPOSALS_KEY] = result.proposals;
            saveMetadata();
            if (isShellOpen()) refreshGameShell();
            return 'Propuesto. El jugador lo verá como opción; no lo narres como un sitio ya visitado.';
        },
        shouldRegister: () => Boolean(chat_metadata?.[METADATA_KEY]),
        stealth: true,
    });

    // Idea 139: el narrador ofrece un objeto; quien juega decide si lo coge, y lo que entra lo
    // decide el motor.
    ToolManager.registerFunctionTool({
        name: 'dar_objeto',
        displayName: 'Ofrecer un objeto',
        description: 'Úsala cuando la narración ponga un objeto concreto al alcance del grupo (lo que deja un caído, un regalo, algo sobre una mesa). '
            + 'No lo da: lo ofrece, y el jugador decide si lo coge. Lo que es de verdad lo decide el juego.',
        parameters: {
            type: 'object',
            properties: {
                nombre: { type: 'string', description: 'Qué es, en pocas palabras: «Manta de lana», «Daga oxidada».' },
                descripcion: { type: 'string', description: 'Una frase: de dónde sale o cómo es.' },
                para: { type: 'string', description: 'Quién del grupo lo recibe, si es para alguien concreto.' },
            },
            required: ['nombre'],
        },
        action: async (/** @type {{nombre: string, descripcion?: string, para?: string}} */ params) => offerItem(params?.nombre, params?.descripcion, params?.para),
        shouldRegister: () => Boolean(chat_metadata?.[METADATA_KEY]),
        stealth: true,
    });

    // Idea 140: el narrador propone que alguien mire mejor o peor al grupo; el motor limita.
    ToolManager.registerFunctionTool({
        name: 'cambiar_actitud',
        displayName: 'Cambiar la actitud de alguien',
        description: 'Úsala cuando en la conversación alguien del mundo cambie de verdad cómo ve al grupo (se gana su confianza, se le ofende). '
            + 'Un paso cada vez (+1 o −1), una vez al día por persona. Pesa en las tiradas de trato con esa persona.',
        parameters: {
            type: 'object',
            properties: {
                persona: { type: 'string', description: 'Su nombre, como en el mundo.' },
                cambio: { type: 'number', description: '+1 si mejora, −1 si empeora.' },
                motivo: { type: 'string', description: 'Por qué, en pocas palabras.' },
            },
            required: ['persona', 'cambio'],
        },
        action: async (/** @type {{persona: string, cambio: number, motivo?: string}} */ params) => changeAttitude(String(params?.persona ?? ''), Number(params?.cambio) || 0, String(params?.motivo ?? '')),
        shouldRegister: () => Boolean(chat_metadata?.[METADATA_KEY]),
        stealth: true,
    });

    // Idea 138: el narrador pide una tirada; la tira quien juega, con el dado del motor.
    ToolManager.registerFunctionTool({
        name: 'pedir_tirada',
        displayName: 'Pedir una tirada',
        description: 'Úsala cuando la escena pida una prueba del jugador (convencer, escalar, mentir, fijarse) y el resultado no sea obvio. '
            + 'No tires tú ni narres el resultado: aparece un botón para que el jugador tire, y el resultado te llega en su mensaje.',
        parameters: {
            type: 'object',
            properties: {
                habilidad: { type: 'string', description: `Una de: ${Object.values(SKILLS).map(s => s.label).join(', ')}.` },
                motivo: { type: 'string', description: 'Qué se intenta, en pocas palabras. Ejemplo: convencer al guardia.' },
                dificultad: { type: 'number', description: 'CD de 5 (fácil) a 25 (casi imposible). Normal: 12.' },
            },
            required: ['habilidad'],
        },
        action: async (/** @type {{habilidad: string, motivo?: string, dificultad?: number}} */ params) => {
            if (combatEncounter.active) return 'En combate no: las tiradas las lleva la barra de combate.';
            const result = addRequest(chat_metadata?.[CHECK_REQUESTS_KEY], {
                skill: params?.habilidad, reason: params?.motivo, dc: params?.dificultad,
            }, SKILLS);
            if (!result.added) return `No se pide: ${result.reason}`;
            chat_metadata[CHECK_REQUESTS_KEY] = result.requests;
            saveMetadata();
            if (isShellOpen()) refreshGameShell();
            return 'Pedida. Termina tu respuesta dejando la situación abierta; no narres si sale o no.';
        },
        shouldRegister: () => Boolean(chat_metadata?.[METADATA_KEY]),
        stealth: true,
    });

    // U1 del pegamento: en vez de poner banderas por su cuenta, el narrador propone un hecho
    // para que el mundo lo recuerde, y el motor decide.
    ToolManager.registerFunctionTool({
        name: 'proponer_hecho',
        displayName: 'Proponer un hecho',
        description: 'Úsala solo cuando pase algo que el mundo debería recordar más adelante y que el juego no ha visto: una promesa, una revelación, una ofensa. '
            + 'Una frase. El juego decide si lo apunta (uno al día como mucho). No sirve para dar objetos, oro ni heridas, ni para cambiar actitudes: para eso hay otras.',
        parameters: {
            type: 'object',
            properties: {
                hecho: { type: 'string', description: 'Lo que pasó, en una frase. Ejemplo: El molinero juró venganza contra Vane.' },
            },
            required: ['hecho'],
        },
        action: async (/** @type {{hecho: string}} */ params) => proposeFact(String(params?.hecho ?? '')),
        shouldRegister: () => Boolean(chat_metadata?.[METADATA_KEY]),
        stealth: true,
    });
}

/**
 * Lo que el panel escucha del chat mientras se juega: plegarlo, el diario de sesión, el hilo,
 * la caja que lee el motor, lo que se escribe, lo que contesta el modelo y cómo se pinta. Va
 * después del primer `CHAT_CHANGED` (el de `loadPartyForChat`), que se registra antes.
 */
export function registerChatEvents() {
    // U4 del pegamento (DU3): el chat se pliega solo, mire quien mire lo que lo cambie.
    const chatRoot = document.getElementById('chat');
    if (chatRoot) {
        new MutationObserver(mutations => {
            // Lo que cambia el propio plegado no vuelve a plegar.
            if (mutations.every(m => [...m.addedNodes, ...m.removedNodes].every(n => n instanceof Element && n.classList.contains('gm-fold')))) return;
            scheduleFoldChat();
        }).observe(chatRoot, { childList: true });
    }
    eventSource.on(event_types.CHAT_CHANGED, () => {
        unfoldedMessages.clear();
        scheduleFoldChat();
    });

    // U0 del pegamento: lo que se escribe al narrador y lo que se pulsa, mientras se juega.
    eventSource.on(event_types.MESSAGE_SENT, () => {
        if (isShellOpen()) keepSessionLog(noteSent(currentSessionLog()));
    });
    document.addEventListener('click', (event) => {
        if (!isShellOpen() || !(event.target instanceof Element)) return;
        const button = event.target.closest('button, .menu_button');
        // Los botones de la pausa y los de cerrar un cuadro no son jugar.
        if (!button || button.closest('.gs-pause, .popup-controls')) return;
        if (!button.closest('#game-shell, .popup')) return;
        keepSessionLog(noteClick(currentSessionLog()));
    }, true);

    // El hilo: a quien nombras al hablar, estando donde estas.
    eventSource.on(event_types.MESSAGE_SENT, (/** @type {number} */ messageId) => {
        const said = String(chat?.[messageId]?.mes || '');
        if (said) notePlot({ kind: 'say', text: said, place: currentLocationName });
    });

    // Idea 108: al abrir una campana ya jugada, lo que hace falta para retomar.
    eventSource.on(event_types.CHAT_CHANGED, () => {
        setTimeout(() => {
            const played = (chat || []).filter(m => m && !m.is_system).length;
            if (played > 3 && chat_metadata?.[METADATA_KEY]) showRecap();
        }, 2500);
    });

    // Una campana de antes del hilo lo recibe en silencio la primera vez que se juega.
    eventSource.on(event_types.CHAT_CHANGED, () => {
        setTimeout(() => {
            // Una campana sin nada jugado es una que se esta creando: su mecha la cuenta
            // `beginCampaignPlot`. Poner el hilo en silencio aqui se la comeria.
            const played = (chat || []).filter(m => m && !m.is_system).length;
            if (played > 1) void ensurePlot({ announce: false });
        }, 1500);
    });

    // Z3 de ROADMAP_SIN_TOKENS: sin modelo, SillyTavern no envía nada (no hay con quién
    // hablar) y lo escrito se quedaba en la caja. Aquí se lee antes, y se hace lo que dice.
    // Y a quién va lo que no hace el motor: `routeTyped`.
    const takeBox = (/** @type {Event} */ event) => {
        const input = /** @type {HTMLTextAreaElement|null} */ (document.querySelector('#send_textarea'));
        const said = String(input?.value ?? '').trim();
        if (!said || said.startsWith('/') || routeTyped(said) !== 'engine') return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (input) {
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        void readTheBox(said);
    };
    document.addEventListener('keydown', (event) => {
        if (!(event.target instanceof HTMLElement) || event.target.id !== 'send_textarea') return;
        if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.altKey || event.isComposing || !shouldSendOnEnter()) return;
        if (Popup.util.isPopupOpen()) return;
        takeBox(event);
    }, true);
    document.addEventListener('click', (event) => {
        if (event.target instanceof Element && event.target.closest('#send_but')) takeBox(event);
    }, true);

    // Idea 137: mientras se escribe, si lo escrito pide una tirada, se ofrece.
    /** @type {ReturnType<typeof setTimeout>|null} */
    let typingTimer = null;
    $(document).on('input', '#send_textarea', () => {
        if (typingTimer) clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
            const said = String(/** @type {HTMLTextAreaElement|null} */ (document.querySelector('#send_textarea'))?.value ?? '');
            const next = /^\[TIRADA/.test(said.trim()) ? [] : intentSkills(said);
            if (next.join() === typedIntents.join()) return;
            setTypedIntents(next);
            if (isShellOpen()) refreshGameShell();
        }, 400);
    });
    eventSource.on(event_types.MESSAGE_SENT, () => {
        if (typedIntents.length === 0) return;
        setTypedIntents([]);
        if (isShellOpen()) refreshGameShell();
    });

    // Enviado el mensaje con la tirada, se puede volver a intentar algo.
    eventSource.on(event_types.MESSAGE_SENT, () => {
        if (chat_metadata?.[PENDING_CHECK_KEY]) {
            delete chat_metadata[PENDING_CHECK_KEY];
            saveMetadata();
            if (isShellOpen()) refreshGameShell();
        }
    });

    // Con modelo, a quien se le habla contesta él: la respuesta sale a su nombre, no al del
    // narrador. Y así también la lee el modelo en lo que viene después.
    eventSource.on(event_types.MESSAGE_RECEIVED, (/** @type {number} */ messageId) => {
        const message = chat?.[messageId];
        // Lo que se le preguntó al narrador lo contesta él, con su nombre.
        if (narratorTurn && message && !message.is_user && !message.is_system) {
            setNarratorTurn(false);
            return;
        }
        const with_ = speakingWith();
        if (!with_ || !message || message.is_user || message.is_system || message.extra?.model === 'game-engine') return;
        message.name = with_.name;
        // Habla una persona: sin el párrafo de narración que el modelo pone delante a veces.
        const spoken = keepSpeech(String(message.mes ?? ''));
        if (spoken !== message.mes) {
            message.mes = spoken;
            try {
                updateMessageBlock(Number(messageId), message);
            } catch (error) {
                console.error('[party] no se pudo recortar la respuesta', error);
            }
        }
        const shown = document.querySelector(`#chat .mes[mesid="${messageId}"] .name_text`);
        if (shown) shown.textContent = with_.name;
    });

    eventSource.on(event_types.MESSAGE_RECEIVED, (/** @type {number} */ messageId) => {
        try {
            applyRollGuard(messageId);
        } catch (error) {
            // A guard that breaks the chat is worse than a wrong die.
            console.error('[party] roll guard failed', error);
        }

        try {
            recordContradictions(messageId);
        } catch (error) {
            console.error('[party] contradiction log failed', error);
        }
    });

    // El retrato de la escena de dialogo es quien acaba de hablar, asi que tiene que
    // enterarse de que alguien ha hablado. El tablero se redibuja por su cuenta; un
    // mensaje nuevo no lo redibuja, y sin esto el epilogo de un combate dejaria en
    // pantalla la cara del turno anterior.
    for (const rendered of [event_types.CHARACTER_MESSAGE_RENDERED, event_types.USER_MESSAGE_RENDERED]) {
        eventSource.on(rendered, () => {
            if (isShellOpen()) refreshGameShell();
        });
    }

    // Idea 145: la cara de quien habla, en cada mensaje del narrador que se pinta.
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (/** @type {number} */ messageId) => decorateSpeakers(Number(messageId)));
    for (const redrawn of [event_types.MESSAGE_SWIPED, event_types.MESSAGE_UPDATED, event_types.MESSAGE_EDITED]) {
        eventSource.on(redrawn, (/** @type {number} */ messageId) => setTimeout(() => decorateSpeakers(Number(messageId)), 50));
    }
    eventSource.on(event_types.CHAT_CHANGED, () => {
        setTimeout(() => {
            for (const node of document.querySelectorAll('#chat .mes')) decorateSpeakers(Number(node.getAttribute('mesid')));
        }, 1200);
    });

    // ================================================================
    //  Auto-detect location / board names in user messages
    // ================================================================

    eventSource.on(event_types.USER_MESSAGE_RENDERED, async (/** @type {number} */ messageId) => {
        const message = chat[messageId];
        if (!message || !message.mes || readingBox) return;
        const text = message.mes.toLowerCase();

        // ── Natural-language combat commands (only while combat is active) ──
        if (combatEncounter.active) {
            const currentEntry = getCurrentTurnEntry();
            if (currentEntry && !currentEntry.isEnemy) {
                // Attack: "ataco a X", "ataco al X", "attack X", "i attack X"
                const attackMatch = text.match(/(?:ataco\s+(?:a\s+(?:la?\s+)?)?|attack\s+(?:the\s+)?|i\s+attack\s+(?:the\s+)?)(.+)/i);
                if (attackMatch) {
                    const targetName = attackMatch[1].trim().replace(/[.!?]$/, '');
                    handlePlayerCombatAttack(targetName);
                    return;
                }

                // Move: "me muevo a X Y", "me desplazo a X,Y", "move to X Y", "i move to X,Y"
                const moveMatch = text.match(/(?:me\s+(?:muevo|desplazo)(?:\s+(?:a|hacia))?\s+|(?:i\s+)?move\s+(?:to\s+)?)(\d+)[,\s]+(\d+)/i);
                if (moveMatch) {
                    handlePlayerCombatMove(`${moveMatch[1]} ${moveMatch[2]}`);
                    return;
                }

                // End turn: "paso turno", "termino turno", "fin de turno", "paso mi turno", "end turn", "pass turn", "skip turn"
                const endTurnMatch = text.match(/\b(?:paso\s+(?:mi\s+)?turno|termino\s+(?:mi\s+)?turno|fin\s+(?:de\s+)?turno|end\s+turn|pass\s+turn|skip\s+turn)\b/i);
                if (endTurnMatch) {
                    endPlayerCombatTurn();
                    return;
                }
            }
        }

        if (getCurrentWorldLocationMaps().length === 0) return;

        // Z3: con modelo, «entramos en el callejón» entra y «vamos a Castillo de Vane» viaja,
        // con sus días y solo a un vecino, antes de que conteste: así lo cuenta él. Nombrar
        // un sitio de pasada ya no teletransporta a nadie.
        const intent = readBox(message.mes, boxContext());
        if (intent.do === 'talk' && intent.name && worldNpc(String(intent.name))) {
            setTalkingTo(String(worldNpc(String(intent.name))?.name));
            notePlot({ kind: 'talk', npc: talkingTo, place: currentLocationName });
        } else if (intent.do === 'enter' && intent.name) {
            setCurrentBoardName(String(intent.name));
            saveCurrentBoard();
            placePartyAtStart(getLocationBoards(hereLocation()).find((/** @type {any} */ b) => b.name === currentBoardName));
            setPartyTab('location');
            toastr.info(`🎲 Entras en ${intent.name}`);
            tellBoard(String(intent.name));
        } else if (intent.do === 'go' && intent.name) {
            const { to, reason } = await travelWithTime(String(intent.name));
            if (to) setPartyTab('location');
            else if (reason) toastr.info(reason, 'No se puede viajar');
        }
    });
}
