/**
 * J15.1: `party.js` partido en `party/`, sin que nadie de fuera lo note.
 *
 * `party.js` queda de fachada: reexporta, nombre a nombre, lo que vive en `party/*.js`. Estas
 * pruebas cuidan las cuatro cosas que se rompen al partir un archivo así sin darse cuenta:
 *
 *   (a) que la fachada siga dando todo lo que importan `script.js`, `campaigns.js`, el gestor
 *       de contexto, `world-info.js` y las herramientas de `tools/` (las pruebas del navegador);
 *   (b) que ningún módulo de `party/` importe la fachada (sería un ciclo con ella, y un módulo
 *       a medio evaluar);
 *   (c) que el control de tipos (`tools/check-fork-types.mjs`) mire todos los de `party/`;
 *   (d) que ninguno haga nada al importarse: los módulos se importan unos a otros en círculo, y
 *       eso solo es seguro si en el nivel superior no se lee nada importado.
 */

import fs from 'node:fs';
import { createRequire } from 'node:module';
import { describe, test, expect } from '@jest/globals';

const require = createRequire(new URL('../package.json', import.meta.url));
const acorn = require('acorn');
const eslintScope = require('eslint-scope');

const read = (/** @type {string} */ path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const PARTY_DIR = new URL('../public/scripts/party/', import.meta.url);
const partyFiles = () => fs.readdirSync(PARTY_DIR).filter(f => f.endsWith('.js')).sort();

/** @param {string} text */
const parseModule = (text) => acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module', ranges: true, locations: true });

/** Lo que exporta la fachada, sea con declaraciones o reexportando. */
function facadeExports() {
    const names = new Set();
    for (const st of parseModule(read('../public/scripts/party.js')).body) {
        if (st.type !== 'ExportNamedDeclaration') continue;
        for (const sp of st.specifiers) names.add(sp.exported.name);
        const d = st.declaration;
        if (d?.type === 'FunctionDeclaration' || d?.type === 'ClassDeclaration') names.add(d.id.name);
        if (d?.type === 'VariableDeclaration') for (const decl of d.declarations) names.add(decl.id.name);
    }
    return names;
}

/** `a, b as c` -> [a, b] */
const specNames = (/** @type {string} */ list) => list.split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);

/**
 * Los nombres que un archivo toma de `party.js`, de las cuatro maneras en que se toman.
 * @param {string} text
 */
function namesUsedFromParty(text) {
    const names = new Set();
    const PARTY = String.raw`['"][^'"]*/party\.js['"]`;
    for (const m of text.matchAll(new RegExp(String.raw`import\s*\{([^}]*)\}\s*from\s*${PARTY}`, 'g'))) specNames(m[1]).forEach(n => names.add(n));
    for (const m of text.matchAll(new RegExp(String.raw`\{([^{}]*)\}\s*=\s*await\s+import\(\s*${PARTY}\s*\)`, 'g'))) specNames(m[1]).forEach(n => names.add(n));
    for (const m of text.matchAll(new RegExp(String.raw`\(await\s+import\(\s*${PARTY}\s*\)\)\.(\w+)`, 'g'))) names.add(m[1]);
    // `const party = await import('/scripts/party.js'); ... party.algo(...)`, dentro de su bloque.
    for (const m of text.matchAll(new RegExp(String.raw`(?:const|let)\s+(\w+)\s*=\s*await\s+import\(\s*${PARTY}\s*\)\s*;`, 'g'))) {
        const start = (m.index ?? 0) + m[0].length;
        let depth = 0;
        let end = text.length;
        for (let i = start; i < text.length; i++) {
            if (text[i] === '{') depth++;
            if (text[i] === '}' && --depth < 0) { end = i; break; }
        }
        for (const use of text.slice(start, end).matchAll(new RegExp(String.raw`\b${m[1]}\.(\w+)`, 'g'))) names.add(use[1]);
    }
    return names;
}

describe('J15.1: la fachada party.js', () => {
    test('(a) da todo lo que importan los de fuera y las pruebas del navegador', () => {
        const exported = facadeExports();
        const consumers = [
            '../public/script.js',
            '../public/scripts/campaigns.js',
            '../public/scripts/dynamic-context-manager.js',
            '../public/scripts/world-info.js',
            ...fs.readdirSync(new URL('../tools/', import.meta.url)).filter(f => f.endsWith('.mjs')).map(f => `../tools/${f}`),
        ];
        /** @type {string[]} */
        const missing = [];
        let used = 0;
        for (const file of consumers) {
            for (const name of namesUsedFromParty(read(file))) {
                used++;
                if (!exported.has(name)) missing.push(`${file.replace('../', '')}: ${name}`);
            }
        }
        expect(missing).toEqual([]);
        // Si esto baja a cero, las expresiones regulares han dejado de encontrar los imports.
        expect(used).toBeGreaterThan(30);
    });

    test('(b) ningún módulo de party/ importa la fachada', () => {
        const offenders = partyFiles().filter(f => /(?:from\s*|import\(\s*)['"]\.\.\/party\.js['"]/.test(read(`../public/scripts/party/${f}`)));
        expect(offenders).toEqual([]);
    });

    test('(c) el control de tipos mira todos los módulos de party/', () => {
        const checker = read('../tools/check-fork-types.mjs');
        const globbed = checker.includes('public/scripts/party/') && /readdirSync\(\s*PARTY_DIR\s*\)/.test(checker);
        const unlisted = partyFiles().filter(f => !globbed && !checker.includes(`'public/scripts/party/${f}'`));
        expect(unlisted).toEqual([]);
    });

    test('(d) ningún módulo de party/ hace nada al importarse', () => {
        /** Lo único que se deja: construir el estado de campaña y pedir el compendio. */
        const ALLOWED = new Set(['createCampaignState', 'getCompendium']);
        /** @type {string[]} */
        const problems = [];
        const files = [...partyFiles().map(f => `../public/scripts/party/${f}`), '../public/scripts/party.js'];
        for (const file of files) {
            const text = read(file);
            const ast = parseModule(text);
            for (const st of ast.body) {
                const ok = ['ImportDeclaration', 'ExportNamedDeclaration', 'FunctionDeclaration', 'ClassDeclaration', 'VariableDeclaration'].includes(st.type)
                    || (st.type === 'ExpressionStatement' && /^void getCompendium\(\)/.test(text.slice(st.start, st.end)));
                if (!ok) problems.push(`${file}:${st.loc.start.line} ${st.type}`);
            }
            const scopes = eslintScope.analyze(ast, { ecmaVersion: 2022, sourceType: 'module', fallback: 'iteration' });
            const moduleScope = scopes.globalScope.childScopes.find(s => s.type === 'module');
            for (const variable of moduleScope?.variables ?? []) {
                if (variable.defs[0]?.type !== 'ImportBinding' || ALLOWED.has(variable.name)) continue;
                for (const ref of variable.references) {
                    if (ref.from === moduleScope) problems.push(`${file}:${ref.identifier.loc.start.line} lee ${variable.name} al importarse`);
                }
            }
        }
        expect(problems).toEqual([]);
    });
});
