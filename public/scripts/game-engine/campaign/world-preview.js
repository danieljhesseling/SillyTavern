/**
 * Vista previa del mundo: los sitios con sus caminos, las facciones y el hilo por actos
 * (idea 175).
 *
 * Para saber qué traía un mundo había que jugarlo o abrir su archivo. Ahora se ve de un
 * vistazo antes de empezar (y durante, desde la pausa): cada sitio con adónde lleva y en
 * cuántos días, quién manda y qué quiere, y el hilo como un grafo por actos — qué hito abre
 * cuál. Lo escondido se dice que existe, sin decir qué es.
 *
 * Puro: arma las secciones. Quien llama las dibuja.
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * @typedef {Object} WorldPreview
 * @property {string} name
 * @property {Array<{name: string, type: string, routes: string[]}>} places
 * @property {number} hidden Cuántos sitios están escondidos.
 * @property {Array<{name: string, goal: string, seat: string}>} factions
 * @property {Array<{act: number, milestones: Array<{id: string, title: string, after: string}>}>} acts
 */

/**
 * @param {any} metadata Los metadatos del mundo (o un paquete importado ya).
 * @returns {WorldPreview}
 */
export function previewOf(metadata) {
    const places = (Array.isArray(metadata?.locationMaps) ? metadata.locationMaps : []).map((/** @type {any} */ l) => ({
        name: text(l?.name),
        type: text(l?.locationType ?? l?.type),
        routes: (Array.isArray(l?.routes) ? l.routes : [])
            .map((/** @type {any} */ r) => `${text(r?.to)} (${Math.max(1, Number(r?.days) || 1)} d${r?.sea ? ', por mar' : ''})`),
    })).filter((/** @type {any} */ p) => p.name);
    const factions = (Array.isArray(metadata?.factions) ? metadata.factions : []).map((/** @type {any} */ f) => ({
        name: text(f?.name),
        goal: [text(f?.goal?.kind), text(f?.goal?.target)].filter(Boolean).join(' '),
        seat: text(f?.seat),
    })).filter((/** @type {any} */ f) => f.name);
    /** @type {Map<number, Array<{id: string, title: string, after: string}>>} */
    const byAct = new Map();
    for (const m of Array.isArray(metadata?.plot?.milestones) ? metadata.plot.milestones : []) {
        const act = Math.max(1, Math.floor(Number(m?.act) || 1));
        const hidden = Boolean(m?.hidden);
        const after = text(m?.opens?.milestone);
        if (!byAct.has(act)) byAct.set(act, []);
        byAct.get(act)?.push({ id: text(m?.id), title: hidden ? '(un secreto)' : text(m?.title), after });
    }
    return {
        name: text(metadata?.displayName ?? metadata?.name),
        places,
        hidden: Array.isArray(metadata?.hiddenLocations) ? metadata.hiddenLocations.length : 0,
        factions,
        acts: [...byAct.entries()].sort((a, b) => a[0] - b[0]).map(([act, milestones]) => ({ act, milestones })),
    };
}

/**
 * La vista en líneas de texto, para la ventana y para las pruebas.
 *
 * @param {WorldPreview} preview
 * @returns {string[]}
 */
export function describePreview(preview) {
    return [
        `${preview.name || 'El mundo'}: ${preview.places.length} sitio(s)${preview.hidden ? `, y ${preview.hidden} escondido(s)` : ''}.`,
        ...preview.places.map(p => `${p.name}${p.type ? ` (${p.type})` : ''} → ${p.routes.join(', ') || 'sin caminos'}`),
        ...preview.factions.map(f => `${f.name}${f.seat ? `, en ${f.seat}` : ''}${f.goal ? `: ${f.goal}` : ''}`),
        ...preview.acts.map(a => `Acto ${a.act}: ${a.milestones.map(m => m.title).join(' · ')}`),
    ];
}
