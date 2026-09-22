import { describe, test, expect } from '@jest/globals';
import {
    MODES, DEFAULT_MODE, WANTS, TOO_HURT, readReasons, willJoin, formParty,
    readMode, canControl, describeMode,
} from '../public/scripts/game-engine/rules/companions.js';
import { applyInjury, INJURY_TABLE } from '../public/scripts/game-engine/rules/injuries.js';

const contract = (extra = {}) => ({
    id: 'c1', rank: 'C', kind: 'cull', title: 'Despejar el molino',
    reward: 60, patron: 'el concejo', locationName: 'El molino', ...extra,
});

const brand = (extra = {}) => ({
    id: 1, name: 'Brand', hp: 20, motive: 'coin', loyalty: 3,
    reasons: { wants: 'coin', profile: 'aggressive' }, ...extra,
});

const bruna = (extra = {}) => ({
    id: 2, name: 'Bruna', hp: 20, motive: 'bond', bondRank: 2,
    reasons: { wants: 'glory', hates: 'los Cuervos' }, ...extra,
});

/** Alguien con dos heridas encima, como sale de una mala semana. */
const battered = (member) => {
    let hurt = { ...member };
    for (const id of ['sprain', 'cracked_ribs']) {
        const patch = applyInjury(hurt, INJURY_TABLE.find(i => i.id === id));
        hurt = { ...hurt, ...patch.stats, injuries: patch.injuries, baseStats: patch.baseStats };
    }
    return hurt;
};

describe('las razones de alguien', () => {
    test('se leen de su ficha', () => {
        expect(readReasons(bruna()).wants).toBe('glory');
        expect(readReasons(bruna()).hates).toBe('los Cuervos');
    });

    // Una partida vieja no tiene ninguno de estos campos. Estrenar la regla con medio
    // grupo negandose a salir seria el peor debut posible.
    test('y lo que no esté escrito se rellena con lo más neutro, no con lo más dramático', () => {
        const blank = readReasons({});
        expect(blank.wants).toBe('coin');
        expect(blank.hates).toBe('');
        expect(blank.motive).toBe('bond');
        expect(willJoin({ name: 'Nadie', hp: 10 }, contract()).joins).toBe(true);
    });

    test('un deseo inventado no cuela', () => {
        expect(readReasons({ reasons: { wants: 'queso' } }).wants).toBe('coin');
    });
});

describe('quién acepta ir, y por qué', () => {
    // La regla entera de este nivel: un "no" que no se entiende es un error, no una
    // decision. Por eso nunca se devuelve un booleano a secas.
    test('siempre dice el motivo, también cuando es que sí', () => {
        const yes = willJoin(bruna(), contract({ kind: 'hunt' }));
        expect(yes.joins).toBe(true);
        expect(yes.reason).toMatch(/Bruna se apunta:/);

        const no = willJoin(brand({ loyalty: 1 }), contract());
        expect(no.joins).toBe(false);
        expect(no.reason.length).toBeGreaterThan(20);
    });

    test('quien busca sangre quiere limpiar; quien quiere tranquilidad, escoltar', () => {
        const brute = willJoin(brand({ reasons: { wants: 'blood' } }), contract({ kind: 'cull' }));
        expect(brute.eagerness).toBeGreaterThan(0);
        expect(brute.reason).toMatch(/sangre/);

        const calm = willJoin(brand({ reasons: { wants: 'quiet' } }), contract({ kind: 'escort' }));
        expect(calm.reason).toMatch(/tranquilidad/);
    });

    test('el odio manda: quien odia a los Cuervos va contra los Cuervos', () => {
        const personal = willJoin(bruna(), contract({ title: 'Acabar con los Cuervos del molino' }));
        expect(personal.reason).toMatch(/odia a los Cuervos/);
        expect(personal.eagerness).toBeGreaterThan(1);
    });

    test('un encargo demasiado grande echa para atrás, y se dice', () => {
        const scary = willJoin(brand({ reasons: { wants: 'quiet' } }), contract({ rank: 'S' }));
        expect(scary.joins).toBe(false);
        expect(scary.reason).toMatch(/demasiado grande/);
    });

    test('y quien busca gloria no se levanta por un recado', () => {
        const bored = willJoin(bruna(), contract({ rank: 'D', kind: 'escort' }));
        expect(bored.reason).toMatch(/poca cosa/);
    });
});

describe('lo que impide ir, diga lo que diga el resto', () => {
    test('estar roto', () => {
        const no = willJoin(battered(bruna()), contract({ kind: 'hunt', title: 'los Cuervos' }));
        expect(no.joins).toBe(false);
        expect(no.reason).toMatch(/heridas/);
    });

    test('estar caído', () => {
        expect(willJoin(bruna({ hp: 0 }), contract()).joins).toBe(false);
    });

    test('y llevar demasiado sin cobrar', () => {
        const no = willJoin(brand({ loyalty: 1 }), contract({ reward: 500 }));
        expect(no.joins).toBe(false);
        expect(no.reason).toMatch(/sin cobrar/);
    });

    // A quien va por un vinculo no se le paga, asi que la paga no puede retenerlo.
    test('pero a quien va por un vínculo la paga no le frena', () => {
        expect(willJoin(bruna({ loyalty: 0 }), contract({ kind: 'hunt' })).joins).toBe(true);
    });

    test('una herida sola todavía deja salir', () => {
        const patch = applyInjury(bruna(), INJURY_TABLE.find(i => i.id === 'sprain'));
        const limping = { ...bruna(), injuries: patch.injuries };
        expect(readReasons(limping)).toBeTruthy();
        expect(willJoin(limping, contract({ kind: 'hunt' })).joins).toBe(true);
        expect(TOO_HURT).toBe(2);
    });
});

describe('formar el grupo', () => {
    const roster = () => [brand(), bruna(), brand({ id: 3, name: 'Sela', loyalty: 1 })];

    test('van los que quieren y se quedan los que no, con su motivo cada uno', () => {
        const formed = formParty(roster(), contract({ kind: 'cull' }));
        expect(formed.going.map(m => m.name)).not.toContain('Sela');
        expect(formed.staying.map(m => m.name)).toContain('Sela');
        expect(formed.lines).toHaveLength(3);
    });

    test('los que más ganas tienen van primero', () => {
        const formed = formParty(roster(), contract({ title: 'los Cuervos', kind: 'hunt' }));
        expect(formed.going[0].name).toBe('Bruna');
    });

    test('y no van más de los que caben', () => {
        const formed = formParty(roster(), contract({ kind: 'cull' }), { max: 1 });
        expect(formed.going).toHaveLength(1);
        expect(formed.staying).toHaveLength(2);
    });

    test('una plantilla vacía no rompe nada', () => {
        expect(formParty(null, contract())).toEqual({ going: [], staying: [], lines: [] });
    });
});

describe('los modos', () => {
    test('una campaña que no dice nada se juega como hasta ahora', () => {
        expect(readMode(null)).toBe(DEFAULT_MODE);
        expect(DEFAULT_MODE).toBe(MODES.GROUP);
    });

    test('en grupo los mueves a todos', () => {
        const party = [brand(), bruna()];
        for (const member of party) {
            expect(canControl(member, party, { mode: MODES.GROUP }).allowed).toBe(true);
        }
    });

    test('en solo llevas al tuyo, que es el primero', () => {
        const party = [brand(), bruna()];
        expect(canControl(party[0], party, { mode: MODES.SOLO }).allowed).toBe(true);
    });

    // Si lo unico que cambia es que no puedes mover a Brand, es el mismo juego con menos
    // manos: lo que cambia es que Brand decide, y se dice.
    test('y los demás se llevan solos, dicho con sus palabras', () => {
        const party = [brand(), bruna()];
        const answer = canControl(party[1], party, { mode: MODES.SOLO });
        expect(answer.allowed).toBe(false);
        expect(answer.reason).toMatch(/se lleva solo/);
    });

    test('contado donde se elige', () => {
        expect(describeMode({ mode: MODES.SOLO })).toMatch(/los demás deciden/);
        expect(describeMode(null)).toBe('Los llevas a todos');
    });

    test('cada deseo sabe qué trabajos le tiran', () => {
        for (const want of Object.values(WANTS)) {
            expect(want.likes.length).toBeGreaterThan(0);
            expect(want.label.length).toBeGreaterThan(0);
        }
    });
});

describe('la copia de los valores por defecto', () => {
    // Igual que con `survival`: `default-ruleset.js` no puede importar codigo, asi que el
    // valor esta escrito dos veces y esta prueba impide que se separen en silencio.
    test('el paquete por defecto juega el mismo modo que el modulo', async () => {
        const { DEFAULT_RULESET } = await import('../public/scripts/game-engine/rules/default-ruleset.js');
        expect(DEFAULT_RULESET.companions.mode).toBe(DEFAULT_MODE);
    });
});
