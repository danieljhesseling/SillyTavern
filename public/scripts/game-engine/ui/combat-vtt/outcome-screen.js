/**
 * J12.21 (Daniel, 2026-10-03; wiki/maquetas/ENCARGO_COMBATE_MUELLE_Y_RESULTADO.md, la maqueta
 * wiki/maquetas/resultado-combate.html): la pantalla de victoria o de derrota, pintada.
 *
 * Lo que dice lo decide `game-engine/combat/outcome.js` (`outcomeView`); aquí solo se pinta, con
 * el arte del juego (las caras y los objetos, si los hay) y los iconos de Font Awesome que ya trae
 * el juego. Nada de fuera.
 *
 * - La victoria va en una capa fija (`.vs-card.vo-layer`) que no es modal: los avisos de encima
 *   (alguien quiere decirte algo) se siguen pudiendo pulsar. Se cierra con su ✕, con Esc o
 *   pulsando fuera de la tarjeta; sus botones hacen lo suyo.
 * - La derrota va en un `<dialog>` modal: hay que elegir (despertar, volver al punto guardado…).
 *   Si se cierra sin elegir, se hace lo de por defecto.
 *
 * La capa lleva `.vs-card`, la clase de la tarjeta de antes: lo que espera a que se cierre (las
 * escenas del hilo, `party/plot.js`; las misiones personales; «Continuar» de la novela, que la
 * quita) sigue sabiendo que está.
 */

/**
 * @typedef {ReturnType<typeof import('../../combat/outcome.js').outcomeView>} OutcomeView
 * @typedef {import('../../combat/outcome.js').OutcomeButton} OutcomeButton
 */

/**
 * @typedef {Object} OutcomeHandlers
 * @property {(id: string, member?: string) => (void|boolean|Promise<void|boolean>)} onAction Lo que hace
 *   cada botón (`continue`, `rest`, `wake`…). Con `level`, el de «Subir a nivel» de alguien
 *   (`member`): la pantalla sigue abierta. Si devuelve `false`, la pantalla no se cierra.
 * @property {() => void} [onDismiss] Se cierra sin elegir nada (el ✕, Esc).
 */

/** La que está abierta, y lo que hace al cerrarse. */
let open = /** @type {{node: HTMLElement, done: boolean, handlers: OutcomeHandlers, keys: (event: KeyboardEvent) => void}|null} */ (null);

/**
 * @param {string} tag
 * @param {string} className
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

/**
 * @param {string} name
 * @returns {HTMLElement}
 */
function icon(name) {
    const node = el('i', `fa-solid ${name}`);
    node.setAttribute('aria-hidden', 'true');
    return node;
}

/**
 * Una cara: su dibujo, o su inicial si no hay (o no carga).
 *
 * @param {{face: string, initial: string, name: string}} member
 * @returns {HTMLElement}
 */
function face(member) {
    const box = el('span', 'vo-face');
    const initial = () => {
        box.textContent = member.initial;
        box.classList.add('vo-face-initial');
    };
    if (!member.face) {
        initial();
        return box;
    }
    const img = /** @type {HTMLImageElement} */ (el('img', 'pixel-art'));
    img.src = member.face;
    img.alt = '';
    img.addEventListener('error', () => {
        img.remove();
        initial();
    }, { once: true });
    box.appendChild(img);
    return box;
}

/**
 * La fila de alguien del grupo.
 *
 * @param {OutcomeView['members'][number]} member
 * @param {OutcomeHandlers} handlers
 * @returns {HTMLElement}
 */
function memberCard(member, handlers) {
    const row = el('div', `vo-member vo-state-${member.state.tone}`);
    row.dataset.member = member.id;
    const wrap = el('div', 'vo-face-wrap');
    wrap.appendChild(face(member));
    if (member.levelUp) {
        const star = el('span', 'vo-level-badge');
        star.title = member.levelUp;
        star.appendChild(icon('fa-star'));
        wrap.appendChild(star);
    }
    row.appendChild(wrap);

    const info = el('div', 'vo-member-info');
    const names = el('div', 'vo-member-name-row');
    names.append(el('span', 'vo-member-name', member.name), el('span', 'vo-member-role', member.role));
    info.appendChild(names);
    const hp = el('div', 'vo-hp-row');
    const bar = el('div', 'vo-hp-bar');
    bar.setAttribute('role', 'meter');
    bar.setAttribute('aria-label', 'Vida');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', String(member.max));
    bar.setAttribute('aria-valuenow', String(member.hp));
    const fill = el('div', `vo-hp-fill vo-hp-${member.hpTone}`);
    fill.style.width = `${member.pct}%`;
    bar.appendChild(fill);
    hp.append(bar, el('span', 'vo-hp-text', member.hpText));
    info.appendChild(hp);
    // Idea 191: quién hizo qué en esta pelea.
    if (member.deeds) info.appendChild(el('div', 'vo-deeds', member.deeds));
    const tags = el('div', 'vo-tags');
    if (member.best) {
        const best = el('span', 'vo-tag vo-tag-best');
        best.append(icon('fa-star'), document.createTextNode(' Sostuvo el combate'));
        tags.appendChild(best);
    }
    const state = el('span', `vo-tag vo-tag-${member.state.tone}`);
    state.append(icon(member.state.icon), document.createTextNode(` ${member.state.label}`));
    tags.appendChild(state);
    if (member.fell) {
        const fell = el('span', 'vo-tag vo-tag-down');
        fell.append(icon('fa-person-falling'), document.createTextNode(' Cayó en la pelea'));
        tags.appendChild(fell);
    }
    for (const scar of member.scars) {
        const tag = el('span', `vo-tag ${scar.permanent ? 'vo-tag-dead' : 'vo-tag-wound'}`);
        tag.append(icon(scar.permanent ? 'fa-bone' : 'fa-crutch'), document.createTextNode(` ${scar.label}`));
        if (scar.permanent) tag.title = 'Una secuela: no se cura.';
        tags.appendChild(tag);
    }
    info.appendChild(tags);
    row.appendChild(info);

    const side = el('div', 'vo-member-side');
    if (member.xpText) side.appendChild(el('span', 'vo-xp', member.xpText));
    if (member.levelUp) {
        const up = /** @type {HTMLButtonElement} */ (el('button', 'vo-level-btn'));
        up.type = 'button';
        up.dataset.action = 'level';
        up.append(icon('fa-arrow-up'), document.createTextNode(` ${member.levelUp}`));
        up.title = `${member.name} puede subir de nivel: elegir lo que gana`;
        up.addEventListener('click', () => void handlers.onAction('level', member.id));
        side.appendChild(up);
    }
    row.appendChild(side);
    return row;
}

/**
 * El botín de la victoria.
 *
 * @param {OutcomeView} view
 * @returns {HTMLElement}
 */
function lootBlock(view) {
    const panel = el('div', 'vo-panel vo-loot');
    if (view.gold) {
        const purse = el('div', 'vo-purse');
        const what = el('span', 'vo-purse-what');
        what.append(icon('fa-coins'), document.createTextNode(' Monedas'));
        purse.append(what, el('span', 'vo-purse-val vo-gain', view.gold));
        panel.appendChild(purse);
    }
    if (view.items.length > 0) {
        panel.appendChild(el('div', 'vo-loot-head', `Objetos (${view.items.length})`));
        const list = el('div', 'vo-loot-list');
        for (const item of view.items) {
            const row = el('div', `vo-loot-item vo-kind-${item.kind}`);
            const glyph = el('span', 'vo-loot-icon');
            if (item.art) {
                const img = /** @type {HTMLImageElement} */ (el('img', 'pixel-art'));
                img.src = item.art;
                img.alt = '';
                img.addEventListener('error', () => {
                    img.remove();
                    glyph.appendChild(icon(item.icon));
                }, { once: true });
                glyph.appendChild(img);
            } else {
                glyph.appendChild(icon(item.icon));
            }
            row.append(glyph, el('span', 'vo-loot-name', item.name), el('span', 'vo-loot-kind', item.label));
            list.appendChild(row);
        }
        panel.appendChild(list);
    }
    // Idea 63: lo que mejora lo que lleva alguien.
    for (const upgrade of view.upgrades ?? []) {
        const line = el('div', 'vo-upgrade');
        line.append(icon('fa-arrow-up'), document.createTextNode(` ${upgrade}`));
        panel.appendChild(line);
    }
    if (view.emptyLoot) panel.appendChild(el('div', 'vo-empty', view.emptyLoot));
    return panel;
}

/**
 * El coste de la derrota: quién os recoge, lo que cobra y el tiempo en cama.
 *
 * @param {NonNullable<OutcomeView['cost']>} cost
 * @returns {HTMLElement}
 */
function costBlock(cost) {
    const panel = el('div', 'vo-panel vo-cost');
    if (cost.purse) {
        const purse = el('div', 'vo-purse');
        const what = el('span', 'vo-purse-what');
        what.append(icon('fa-hand-holding-dollar'), document.createTextNode(' Rescate y curas'));
        purse.append(what, el('span', 'vo-purse-val vo-loss', cost.purse));
        panel.appendChild(purse);
    }
    for (const line of cost.lines) {
        const card = el('div', 'vo-consequence');
        const head = el('strong', 'vo-consequence-title');
        head.append(icon(line.icon), document.createTextNode(` ${line.title}`));
        card.append(head, el('span', 'vo-consequence-text', line.text));
        panel.appendChild(card);
    }
    return panel;
}

/**
 * Pintar la tarjeta entera.
 *
 * @param {OutcomeView} view
 * @param {OutcomeHandlers} handlers
 * @param {(id: string) => void} act
 * @returns {HTMLElement}
 */
function cardOf(view, handlers, act) {
    const victory = view.kind === 'victory';
    const card = el('div', `vo-card vo-${view.kind}`);
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-labelledby', 'vo-title');

    const banner = el('div', 'vo-banner');
    const crest = el('div', 'vo-crest');
    crest.appendChild(icon(view.crest));
    const title = el('h2', 'vo-title', view.title);
    title.id = 'vo-title';
    banner.append(crest, title, el('div', 'vo-sub', view.sub));
    if (victory) {
        const close = /** @type {HTMLButtonElement} */ (el('button', 'vo-close'));
        close.type = 'button';
        close.title = 'Cerrar (Esc)';
        close.setAttribute('aria-label', 'Cerrar');
        close.appendChild(icon('fa-xmark'));
        close.addEventListener('click', () => act('dismiss'));
        banner.appendChild(close);
    }
    card.appendChild(banner);

    const body = el('div', 'vo-body');
    const left = el('div', 'vo-column');
    const rosterHead = el('div', 'vo-block-title');
    rosterHead.append(icon(victory ? 'fa-users' : 'fa-users-slash'), document.createTextNode(` ${view.rosterTitle}`));
    left.appendChild(rosterHead);
    const roster = el('div', 'vo-roster');
    for (const member of view.members) roster.appendChild(memberCard(member, handlers));
    left.appendChild(roster);
    body.appendChild(left);

    const right = el('div', 'vo-column');
    if (victory) {
        const head = el('div', 'vo-block-title');
        head.append(icon('fa-sack-dollar'), document.createTextNode(` ${view.lootTitle}`));
        right.append(head, lootBlock(view));
    } else if (view.cost) {
        const head = el('div', 'vo-block-title');
        head.append(icon('fa-scale-unbalanced'), document.createTextNode(` ${view.cost.title}`));
        right.append(head, costBlock(view.cost));
    }
    if (view.hardNote) {
        const hard = el('div', 'vo-hard');
        hard.append(icon('fa-triangle-exclamation'), document.createTextNode(` ${view.hardNote}`));
        right.appendChild(hard);
    }
    if (right.childElementCount > 0) body.appendChild(right);
    else body.classList.add('vo-body-single');
    card.appendChild(body);

    const footer = el('div', 'vo-footer');
    const note = el('div', 'vo-note');
    // El aviso del modo de hierro ya va arriba, en rojo: abajo, lo demás.
    const said = view.hardNote ? view.note.text.replace(view.hardNote, '').trim() : view.note.text;
    if (said) note.append(icon(view.note.icon), el('span', '', said));
    footer.appendChild(note);
    const actions = el('div', 'vo-actions');
    for (const spec of view.buttons) {
        const button = /** @type {HTMLButtonElement} */ (el('button', `vo-btn vo-btn-${spec.tone}${spec.main ? ' vo-go' : ''}${spec.className ? ` ${spec.className}` : ''}`));
        button.type = 'button';
        button.dataset.action = spec.id;
        if (spec.title) button.title = spec.title;
        button.append(icon(spec.icon), el('span', 'vo-btn-label', spec.label));
        button.addEventListener('click', () => act(spec.id));
        actions.appendChild(button);
    }
    footer.appendChild(actions);
    card.appendChild(footer);
    return card;
}

/**
 * Cerrar la pantalla abierta, si la hay. Sin elegir nada (`dismiss`).
 */
export function closeOutcomeScreen() {
    const was = open;
    if (!was) return;
    open = null;
    document.removeEventListener('keydown', was.keys, true);
    if (was.node instanceof HTMLDialogElement && was.node.open) {
        was.done = true;
        was.node.close();
    }
    was.node.remove();
}

/** @returns {boolean} Si hay una pantalla de victoria o de derrota abierta. */
export function outcomeScreenOpen() {
    return Boolean(open?.node.isConnected);
}

/**
 * Sacar la pantalla (la de antes, si había otra, se quita).
 *
 * @param {OutcomeView} view
 * @param {OutcomeHandlers} handlers
 * @returns {HTMLElement} La capa.
 */
export function showOutcomeScreen(view, handlers) {
    closeOutcomeScreen();
    document.querySelectorAll('.vs-card').forEach(card => card.remove());
    const victory = view.kind === 'victory';
    const fallen = !victory && view.fallen;
    const node = victory ? el('div', 'vs-card vo-layer vo-layer-victory') : /** @type {HTMLDialogElement} */ (el('dialog', 'vs-card vo-layer vo-layer-defeat'));
    node.dataset.outcome = view.kind;
    const state = { node, done: false, handlers, keys: /** @type {(event: KeyboardEvent) => void} */ (() => {}) };

    /**
     * Lo que hace un botón: el de «Subir a nivel» no cierra; los demás, sí (salvo que digan que no).
     *
     * @param {string} id
     */
    const act = (id) => {
        if (open !== state) return;
        if (id === 'dismiss') {
            closeOutcomeScreen();
            handlers.onDismiss?.();
            return;
        }
        state.done = true;
        const result = handlers.onAction(id);
        if (result === false) {
            state.done = false;
            return;
        }
        closeOutcomeScreen();
    };

    const card = cardOf(view, handlers, act);
    // Sin nadie con vida: es la tarjeta de «ha caído todo el grupo» de siempre (J9.1, `.pf-root`
    // dentro de su ventana, con `.pf-back`, `.pf-load` y `.pf-home`).
    if (fallen) card.classList.add('pf-root');
    node.appendChild(card);
    if (victory) {
        node.setAttribute('role', 'presentation');
        // Pulsar fuera de la tarjeta (lo oscuro de alrededor) la cierra, como antes.
        node.addEventListener('click', (event) => {
            if (event.target === node) act('dismiss');
        });
    } else {
        const dialog = /** @type {HTMLDialogElement} */ (node);
        // Esc no la quita: hay que elegir.
        dialog.addEventListener('cancel', (event) => event.preventDefault());
        // Si alguien la cierra sin elegir, lo de por defecto (despertar, seguir).
        dialog.addEventListener('close', () => {
            if (state.done || open !== state) return;
            const main = view.buttons.find(b => b.main) ?? view.buttons[0];
            if (main) act(main.id);
            else closeOutcomeScreen();
        });
    }
    state.keys = (event) => {
        if (open !== state || event.defaultPrevented) return;
        // Quitada desde fuera («Continuar» de la novela quita `.vs-card`): ya no es de nadie.
        if (!state.node.isConnected) {
            closeOutcomeScreen();
            return;
        }
        // Esc es de la ventana que haya encima (la subida de nivel, una charla), no de esta.
        if (document.querySelector('dialog[open]:not(.vo-layer), .popup[open]')) return;
        if (event.key === 'Escape' && victory) {
            event.preventDefault();
            event.stopPropagation();
            act('dismiss');
        }
    };
    document.addEventListener('keydown', state.keys, true);
    open = state;
    document.body.appendChild(node);
    if (node instanceof HTMLDialogElement) {
        try {
            node.showModal();
        } catch {
            node.setAttribute('open', '');
        }
    }
    // El foco, al botón de por defecto: Intro sigue.
    const main = /** @type {HTMLElement|null} */ (node.querySelector('.vo-go') ?? node.querySelector('.vo-btn'));
    main?.focus({ preventScroll: true });
    return node;
}
