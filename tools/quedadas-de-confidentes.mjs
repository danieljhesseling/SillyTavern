#!/usr/bin/env node
/**
 * Las escenas de confidente de una campaña, pasadas a escenas de quedada (J14.5).
 *
 * Un paquete trae cinco escenas por confidente, cada una un párrafo. Para jugarlas como
 * quedadas hacen falta en pasos, con respuestas: eso vive en `public/compendio/quedadas.json`
 * (filas `kind: "escena"` con su `campaign`). Esta herramienta:
 *
 *   node tools/quedadas-de-confidentes.mjs strahd          # borrador de las que faltan, en JSON
 *   node tools/quedadas-de-confidentes.mjs strahd --todas  # borrador de todas
 *   node tools/quedadas-de-confidentes.mjs --check         # ¿están pasadas todas las de cada paquete?
 *
 * El borrador sale de `beatsFromProse` (lo mismo que hace el juego si una escena no está
 * escrita): el párrafo como lo que pasa, y la pregunta del final con tres respuestas de
 * siempre. Se pega en `quedadas.json` y se retoca a mano (o con el Gem): las respuestas buenas
 * son las que dicen algo de esa persona.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readMeetupRows, scenesFor } from '../public/scripts/game-engine/campaign/meetups.js';
import { keyOf } from '../public/scripts/game-engine/campaign/social.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (/** @type {string} */ path) => JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
const data = readMeetupRows(read('public/compendio/quedadas.json'));
const args = process.argv.slice(2);

/** Los paquetes con confidentes, por su id (`strahd`, `1387`). */
const packs = readdirSync(join(ROOT, 'public/mundos'))
    .filter(f => f.endsWith('.pack.json'))
    .map(f => ({ id: f.replace(/\.pack\.json$/, ''), pack: read(`public/mundos/${f}`) }))
    .filter(p => Array.isArray(p.pack.confidants) && p.pack.confidants.length > 0);

if (args.includes('--check')) {
    /** @type {string[]} */
    const missing = [];
    for (const { id, pack } of packs) {
        for (const person of pack.confidants) {
            for (const scene of person.scenes ?? []) {
                const written = data.scenes.find(s => s.key === keyOf(person.name) && s.rank === scene.rank && (!s.campaign || s.campaign === id));
                if (!written) missing.push(`${id}: ${person.name}, rango ${scene.rank} («${scene.title}») sin pasar`);
                else if (written.title !== scene.title) missing.push(`${id}: ${person.name}, rango ${scene.rank}: el paquete la llama «${scene.title}» y quedadas.json «${written.title}»`);
            }
        }
    }
    for (const line of missing) console.log(line);
    console.log(missing.length === 0 ? `OK: ${packs.map(p => p.id).join(', ')} con todas sus escenas de confidente pasadas.` : `${missing.length} por pasar.`);
    process.exit(missing.length === 0 ? 0 : 1);
}

const campaign = args.find(a => !a.startsWith('--'));
const found = packs.find(p => p.id === campaign);
if (!found) {
    console.log(`Uso: node tools/quedadas-de-confidentes.mjs <${packs.map(p => p.id).join('|')}> [--todas] | --check`);
    process.exit(2);
}

const all = args.includes('--todas');
const rows = found.pack.confidants.flatMap((/** @type {any} */ person) => scenesFor({
    person: { name: person.name, scenes: person.scenes },
    data: all ? { scenes: [] } : data,
    campaign: found.id,
})
    .filter(scene => scene.auto)
    .map(scene => ({
        id: scene.id,
        kind: 'escena',
        name: `${String(person.name).split(' ')[0]} · ${scene.title}`,
        who: scene.who,
        campaign: found.id,
        rank: scene.rank,
        title: scene.title,
        where: '',
        beats: scene.beats.map(beat => ({
            ...(beat.note ? { note: beat.note } : {}),
            ...(beat.say ? { say: beat.say } : {}),
            ...(beat.replies.length > 0 ? { replies: beat.replies.map(r => ({ text: r.text, bond: r.bond, ...(r.then ? { then: r.then } : {}) })) } : {}),
        })),
    })));

console.log(JSON.stringify(rows, null, 2));
console.error(`${rows.length} escenas en borrador de ${found.id}${all ? '' : ' (las que aún no están en quedadas.json)'}.`);
