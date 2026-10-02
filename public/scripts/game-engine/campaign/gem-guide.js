/**
 * Cómo se escribe una campaña hoy, para los Gems (los Gems al día, 2026-10-02).
 *
 * `campaign-pack-schema.js` dice **qué** campos hay; esto dice **cómo** se escriben, con las
 * decisiones de Daniel que un esquema no puede contar: la historia se cuenta hablando (D-J54),
 * nadie dice su nombre antes de presentarse (J13.7), el grupo de referencia es de 4 (D-J56), las
 * facciones son reputación y nada más (D-J58), los plazos están apagados (D-J46) y cada persona
 * trae su aspecto, para su retrato.
 *
 * Lo lee `tools/gem-instructions.mjs` para escribir `wiki/GEM_CREAR_CAMPANA.md` (las
 * instrucciones cortas y el anexo). Las muestras se comprueban con el validador en las pruebas:
 * lo que se le enseña al Gem entra entero en el juego.
 *
 * Puro.
 */

import { CAMPAIGN_PACK_VERSION } from './campaign-pack-schema.js';

/**
 * @typedef {Object} WritingRule
 * @property {string} id
 * @property {string} why De qué decisión sale (D-J54, J13.7…).
 * @property {string} title
 * @property {string} rule Lo que hay que hacer, en una o dos frases.
 * @property {string} bad Así no (JSON o texto corto).
 * @property {string} good Así sí.
 */

/** @type {WritingRule[]} */
export const WRITING_RULES = [
    {
        id: 'conversaciones',
        why: 'D-J54',
        title: 'La historia se cuenta hablando',
        rule: 'Las escenas son conversaciones de novela visual, como en Etrian Odyssey: cada línea la dice alguien (`who`), '
            + 'con su cara (`mood`), y sale con su retrato y su nombre. El narrador casi desaparece: una línea sin `who`, '
            + 'corta y sin placa, solo para el ambiente o el paso del tiempo. Nunca dos seguidas.',
        bad: '{ "text": "La posadera os mira con desconfianza y os cuenta que el faro lleva tres noches apagado y que ya se han hundido dos barcas." }',
        good: '{ "text": "Cae la tarde sobre el puerto." },\n'
            + '{ "who": "Marta Salmuera", "mood": "triste", "text": "Tres noches sin faro. Y ya se nos han hundido dos barcas." }',
    },
    {
        id: 'voces',
        why: 'J13.8',
        title: 'Cada uno con su voz, y la gente reacciona',
        rule: 'Cada persona habla como dice su `voice`, en todas sus líneas. La gente reacciona a lo último que elegiste '
            + '(`alt` con `chose`) y a quién eres (`alt` o `if` con `class`, `species`, `gender`, `background`): una o dos veces por escena, sin pasarse. '
            + 'Ninguna respuesta corta del héroe («Gracias», «Lo siento») se queda sin `reply`.',
        bad: '{ "who": "Lía Remos", "text": "Vamos al faro." }  (igual hayas hecho lo que hayas hecho)',
        good: '{ "who": "Lía Remos", "text": "Vamos al faro.",\n'
            + '  "alt": [{ "if": { "chose": "pagar" }, "mood": "enfadado", "text": "Ya que cobráis, al menos subid rápido." }] }',
    },
    {
        id: 'presentarse',
        why: 'J13.7',
        title: 'Nadie tiene nombre hasta que se presenta',
        rule: 'Quien juega solo sabe el nombre de quien se ha presentado; hasta entonces el juego le llama por su oficio (`trade`): '
            + '«la posadera». Que la gente diga su nombre al conocerse, o que otro lo diga en voz alta con `presenta`. '
            + 'Antes de eso, ni el héroe ni el narrador ni el título del hito le nombran. Dale a cada persona su `id`, `trade` y `gender`.',
        bad: '{ "who": "Ezequiel Rocamar", "text": "Hola." },\n{ "who": "Marta Salmuera", "text": "Ezequiel lo vio todo." }  (nadie le ha presentado)',
        good: '{ "who": "Marta Salmuera", "text": "Este es Ezequiel, el farero. Lo vio todo.", "presenta": "ezequiel" }',
    },
    {
        id: 'grupo-de-4',
        why: 'D-J56',
        title: 'Para un grupo de 4, con su nivel',
        rule: 'Las peleas se piensan para cuatro (el héroe y tres compañeros), como en D&D. Di para qué nivel es la campaña '
            + '(`world.levels`, desde y hasta): el juego ajusta dentro de un margen si van más o menos, pero sin que dé igual el nivel.',
        bad: '"levels": [1, 10]  y una pelea con un solo bandido',
        good: '"levels": [1, 3]  y peleas de 3 a 5 enemigos de desafío bajo, con un jefe al final',
    },
    {
        id: 'facciones',
        why: 'D-J58',
        title: 'Las facciones son reputación',
        rule: 'De una facción solo cuenta cómo os mira (`reputation`, de -5 a 5) y lo que la historia escrita hace con ello: '
            + 'un camino que se abre (`routes[].opensWith`), un peaje o un soborno en una charla, un final (`endingBy`). La reputación '
            + 'la mueven las decisiones (`changes.standing`). Nada se mueve solo: no escribas relojes (`opens.kind: "clock"`), '
            + 'sitios que cambien de manos ni precios por facción.',
        bad: '"opens": { "kind": "clock", "faction": "cofradia" }',
        good: '"routes": [{ "to": "La cala", "opensWith": [{ "standing": "cofradia", "min": 1 }], "gateNote": "La Cofradía no deja pasar a forasteros." }]',
    },
    {
        id: 'plazos',
        why: 'D-J46',
        title: 'Los plazos, apagados',
        rule: 'Los plazos (`within`, `late`) están apagados por ahora: puedes escribirlos, pero no saltan. Ninguna historia puede '
            + 'depender de que se pase un plazo: lo que importa se abre con `after`, `arrive` o `start`.',
        bad: 'Un hito que solo se abre si se pasa el plazo de otro',
        good: '"opens": { "kind": "after", "milestone": "llegada" }',
    },
    {
        id: 'aspecto',
        why: 'retratos',
        title: 'Cada persona, con su aspecto',
        rule: 'Cada persona de `npcs` y `confidants` trae `aspecto`: edad, complexión, ropa y un rasgo que se vea a la primera, '
            + 'en una o dos frases. Con él se dibujan su retrato y sus tres caras (alegre, enfadado, triste).',
        bad: '"aspecto": "Misteriosa y bella"',
        good: '"aspecto": "Mujer de unos cincuenta, ancha de hombros, delantal de cuero y una quemadura en el antebrazo."',
    },
    {
        id: 'llano',
        why: 'estilo',
        title: 'Que se entienda a la primera',
        rule: 'Frases cortas y llanas, de una a tres por línea. Nada de acertijos ni presagios crípticos. Donde se le habla '
            + 'a quien juega, sus dos formas entre llaves: «Eres {un forastero|una forastera}». Localización, nunca «localidad».',
        bad: '"text": "El peaje sangrará dos veces bajo la luna sin nombre."',
        good: '"text": "Si pasáis por el puente, os cobrarán dos veces: a la ida y a la vuelta."',
    },
];

/**
 * Las reglas, escritas para el Gem: cada una con su ejemplo bueno y malo.
 *
 * @returns {string}
 */
export function writingRulesText() {
    return WRITING_RULES.map((rule, i) => [
        `${i + 1}. **${rule.title}** (${rule.why}). ${rule.rule}`,
        `   - Así no: \`${rule.bad.replace(/\n/g, ' ')}\``,
        `   - Así sí: \`${rule.good.replace(/\n/g, ' ')}\``,
    ].join('\n')).join('\n');
}

/**
 * Una campaña corta escrita como se escribe ahora: conversaciones con su cara, gente que se
 * presenta, el aspecto de cada uno, una charla con ramas y el grupo de 4. Sin tableros ni
 * bestiario: los pone el juego (es la forma corta).
 *
 * Es la muestra de las instrucciones cortas del Gem, y la que pega `tools/e2e-gem-conversacion.mjs`
 * en «Añadir una campaña».
 *
 * @returns {any}
 */
export function buildConversationSamplePack() {
    return {
        version: CAMPAIGN_PACK_VERSION,
        world: {
            name: 'La luz de Punta Gris',
            genre: 'Fantasía de aventuras',
            synopsis: 'En Punta Gris el faro lleva tres noches apagado y ya se han hundido dos barcas. '
                + 'En la torre vieja de la punta se ve una luz que no guía a nadie.',
            levels: [1, 3],
            journey: { days: 2, how: 'Bajáis por el camino de la costa hasta un pueblo de pescadores.' },
            factions: [
                { id: 'cofradia', name: 'La Cofradía de pescadores', goals: 'Que el faro vuelva a encenderse antes de la temporada.', reputation: 0 },
            ],
        },
        locations: [
            {
                name: 'Punta Gris',
                type: 'village',
                description: 'Casas blancas, redes tendidas al sol y un faro apagado al final de la punta.',
                routes: [{ to: 'El faro viejo', days: 1 }],
            },
            {
                name: 'El faro viejo',
                type: 'ruins',
                description: 'Una torre de piedra sobre las rocas, con la puerta arrancada y un farol encendido arriba.',
                treasure: ['Catalejo del farero'],
            },
        ],
        npcs: [
            {
                name: 'Marta Salmuera',
                id: 'marta',
                trade: 'Posadera',
                gender: 'Mujer',
                where: 'Punta Gris',
                service: 'posada',
                wants: 'Que vuelva la luz antes de que se hunda otra barca.',
                knows: 'Que las barcas se hunden justo donde antes no había rocas que temer.',
                voice: 'Directa y con guasa, hasta cuando está preocupada.',
                aspecto: 'Mujer de unos cincuenta, ancha de hombros, pelo gris recogido, delantal de cuero y una quemadura vieja en el antebrazo.',
            },
            {
                name: 'Ezequiel Rocamar',
                id: 'ezequiel',
                trade: 'Farero',
                gender: 'Hombre',
                where: 'Punta Gris',
                wants: 'Volver a su faro.',
                knows: 'Que uno de los que le echaron lleva un ancla rota tatuada en el cuello.',
                secret: 'Les dejó la llave sin pelear, y no se lo perdona.',
                voice: 'Frases cortas. Cuenta los peldaños y las barcas.',
                aspecto: 'Anciano flaco de barba blanca, gorra de lana azul, abrigo encerado y un farol apagado colgando del cinturón.',
            },
        ],
        confidants: [
            {
                name: 'Lía Remos',
                id: 'lia',
                gender: 'Mujer',
                className: 'Pícaro',
                description: 'Hija de pescadores. Conoce cada roca de la punta, y una de las barcas hundidas era de su tío.',
                aspecto: 'Joven morena de pelo corto y rizado, chaleco de cuero gastado, una cuerda al hombro y un cuchillo de pescador al cinto.',
                arrivals: [{ place: 'El faro viejo', line: 'Aquí subía de cría a ver entrar las barcas. Nunca lo había visto a oscuras.' }],
            },
        ],
        quests: [
            {
                id: 'faro',
                name: 'Las luces del faro',
                act: 1,
                locationName: 'El faro viejo',
                description: 'Unos contrabandistas encienden un farol en la torre vieja para que las barcas se estrellen.',
                enemies: ['Bandido', 'Bandido', 'Arquero'],
                objectives: [{ type: 'eliminate_all', label: 'Echar a los contrabandistas del faro' }],
            },
        ],
        dialogues: [
            {
                id: 'ezequiel-faro',
                speaker: 'Ezequiel Rocamar',
                start: 'inicio',
                nodes: [
                    {
                        id: 'inicio',
                        mood: 'neutral',
                        line: 'La escalera del faro tiene ciento doce peldaños. Los he contado cada noche durante treinta años.',
                        again: [{ if: { milestone: 'faro' }, text: 'Habéis vuelto a encender mi faro. Pasad cuando queráis.' }, '¿Otra vez por aquí? Sentaos.'],
                        more: ['¿Algo más?', 'Tú dirás.'],
                        options: [
                            { id: 'quienes', text: '¿Quiénes eran los de las ballestas?', next: 'quienes' },
                            {
                                id: 'rezar', text: '¿Quieres que recemos por los ahogados?', if: { class: 'Clérigo' },
                                effects: [{ attitude: 1 }], reply: { text: 'Sí. Por los dos. Se llamaban Tano y Rufo.', mood: 'triste' },
                            },
                            { id: 'adios', text: 'Nos vamos al faro.', end: true, repeat: true, reply: { text: 'Cuidado con el peldaño noventa: está suelto.' } },
                        ],
                    },
                    {
                        id: 'quienes',
                        mood: 'enfadado',
                        line: 'Gente de fuera. Uno llevaba un ancla rota tatuada en el cuello.',
                        journal: 'Uno de los contrabandistas lleva un ancla rota tatuada en el cuello.',
                        options: [{ id: 'gracias', text: 'Gracias.', next: 'inicio', reply: { text: 'Dádmelas cuando vuelva la luz.' } }],
                    },
                ],
            },
        ],
        plot: {
            milestones: [
                {
                    id: 'llegada',
                    title: 'Un pueblo a oscuras',
                    hint: 'Escucha a la gente de Punta Gris y sube al faro viejo.',
                    scene: 'En la posada de Punta Gris os cuentan que el faro lleva tres noches apagado y que alguien encendió otra luz en la torre vieja.',
                    opens: { kind: 'start' },
                    asks: { kind: 'none' },
                    backdrop: 'posada',
                    beats: [
                        { text: 'Llegáis a Punta Gris al caer la tarde. El faro de la punta está apagado.' },
                        { who: 'Marta Salmuera', mood: 'triste', text: '¿Venís por lo del faro? Pasad, que fuera hace frío. Soy Marta, llevo la posada.' },
                        {
                            who: 'Marta Salmuera',
                            text: 'Tres noches sin luz, y ya se nos han hundido dos barcas.',
                            alt: [{ if: { class: 'Clérigo' }, text: 'Tres noches sin luz, y dos barcas hundidas. Si rezáis por alguien, rezad por los de esas barcas.' }],
                        },
                        { who: 'Ezequiel Rocamar', mood: 'enfadado', text: 'No me echaron: me dejé echar. Eran cinco, con ballestas.' },
                        { who: 'Marta Salmuera', text: 'Este es Ezequiel, el farero. Lleva treinta años subiendo esa escalera.', presenta: 'ezequiel' },
                        {
                            who: 'Ezequiel Rocamar',
                            mood: 'triste',
                            text: 'Encienden su farol en la torre vieja. Las barcas van hacia esa luz y se rompen contra las rocas.',
                            options: [
                                {
                                    id: 'ayudar', text: 'Subiremos al faro. Nadie más se va a hundir.', effects: [{ attitude: 1 }],
                                    reply: { who: 'Ezequiel Rocamar', mood: 'alegre', text: 'Gracias. Que la escalera os sea leve.' },
                                },
                                {
                                    id: 'pagar', text: '¿Y quién paga el trabajo?', effects: [{ gold: 20 }, { attitude: -1 }],
                                    reply: { who: 'Marta Salmuera', mood: 'enfadado', text: 'La Cofradía. Veinte monedas, y ni una pregunta más.' },
                                },
                            ],
                        },
                        { who: 'Lía Remos', mood: 'alegre', text: 'Me llamo Lía. Conozco cada roca de la punta: si subís, voy con vosotros.' },
                    ],
                },
                {
                    id: 'faro',
                    quest: 'faro',
                    backdrop: 'El faro viejo',
                    beats: [
                        { text: 'El camino de la punta sube entre rocas mojadas.' },
                        {
                            who: 'Lía Remos',
                            text: 'Arriba hay luz, pero no es la del faro: es un farol, y se mueve.',
                            alt: [{ if: { chose: 'pagar' }, mood: 'enfadado', text: 'Ya que cobráis de la Cofradía, haced el trabajo bien: arriba hay un farol, y se mueve.' }],
                        },
                        { who: 'Lía Remos', mood: 'enfadado', text: 'Contrabandistas. Encienden su farol y esperan a que las barcas se rompan.' },
                    ],
                    ending: 'luz',
                },
            ],
            endings: {
                luz: {
                    title: 'La luz de Punta Gris',
                    scene: 'Esa noche el faro vuelve a encenderse, y las barcas entran en el puerto una detrás de otra.',
                    epilogues: [
                        { who: 'Ezequiel Rocamar', text: 'Ezequiel vuelve a subir los ciento doce peldaños cada noche, y ahora silba al llegar arriba.' },
                        { who: 'Marta Salmuera', text: 'Marta invita a la primera ronda a quien entre por la puerta con la luz encendida.' },
                        { who: 'La Cofradía de pescadores', text: 'La Cofradía os guarda sitio en su mesa: en Punta Gris ya no sois de fuera.' },
                    ],
                },
            },
        },
    };
}

/**
 * Un compañero con todo: su aspecto, su romance (tres citas, la noche y su epílogo) y su misión
 * personal (un viaje, una conversación con una decisión, una pelea y sus dos finales). Para el
 * anexo: se pega en `confidants` en lugar de la Lía de la muestra corta.
 *
 * @returns {any}
 */
export function buildCompanionSample() {
    const date = (/** @type {number} */ step, /** @type {string} */ title, /** @type {string} */ where, /** @type {any[]} */ beats) => ({ kind: 'cita', step, title, where, beats });
    return {
        name: 'Lía Remos',
        id: 'lia',
        gender: 'Mujer',
        className: 'Pícaro',
        description: 'Hija de pescadores. Conoce cada roca de la punta, y una de las barcas hundidas era de su tío.',
        aspecto: 'Joven morena de pelo corto y rizado, chaleco de cuero gastado, una cuerda al hombro y un cuchillo de pescador al cinto.',
        scenes: [{
            rank: 2,
            title: 'Las rocas de la punta',
            where: 'muelle',
            beats: [
                { note: 'Lía lanza piedras al agua desde el muelle, una detrás de otra.', say: 'Mi tío decía que cada roca de la punta tiene nombre. Me los sé todos.', mood: 'triste' },
                {
                    say: '¿Tú tienes algún sitio así? ¿Uno que te sepas de memoria?',
                    replies: [
                        { text: 'Le hablas del sitio donde creciste.', bond: 1, then: 'Pues algún día me llevas. Y yo te enseño mis rocas.', mood: 'alegre' },
                        { text: 'Le dices que tú no eres de ningún sitio.', bond: 0, then: 'Eso tiene arreglo. Quédate un tiempo en Punta Gris.' },
                    ],
                },
            ],
        }],
        romance: {
            with: 'todos',
            no: 'Lía se ríe, pero con cariño. «Tú y yo somos de las que se cubren las espaldas. Con eso me basta.»',
            escenas: [
                date(1, 'Las redes', 'muelle', [{
                    note: 'Lía remienda una red sentada en el muelle, con los pies colgando sobre el agua.',
                    say: 'Si me ayudas con esto, te enseño el mejor sitio para ver entrar las barcas.',
                    mood: 'alegre',
                    replies: [
                        { text: 'Te sientas a su lado y coges la aguja.', bond: 1, romance: 'avanza', then: 'Lo haces fatal. Me encanta.', mood: 'alegre' },
                        { text: 'Le dices que tienes prisa.', bond: 0, then: 'Otro día, entonces.' },
                    ],
                }]),
                date(2, 'La tormenta', 'posada', [{
                    note: 'Llueve sobre Punta Gris. Lía te espera junto al fuego de la posada, con dos tazas.',
                    say: 'Mi tío decía que con tormenta solo salen los tontos y los enamorados. Él era de los tontos.',
                    replies: [
                        { text: 'Le preguntas de qué eres tú.', bond: 1, romance: 'avanza', then: 'Eso lo tendrás que averiguar.', mood: 'alegre' },
                        { text: 'Le hablas del tiempo.', bond: 0, then: 'Ya. El tiempo.' },
                    ],
                }]),
                date(3, 'La punta', 'muelle', [{
                    note: 'Al atardecer, Lía te lleva a la roca más alta de la punta.',
                    say: 'Aquí no sube nadie más. Quería que lo vieras conmigo.',
                    mood: 'alegre',
                    replies: [
                        { text: 'Le coges la mano.', bond: 1, romance: 'avanza', then: 'Lía no te la suelta en todo el atardecer.', mood: 'alegre' },
                        { text: 'Le dices que la quieres como amiga.', bond: 0, romance: 'amigos', then: 'Me lo imaginaba. Amigas, entonces. De las buenas.', mood: 'triste' },
                    ],
                }]),
                {
                    kind: 'final',
                    title: 'La noche del faro',
                    where: 'posada',
                    beats: [{
                        note: 'Ya es de noche. Desde la ventana se ve girar la luz del faro.',
                        say: 'Quédate esta noche.',
                        mood: 'alegre',
                        replies: [
                            { text: 'Te quedas.', bond: 1, romance: 'avanza', then: 'Lía apaga la vela.', fade: true },
                            { text: 'Le das un beso en la frente y te vas a dormir.', bond: 0, then: 'Otra noche, entonces.' },
                        ],
                    }],
                },
                { kind: 'pareja', lines: ['Lía te ha guardado el mejor sitio junto al fuego.', 'Lía lleva tu pañuelo atado a la muñeca.'] },
                {
                    kind: 'epilogo',
                    home: 'Lía vuelve contigo al gremio después de «{ending}». Dice que el mar de Puerto Alba es más feo, pero que se acostumbra.',
                    away: 'Lía se quedó contigo en Punta Gris después de «{ending}». Cada noche subís a ver girar la luz del faro.',
                    hall: '{heroe} y Lía Remos, {juntos|juntas} desde el día {day}.',
                },
            ],
        },
        misionPersonal: {
            title: 'La barca de mi tío',
            where: 'Cala Negra, un día al sur',
            pitch: 'La barca del tío de Lía no se hundió: alguien la vio entera en Cala Negra, con otro nombre pintado. Lía quiere saber quién la tiene.',
            endings: [
                { id: 'perdonar', title: 'Dejarlo estar', summary: 'Lía deja la barca a quien la encontró. Vuelve callada, pero en paz.' },
                { id: 'recuperar', title: 'Recuperar la barca', summary: 'La barca vuelve a Punta Gris con su nombre de siempre. Lía la pinta ella misma.' },
            ],
            start: 'ida',
            steps: [
                { id: 'ida', kind: 'viaje', to: 'Cala Negra', days: 1, text: 'Un día de camino por la costa hasta Cala Negra.', next: 'cala' },
                {
                    id: 'cala',
                    kind: 'escena',
                    title: 'Cala Negra',
                    backdrop: 'muelle',
                    beats: [
                        { text: 'En la cala hay una barca recién pintada.' },
                        { who: 'Lía Remos', mood: 'enfadado', text: 'Es la de mi tío. Le han tapado el nombre, pero la proa es la misma.' },
                        {
                            who: 'Lía Remos',
                            mood: 'triste',
                            text: 'Ahí viene el que la tiene. ¿Qué hacemos?',
                            options: [
                                { id: 'hablar', text: 'Hablamos con él.', check: { skill: 'persuasion', dc: 12, success: { reply: { who: 'Lía Remos', mood: 'alegre', text: 'Dice que la encontró a la deriva. Me la devuelve.' } }, failure: { reply: { who: 'Lía Remos', mood: 'enfadado', text: 'No quiere saber nada. Llama a sus amigos.' } } } },
                                { id: 'dejar', text: 'Déjalo estar, Lía.', reply: { who: 'Lía Remos', mood: 'triste', text: 'Tienes razón. Mi tío ya no la va a usar.' } },
                            ],
                        },
                    ],
                    routes: { hablar: { bien: 'fin-recuperar', mal: 'pelea' }, dejar: 'fin-perdonar' },
                    next: 'fin-perdonar',
                },
                {
                    id: 'pelea',
                    kind: 'tablero',
                    text: 'Los amigos del barquero no quieren devolver nada.',
                    board: {
                        id: 'cala_negra',
                        name: 'Cala Negra',
                        locationName: 'Cala Negra',
                        map: ['############', '#....c.....#', '#..........#', '#..c....c..#', '#..........#', '############'],
                        partyStart: [{ x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }],
                        enemies: [{ name: 'Barquero de la cala', x: 9, y: 1 }, { name: 'Barquero de la cala', x: 10, y: 2 }],
                    },
                    bestiary: [{ name: 'Barquero de la cala', hp: 9, armorClass: 11, cr: 0.125, profile: 'aggressive', attackRangeFeet: 5, description: 'Un pescador con un bichero.' }],
                    win: 'fin-recuperar',
                    lose: 'fin-perdonar',
                    flee: 'fin-perdonar',
                },
                { id: 'fin-recuperar', kind: 'final', ending: 'recuperar', back: 1, effects: { bonds: 2, flags: ['barca-recuperada'], memory: 'Recuperasteis la barca del tío de Lía en Cala Negra.' } },
                { id: 'fin-perdonar', kind: 'final', ending: 'perdonar', back: 1, effects: { bonds: 1, memory: 'Acompañaste a Lía a Cala Negra, y la ayudaste a dejarlo estar.' } },
            ],
        },
    };
}
