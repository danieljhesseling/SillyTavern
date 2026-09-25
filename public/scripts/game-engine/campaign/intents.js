/**
 * Leer la intención mientras se escribe (idea 137).
 *
 * Quien escribe «intento convencer al guardia» está pidiendo una tirada sin saberlo. Si el
 * motor lo ve venir, ofrece la ficha —«🎲 Persuasión»— y la tirada viaja dentro del mensaje,
 * como cualquier otra. No decide nada: solo ofrece. Y no adivina de más: solo verbos claros.
 *
 * Puro: de texto a habilidades.
 */

/** Los verbos que delatan cada habilidad. */
const CUES = [
    { skill: 'persuasion', words: /\b(convenc|persuad|negoci|suplic|ruego|le pido que|intento que acepte)/ },
    { skill: 'deception', words: /\b(mient|miento|enga[nñ]|finjo|disfraz|hago creer|me hago pasar)/ },
    { skill: 'intimidation', words: /\b(amenaz|intimid|asust|le grito que|le pongo el cuchillo)/ },
    { skill: 'insight', words: /\b(si miente|si me enga[nñ]a|le calo|le leo la cara|desconf[ií]o de)/ },
    { skill: 'perception', words: /\b(miro alrededor|escucho|vigilo|me fijo|oteo|busco con la mirada)/ },
    { skill: 'investigation', words: /\b(registr|examin|investig|rebusco|busco pistas|reviso)/ },
    { skill: 'stealth', words: /\b(me escondo|sigil|a hurtadillas|me cuelo|sin que me vean|me agacho)/ },
    { skill: 'athletics', words: /\b(trep|salto|escal|nado|empujo la|fuerzo la|derribo la|corro hacia)/ },
    { skill: 'sleight', words: /\b(robo|le quito|forzar la cerradura|ganz[uú]a|le birlo|carterist)/ },
];

/**
 * Las habilidades que sugiere un texto, en orden de aparición. Dos como mucho.
 *
 * @param {string} said
 * @returns {string[]}
 */
export function intentSkills(said) {
    const lower = String(said ?? '').toLowerCase();
    if (lower.trim().length < 6) return [];
    return CUES
        .map(cue => ({ skill: cue.skill, at: lower.search(cue.words) }))
        .filter(hit => hit.at >= 0)
        .sort((a, b) => a.at - b.at)
        .slice(0, 2)
        .map(hit => hit.skill);
}
