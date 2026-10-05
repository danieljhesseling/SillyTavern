/**
 * Creación del Estratega / Propietario (Paso 1 de 2 de la fundación de la compañía).
 *
 * El Estratega no es un soldado de primera línea: es el comandante que gestiona el caserío,
 * los contratos y las decisiones de ruta desde la retaguardia. Define su nombre, el de la
 * compañía, su retrato y su estilo de gestión (trasfondo).
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

import {
    STRATEGIST_BACKGROUNDS, SUGGESTED_NAMES, SUGGESTED_COMPANIES,
} from '../campaign/strategist.js';

export { STRATEGIST_BACKGROUNDS };

/**
 * @param {Object} input
 * @param {string} [input.worldName]
 * @param {((file: File) => Promise<string>)|null} [input.uploadFace]
 * @param {any} input.Popup
 * @param {any} input.POPUP_TYPE
 * @returns {Promise<{name: string, companyName: string, portrait: string, background: string, backgroundLabel: string, perk: string}|null>}
 */
export async function openStrategistCreator({
    worldName = '',
    uploadFace = null,
    Popup,
    POPUP_TYPE,
}) {
    let result = 0;
    /** @type {any} */
    let popup = null;

    let selectedBg = 'veterano';
    let portraitUrl = '';

    const root = $('<div class="hc-root sc-root"></div>');

    // Cabecera
    const back = $('<button type="button" class="menu_button hc-back"></button>')
        .append('<i class="fa-solid fa-arrow-left"></i>').append($('<span></span>').text('Volver'));
    const next = $('<button type="button" class="menu_button hc-enter"></button>')
        .append($('<span></span>').text('Siguiente: Guardaespaldas ')).append('<i class="fa-solid fa-arrow-right"></i>');

    const head = $('<div class="hc-head"></div>')
        .append($('<div class="hc-heading"></div>')
            .append($('<p class="hc-kicker"></p>').text(worldName ? `Fundación en ${worldName} · Paso 1 de 2` : 'Paso 1 de 2 · Mando y Compañía'))
            .append($('<h2 class="hc-title"></h2>').text('El Estratega y el Estandarte')))
        .append($('<div class="hc-head-actions"></div>').append(back, next));
    root.append(head);

    // Layout dos columnas
    const layout = $('<div class="hc-layout"></div>');
    const left = $('<div class="hc-left"></div>');
    const right = $('<div class="hc-right"></div>');
    layout.append(left, right);
    root.append(layout);

    // --- Columna Izquierda: Identidad y Retrato ---
    const identityBox = $('<div class="sc-identity-box"></div>');

    // Nombre del Estratega
    const nameGroup = $('<div class="sc-field-group"></div>');
    nameGroup.append($('<label class="sc-field-label"><strong>Nombre del Estratega / Líder:</strong></label>'));
    const nameRow = $('<div class="sc-input-row" style="display:flex; gap:6px; align-items:center;"></div>');
    const defaultName = SUGGESTED_NAMES[Math.floor(Math.random() * SUGGESTED_NAMES.length)];
    const nameInput = $('<input type="text" class="hc-input" placeholder="ej. Maese Elías, Capitana Val..." />').val(defaultName);
    const rollNameBtn = $('<button type="button" class="menu_button" title="Nombre aleatorio"><i class="fa-solid fa-dice"></i></button>');
    rollNameBtn.on('click', () => {
        const pick = SUGGESTED_NAMES[Math.floor(Math.random() * SUGGESTED_NAMES.length)];
        nameInput.val(pick);
    });
    nameRow.append(nameInput, rollNameBtn);
    nameGroup.append(nameRow);
    identityBox.append(nameGroup);

    // Nombre de la Compañía / Caserío
    const companyGroup = $('<div class="sc-field-group" style="margin-top:12px;"></div>');
    companyGroup.append($('<label class="sc-field-label"><strong>Nombre de la Compañía / Caserío:</strong></label>'));
    const companyRow = $('<div class="sc-input-row" style="display:flex; gap:6px; align-items:center;"></div>');
    const defaultCompany = SUGGESTED_COMPANIES[Math.floor(Math.random() * SUGGESTED_COMPANIES.length)];
    const companyInput = $('<input type="text" class="hc-input" placeholder="ej. La Cuadrilla del Roble..." />').val(defaultCompany);
    const rollCompanyBtn = $('<button type="button" class="menu_button" title="Nombre de compañía aleatorio"><i class="fa-solid fa-dice"></i></button>');
    rollCompanyBtn.on('click', () => {
        const pick = SUGGESTED_COMPANIES[Math.floor(Math.random() * SUGGESTED_COMPANIES.length)];
        companyInput.val(pick);
    });
    companyRow.append(companyInput, rollCompanyBtn);
    companyGroup.append(companyRow);
    identityBox.append(companyGroup);

    // Retrato del Estratega
    const portraitGroup = $('<div class="sc-field-group" style="margin-top:16px;"></div>');
    portraitGroup.append($('<label class="sc-field-label"><strong>Retrato de Mando:</strong></label>'));
    const portraitRow = $('<div style="display:flex; gap:14px; align-items:center;"></div>');

    const portraitPreview = $('<div class="sc-portrait-preview" style="width:72px; height:72px; border-radius:8px; border:2px solid var(--SmartThemeBorderColor, #d6b46a); background:rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; overflow:hidden;"></div>');
    const portraitIcon = $('<i class="fa-solid fa-chess-king" style="font-size:32px; color:var(--SmartThemeEmColor, #ffd27a);"></i>');
    portraitPreview.append(portraitIcon);

    const portraitActions = $('<div></div>');
    if (uploadFace) {
        const uploadInput = $('<input type="file" accept="image/*" style="display:none;" />');
        const uploadBtn = $('<button type="button" class="menu_button"><i class="fa-solid fa-upload"></i> Subir imagen...</button>');
        uploadBtn.on('click', () => { uploadInput.trigger('click'); });
        uploadInput.on('change', async function () {
            const file = /** @type {HTMLInputElement} */ (this).files?.[0];
            if (!file) return;
            try {
                const url = await uploadFace(file);
                if (url) {
                    portraitUrl = url;
                    portraitPreview.empty().append($(`<img src="${url}" alt="" style="width:100%; height:100%; object-fit:cover;" />`));
                }
            } catch (err) {
                console.error('[strategist] face upload error', err);
            }
        });
        portraitActions.append(uploadBtn, uploadInput);
    }
    const defaultIconBtn = $('<button type="button" class="menu_button" style="margin-left:6px;"><i class="fa-solid fa-shield-halved"></i> Blasón clásico</button>');
    defaultIconBtn.on('click', () => {
        portraitUrl = '';
        portraitPreview.empty().append(portraitIcon);
    });
    portraitActions.append(defaultIconBtn);

    portraitRow.append(portraitPreview, portraitActions);
    portraitGroup.append(portraitRow);
    identityBox.append(portraitGroup);

    left.append(identityBox);

    // --- Columna Derecha: Trasfondo de Gestión ---
    const bgHeader = $('<div class="hc-section-title" style="margin-bottom:8px;"></div>')
        .html('<strong>Estilo de Gestión y Trasfondo:</strong> <span style="font-size:0.85rem; opacity:0.8;">Ventaja inicial para tu compañía</span>');
    right.append(bgHeader);

    const bgList = $('<div class="sc-bg-list" style="display:flex; flex-direction:column; gap:8px;"></div>');

    for (const [id, bg] of Object.entries(STRATEGIST_BACKGROUNDS)) {
        const card = $('<div class="hc-card sc-bg-card" style="cursor:pointer; padding:10px 14px; border-radius:8px; border:1px solid rgba(214,180,106,0.25); background:rgba(255,255,255,0.04); transition:all 0.15s ease;"></div>')
            .attr('data-bg', id);

        const cardTop = $('<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;"></div>');
        cardTop.append($(`<span style="font-weight:700; color:var(--SmartThemeEmColor, #ffd27a);"><i class="fa-solid ${bg.icon}"></i> ${bg.label}</span>`));
        const checkBadge = $(`<span class="sc-check-badge" style="display:${id === selectedBg ? 'inline' : 'none'};"><i class="fa-solid fa-check" style="color:#6f9e5d;"></i></span>`);
        cardTop.append(checkBadge);

        const tagline = $(`<div style="font-size:0.82rem; opacity:0.75; margin-bottom:4px;">${bg.tagline}</div>`);
        const perk = $(`<div style="font-size:0.8rem; color:#93c5fd;"><i class="fa-solid fa-star" style="font-size:0.7rem;"></i> ${bg.perk}</div>`);

        card.append(cardTop, tagline, perk);

        card.on('click', () => {
            selectedBg = id;
            bgList.find('.sc-bg-card').css({ borderColor: 'rgba(214,180,106,0.25)', background: 'rgba(255,255,255,0.04)' });
            bgList.find('.sc-check-badge').hide();
            card.css({ borderColor: 'var(--SmartThemeEmColor, #ffd27a)', background: 'rgba(214,180,106,0.14)' });
            checkBadge.show();
        });

        if (id === selectedBg) {
            card.css({ borderColor: 'var(--SmartThemeEmColor, #ffd27a)', background: 'rgba(214,180,106,0.14)' });
        }

        bgList.append(card);
    }
    right.append(bgList);

    // Acciones de los botones
    back.on('click', () => {
        result = 0;
        void popup?.completeCancelled();
    });

    next.on('click', () => {
        const finalName = text(nameInput.val());
        const finalCompany = text(companyInput.val());
        if (!finalName) {
            nameInput.focus();
            if (typeof toastr !== 'undefined') toastr.warning('Indica un nombre para el Estratega.');
            return;
        }
        if (!finalCompany) {
            companyInput.focus();
            if (typeof toastr !== 'undefined') toastr.warning('Indica un nombre para la Compañía o Caserío.');
            return;
        }
        result = 1;
        void popup?.completeAffirmative();
    });

    popup = new Popup(root[0], POPUP_TYPE.TEXT, '', {
        okButton: false,
        cancelButton: false,
        large: true,
        allowVerticalScrolling: true,
    });
    await popup.show();

    if (result !== 1) return null;

    const bgObj = STRATEGIST_BACKGROUNDS[/** @type {keyof typeof STRATEGIST_BACKGROUNDS} */ (selectedBg)] || STRATEGIST_BACKGROUNDS.veterano;

    return {
        name: text(nameInput.val()) || defaultName,
        companyName: text(companyInput.val()) || defaultCompany,
        portrait: portraitUrl,
        background: selectedBg,
        backgroundLabel: bgObj.label,
        perk: bgObj.perk,
    };
}
