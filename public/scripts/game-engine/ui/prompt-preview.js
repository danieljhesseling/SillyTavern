/**
 * The prompt preview: what this turn is about to send, and what the session has cost.
 *
 * Opened with /prompt. It draws whatever the last generation was built from, broken into
 * named blocks and sorted by size, because the useful question is never "how big is the
 * prompt" but "which part of it is big".
 *
 * Shows estimates as estimates. SillyTavern does not hand the provider's own token count
 * back to the page, so the figures here are the app's own measurement of what it sent,
 * not a bill. Saying so is the point: this whole area exists because a confident wrong
 * number sent the project down the wrong path once already.
 *
 * See wiki/ROADMAP.md, T3 and T4.
 */

import {
    describePrompt, emptySession, addTurn, estimateSpend, splitFixedFromConversation,
} from '../cost/prompt-meter.js';

/** The last request the app built, and the running session total. */
let lastPrompt = null;
let session = emptySession();

/** Where the player's price per million tokens is kept between sessions. */
const PRICE_KEY = 'sillytavern_promptPricePerMillion';

/** @returns {number} */
function readPrice() {
    try {
        return Number(globalThis.localStorage?.getItem(PRICE_KEY)) || 0;
    } catch {
        return 0;
    }
}

/** @param {number} value */
function writePrice(value) {
    try {
        globalThis.localStorage?.setItem(PRICE_KEY, String(value));
    } catch {
        // A price we cannot remember is a small loss; not being able to play is not.
    }
}

/**
 * Records a turn. Called from the generation event, so the preview always shows the real
 * request rather than one rebuilt for display and possibly different.
 *
 * @param {any} generateData
 * @param {boolean} [dryRun]
 */
export function recordPrompt(generateData, dryRun = false) {
    if (dryRun) return;
    const described = describePrompt(generateData);
    if (described.blocks.length === 0) return;
    lastPrompt = described;
    session = addTurn(session, described);
}

/** The session so far. */
export function getSession() {
    return session;
}

/** Starts counting again, without touching the chat. */
export function resetSession() {
    session = emptySession();
    return session;
}

/**
 * Opens the preview over the last recorded turn.
 *
 * @param {{Popup: any, POPUP_TYPE: any}} deps
 */
export async function openPromptPreview({ Popup, POPUP_TYPE }) {
    const root = $('<div class="pp-root"></div>');

    if (!lastPrompt) {
        root.append(`
            <div class="pp-head">
                <div class="pp-title"><i class="fa-solid fa-scale-balanced"></i> Coste del turno</div>
            </div>
            <div class="pp-empty">
                Todavía no se ha enviado nada al modelo en esta sesión.
                Escribe un mensaje y vuelve a abrir esto.
            </div>
        `);
        await new Popup(root, POPUP_TYPE.TEXT, '', { okButton: 'Cerrar' }).show();
        return;
    }

    const split = splitFixedFromConversation(lastPrompt.blocks);
    const price = readPrice();

    root.append(`
        <div class="pp-head">
            <div class="pp-title"><i class="fa-solid fa-scale-balanced"></i> Qué se envía en cada turno</div>
            <div class="pp-sub">Del último turno generado. Ordenado por tamaño.</div>
        </div>
    `);

    // A bar per block: a table of numbers hides the one that matters, a bar does not.
    const list = $('<div class="pp-blocks"></div>');
    const max = lastPrompt.blocks[0]?.tokens || 1;

    for (const block of lastPrompt.blocks) {
        const row = $('<div class="pp-block"></div>');
        const share = Math.round((block.tokens / (lastPrompt.totalTokens || 1)) * 100);

        const head = $('<div class="pp-block-head"></div>');
        head.append($('<span class="pp-block-label"></span>').text(block.label));
        head.append($('<span class="pp-block-tokens"></span>').text(`${block.tokens} tk · ${share}%`));
        row.append(head);

        row.append($('<div class="pp-bar"></div>').append(
            $('<div class="pp-bar-fill"></div>').css('width', `${Math.max(2, (block.tokens / max) * 100)}%`),
        ));

        const peek = $('<details class="pp-peek"></details>');
        peek.append($('<summary></summary>').text('Ver el principio de este bloque'));
        peek.append($('<pre></pre>').text(block.preview));
        row.append(peek);

        list.append(row);
    }
    root.append(list);

    // The ratio that decides whether a campaign gets more expensive as it goes.
    const fixedShare = Math.round(split.ratio * 100);
    root.append($('<div class="pp-split"></div>').text(
        `Contexto fijo que se reenvía cada turno: ${split.fixed} tk (${fixedShare}%). `
        + `Conversación: ${split.conversation} tk.`,
    ));

    if (fixedShare >= 70) {
        root.append($('<div class="pp-note"></div>').text(
            'La mayor parte de lo que pagas por turno es contexto que se repite. '
            + 'Ahí es donde actúan la caché de prompt y el resumen del historial.',
        ));
    }

    const totals = $('<div class="pp-session"></div>');
    totals.append($('<div class="pp-session-title"></div>').text('Esta sesión'));
    totals.append($('<div></div>').text(
        `${session.turns} turno(s) · ${session.promptTokens} tokens enviados · `
        + `mayor turno ${session.largestTurn} tk`,
    ));

    const priceRow = $('<div class="pp-price"></div>');
    priceRow.append($('<span></span>').text('Precio de entrada por millón de tokens: '));
    const priceInput = $('<input type="number" class="text_pole pp-price-input" min="0" step="0.01">').val(price || '');
    priceRow.append(priceInput);

    const spendOut = $('<span class="pp-spend"></span>');
    const drawSpend = (/** @type {number} */ rate) => {
        const result = estimateSpend(session, rate);
        spendOut.text(rate > 0
            ? ` ≈ ${result.spend.toFixed(4)} por esta sesión (${Math.round(result.perTurn)} tk/turno)`
            : ' (escribe el precio de tu proveedor para ver el gasto)');
    };
    drawSpend(price);
    priceInput.on('input', () => {
        const rate = Number(priceInput.val()) || 0;
        writePrice(rate);
        drawSpend(rate);
    });
    priceRow.append(spendOut);
    totals.append(priceRow);
    root.append(totals);

    root.append($('<div class="pp-warning"></div>').text(
        'Los tokens son la medida propia de la aplicación sobre lo que envía, no la factura '
        + 'del proveedor: SillyTavern no devuelve a la página el recuento real de la API. '
        + 'Sirve para comparar turnos entre sí, no para cuadrar el recibo.',
    ));

    await new Popup(root, POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', wide: true, allowVerticalScrolling: true }).show();
}
