/**
 * Modelo y reglas del Estratega / Propietario de la Compañía.
 *
 * El Estratega no es un peón en el tablero: es el líder de la compañía y el avatar
 * narrativo del jugador en decisiones, contratos y gestión del gremio / caserío.
 *
 * Puro: no toca el DOM ni SillyTavern directamente.
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Trasfondos de gestión y sus ventajas iniciales.
 */
export const STRATEGIST_BACKGROUNDS = {
    veterano: {
        id: 'veterano',
        label: 'Veterano de guerra',
        icon: 'fa-shield-halved',
        tagline: 'Colgaste la espada tras años en el fango.',
        perk: '+1 a la iniciativa de toda la escuadra y temple táctico en combate.',
    },
    mercader: {
        id: 'mercader',
        label: 'Mercader endeudado',
        icon: 'fa-coins',
        tagline: 'Compraste la patente con tu última bolsa de táleros.',
        perk: '+10% de ganancia de oro en recompensas de contratos y venta de botín.',
    },
    escriba: {
        id: 'escriba',
        label: 'Antiguo escriba',
        icon: 'fa-scroll',
        tagline: 'Serviste en castillos llevando inventarios y registros reales.',
        perk: '-20% en los costes semanales de mantenimiento del gremio.',
    },
    campesino: {
        id: 'campesino',
        label: 'Heredero local',
        icon: 'fa-wheat-awn',
        tagline: 'El caserío pertenecía a tu familia. Conoces la tierra y el grano.',
        perk: '+5 raciones iniciales en la despensa y descanso reconfortante.',
    },
};

export const SUGGESTED_NAMES = [
    'Elías', 'Valeria', 'Alden', 'Gareth', 'Morrigan', 'Roland',
    'Kaelen', 'Beatriz', 'Duncan', 'Cassian', 'Nerea', 'Yvaine',
];

export const SUGGESTED_COMPANIES = [
    'La Cuadrilla del Roble', 'Compañía de Puerto Alba', 'Los Cuervos del Vado',
    'Estandarte de la Bruma', 'Hermandad del Caserío', 'Los Halcones Grises',
    'Compañía de la Luna de Hierro', 'Compañía de la Espada Rota',
];

/**
 * Describe al estratega y su compañía en una línea narrativa.
 *
 * @param {Object} strategist
 * @param {string} [strategist.name]
 * @param {string} [strategist.companyName]
 * @param {string} [strategist.background]
 * @param {string} [strategist.backgroundLabel]
 * @returns {string}
 */
export function describeStrategist(strategist) {
    if (!strategist) return '';
    const name = text(strategist.name) || 'Estratega';
    const company = text(strategist.companyName) || 'Compañía';
    const bg = STRATEGIST_BACKGROUNDS[/** @type {keyof typeof STRATEGIST_BACKGROUNDS} */ (strategist.background)]?.label
        || strategist.backgroundLabel
        || 'Estratega';
    return `${name} (${bg}), al mando de "${company}"`;
}

/**
 * Valida los datos iniciales del Estratega.
 *
 * @param {{name?: string, companyName?: string}} input
 * @returns {string[]} Lista de errores (vacía si es válido).
 */
export function validateStrategist(input) {
    const errors = [];
    if (!text(input?.name)) errors.push('El estratega necesita un nombre.');
    if (!text(input?.companyName)) errors.push('La compañía necesita un nombre o estandarte.');
    return errors;
}

/**
 * Aplica las propiedades de guardaespaldas a una ficha de aventurero.
 *
 * @param {any} dndData Ficha de personaje.
 * @param {any} strategist Estratega que comanda.
 * @returns {any}
 */
export function linkBodyguard(dndData, strategist) {
    if (!dndData || typeof dndData !== 'object') return dndData;
    return {
        ...dndData,
        isBodyguard: true,
        commander: text(strategist?.name) || 'Comandante',
    };
}
