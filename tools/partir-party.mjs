#!/usr/bin/env node
/**
 * J15.1: partir `party.js` en módulos. Herramienta de un solo uso: se borra al acabar J15.1.
 *
 * `party.js` pasó de veinte mil líneas. Moverlo a mano, función a función, es donde se
 * rompen las cosas: un import que se olvida, una variable que ahora es de otro módulo y se
 * sigue asignando. Esto lo hace con el árbol del código (acorn) y sus ámbitos (eslint-scope),
 * así que lo que se mueve sigue viendo exactamente los mismos nombres que antes.
 *
 * Qué hace con un grupo de nombres:
 *   1. Corta de `party/main.js` cada sentencia de nivel superior del grupo, con el comentario
 *      que tiene justo encima (los `@typedef` se quedan: se repiten donde hagan falta).
 *   2. La pega, en su orden, en `party/<módulo>.js`, con los imports que necesita: los mismos
 *      que tenía `main.js` (mismo especificador, mismo alias) y lo que siga en `main.js`.
 *   3. Arregla `main.js` (poda los imports que ya no usa e importa lo movido que sí usa), los
 *      hermanos que importaban de `./main.js` lo que se ha movido, y la fachada `party.js`.
 *   4. Falla si algo asignaría una variable importada: eso tiene que ir por `state.js`.
 *   5. Pasa `eslint --fix` por lo que ha tocado.
 *
 * Uso:
 *   node tools/partir-party.mjs --mover                 # paso 1: party.js -> party/main.js y la fachada
 *   node tools/partir-party.mjs --grupo <nombre> [--seco]
 *   node tools/partir-party.mjs --nombres a,b,c --a <modulo.js> [--seco]
 *   node tools/partir-party.mjs --flechas [--seco]      # los `const f = () =>` de main.js, como funciones
 *   node tools/partir-party.mjs --escritores            # quién asigna cada `let` de nivel superior
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, renameSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(join(ROOT, 'package.json'));
const acorn = require('acorn');
const eslintScope = require('eslint-scope');
const globals = require('globals');

const PARTY = join(ROOT, 'public', 'scripts', 'party');
const MAIN = join(PARTY, 'main.js');
const FACADE = join(ROOT, 'public', 'scripts', 'party.js');

const KNOWN_GLOBALS = new Set([
    ...Object.keys(globals.builtin), ...Object.keys(globals.browser), ...Object.keys(globals.jquery),
    ...Object.keys(globals.es2021), 'toastr', 'SillyTavern', 'globalThis', 'ePub', 'pdfjsLib', 'undefined',
]);

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1]; };
const DRY = flag('--seco');

// ---------------------------------------------------------------------------------------
// Texto: se trabaja en LF y se escribe con el final de línea que tenía el archivo.

function readText(path) {
    const raw = readFileSync(path, 'utf8');
    return { text: raw.replace(/\r\n/g, '\n'), crlf: raw.includes('\r\n') };
}

function writeText(path, text, crlf = true) {
    if (DRY) return;
    const tmp = `${path}.tmp-partir`;
    writeFileSync(tmp, crlf ? text.replace(/\n/g, '\r\n') : text);
    renameSync(tmp, path);
}

function fail(message) {
    console.error(`\n[partir-party] ${message}\n`);
    process.exit(1);
}

function parse(text, file = '') {
    const comments = [];
    try {
        const ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module', ranges: true, locations: true, onComment: comments });
        return { ast, comments };
    } catch (error) {
        fail(`no se puede leer ${file}: ${error.message}`);
    }
}

function patternNames(node) {
    if (!node) return [];
    if (node.type === 'Identifier') return [node.name];
    if (node.type === 'ObjectPattern') return node.properties.flatMap(p => patternNames(p.type === 'RestElement' ? p.argument : p.value));
    if (node.type === 'ArrayPattern') return node.elements.flatMap(e => patternNames(e));
    if (node.type === 'RestElement') return patternNames(node.argument);
    if (node.type === 'AssignmentPattern') return patternNames(node.left);
    return [];
}

function declaredNames(st) {
    const node = st.type === 'ExportNamedDeclaration' && st.declaration ? st.declaration : st;
    if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') return [node.id.name];
    if (node.type === 'VariableDeclaration') return node.declarations.flatMap(d => patternNames(d.id));
    return [];
}

/**
 * El trozo de texto de una sentencia: con los comentarios pegados encima (sin línea en blanco
 * de por medio, y sin los `@typedef`), el comentario de su misma línea y su salto de línea.
 */
function chunkRange(text, comments, st, prevEnd) {
    let start = st.start;
    const before = comments.filter(c => c.end <= st.start && c.start >= prevEnd);
    for (let i = before.length - 1; i >= 0; i--) {
        const c = before[i];
        if (!/^[ \t]*(\n[ \t]*)?$/.test(text.slice(c.end, start))) break;
        if (/@typedef\b/.test(c.value)) break;
        start = c.start;
    }
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    if (/^[ \t]*$/.test(text.slice(lineStart, start))) start = lineStart;
    let end = st.end;
    for (const c of comments) {
        if (c.start >= end && /^[ \t]*$/.test(text.slice(end, c.start))) end = c.end;
        else if (c.start >= end) break;
    }
    const nl = text.indexOf('\n', end);
    if (nl !== -1 && /^[ \t]*$/.test(text.slice(end, nl))) end = nl + 1;
    return [start, end];
}

/** Los nombres que aparecen dentro de las llaves de tipo de los comentarios JSDoc. */
function jsdocTypeNames(text) {
    const names = new Set();
    for (const block of text.match(/\/\*\*[\s\S]*?\*\//g) || []) {
        let depth = 0;
        let span = '';
        for (const ch of block) {
            if (ch === '{') { depth++; if (depth === 1) { span = ''; continue; } }
            if (ch === '}') { depth--; if (depth === 0) { collect(span); continue; } }
            if (depth > 0) span += ch;
        }
    }
    function collect(span) {
        const clean = span.replace(/'[^']*'|"[^"]*"|`[^`]*`/g, '""');
        for (const m of clean.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)/g)) names.add(m[2]);
    }
    return names;
}

/** Los `/** @typedef {...} Nombre *\/` de una sola línea, por nombre. */
function typedefLines(text) {
    const map = new Map();
    for (const m of text.matchAll(/^\/\*\* @typedef \{[^\n]*\} ([A-Za-z_$][\w$]*) \*\/$/gm)) map.set(m[1], m[0]);
    return map;
}

function statementKey(text, st, names) {
    if (names.length > 0) return names[0];
    if (st.type === 'ExpressionStatement' && text.slice(st.start, st.end).includes('getCompendium()')) return '@preload';
    return `@expr${st.loc.start.line}`;
}

/** Todo lo que hace falta saber de un módulo para moverle cosas. */
function analyse(text, file) {
    const { ast, comments } = parse(text, file);
    const sm = eslintScope.analyze(ast, { ecmaVersion: 2022, sourceType: 'module', fallback: 'iteration' });
    const modScope = sm.globalScope.childScopes.find(s => s.type === 'module');
    const imports = [];
    const importOf = new Map();
    const stmts = [];
    let prevEnd = 0;
    for (const st of ast.body) {
        if (st.type === 'ImportDeclaration') {
            imports.push(st);
            for (const sp of st.specifiers) {
                const imported = sp.type === 'ImportDefaultSpecifier' ? 'default' : sp.type === 'ImportNamespaceSpecifier' ? '*' : (sp.imported.name ?? sp.imported.value);
                importOf.set(sp.local.name, { source: st.source.value, imported, local: sp.local.name });
            }
            prevEnd = st.end;
            continue;
        }
        const [start, end] = chunkRange(text, comments, st, prevEnd);
        const node = st.type === 'ExportNamedDeclaration' && st.declaration ? st.declaration : st;
        const names = declaredNames(st);
        stmts.push({ st, node, names, key: statementKey(text, st, names), start, end, exported: node !== st });
        prevEnd = end;
    }
    const declOf = new Map();
    for (const s of stmts) for (const n of s.names) declOf.set(n, s);
    return { text, ast, comments, sm, modScope, imports, importOf, stmts, declOf, through: sm.globalScope.through };
}

function formatSpec(spec) {
    if (spec.imported === 'default') return spec.local;
    if (spec.imported === '*') return `* as ${spec.local}`;
    return spec.imported === spec.local ? spec.local : `${spec.imported} as ${spec.local}`;
}

function formatImport(source, specs) {
    const def = specs.filter(s => s.imported === 'default' || s.imported === '*');
    const named = specs.filter(s => s.imported !== 'default' && s.imported !== '*');
    const head = def.map(formatSpec);
    if (named.length === 0) return `import ${head.join(', ')} from '${source}';`;
    const parts = named.map(formatSpec);
    const lead = head.length ? `${head.join(', ')}, ` : '';
    const one = `import ${lead}{ ${parts.join(', ')} } from '${source}';`;
    if (one.length <= 120) return one;
    const lines = [];
    let line = '';
    for (const p of parts) {
        if (line && (`    ${line} ${p},`).length > 116) { lines.push(`    ${line.trim()}`); line = ''; }
        line += ` ${p},`;
    }
    if (line) lines.push(`    ${line.trim()}`);
    return `import ${lead}{\n${lines.join('\n')}\n} from '${source}';`;
}

function formatExportFrom(source, names) {
    const one = `export { ${names.join(', ')} } from '${source}';`;
    if (one.length <= 120) return one;
    const lines = [];
    let line = '';
    for (const n of names) {
        if (line && (`    ${line} ${n},`).length > 116) { lines.push(`    ${line.trim()}`); line = ''; }
        line += ` ${n},`;
    }
    if (line) lines.push(`    ${line.trim()}`);
    return `export {\n${lines.join('\n')}\n} from '${source}';`;
}

function lineBounds(text, start, end) {
    const s = text.lastIndexOf('\n', start - 1) + 1;
    let e = text.indexOf('\n', end);
    e = e === -1 ? text.length : e + 1;
    return [s, e];
}

function applyEdits(text, edits) {
    const sorted = [...edits].sort((a, b) => b.start - a.start || b.end - a.end);
    let out = text;
    let last = Infinity;
    for (const e of sorted) {
        if (e.end > last) fail(`dos cambios se pisan en ${e.start}-${e.end}`);
        out = out.slice(0, e.start) + e.text + out.slice(e.end);
        last = e.start;
    }
    return out;
}

const tidy = (text) => text.replace(/\n{4,}/g, '\n\n\n').replace(/\s*$/, '\n');

/** Añadir specs de import a un módulo: a su import de ese origen, o uno nuevo tras el último. */
function importEdits(A, source, addSpecs, removeLocals = new Set()) {
    const edits = [];
    const bySource = A.imports.filter(i => i.source.value === source);
    let added = false;
    for (const imp of A.imports) {
        const specs = imp.specifiers.map(sp => A.importOf.get(sp.local.name));
        let keep = specs.filter(s => !removeLocals.has(s.local));
        if (imp === bySource[0] && addSpecs.length) {
            for (const s of addSpecs) if (!keep.some(k => k.local === s.local)) keep.push(s);
            added = true;
        }
        if (keep.length === specs.length && !(imp === bySource[0] && addSpecs.length)) continue;
        if (keep.length === 0) {
            const [s, e] = lineBounds(A.text, imp.start, imp.end);
            edits.push({ start: s, end: e, text: '' });
        } else {
            edits.push({ start: imp.start, end: imp.end, text: formatImport(imp.source.value, keep) });
        }
    }
    if (!added && addSpecs.length) {
        const lastImp = A.imports[A.imports.length - 1];
        if (lastImp) {
            edits.push({ start: lastImp.end, end: lastImp.end, text: `\n${formatImport(source, addSpecs)}` });
        } else {
            // Sin imports: tras el comentario de cabecera.
            const first = A.ast.body[0];
            const at = first ? A.stmts[0]?.start ?? first.start : A.text.length;
            edits.push({ start: at, end: at, text: `${formatImport(source, addSpecs)}\n\n` });
        }
    }
    return edits;
}

// ---------------------------------------------------------------------------------------
// Los grupos de J15.1. Las claves (`*_KEY`, `*_STORAGE`) se reconocen por el nombre.

const GRUPOS = {};

function grupo(nombre, archivo, descripcion, nombres) {
    GRUPOS[nombre] = { archivo, descripcion, nombres: nombres.split(/\s+/).filter(Boolean) };
}

// (Los grupos se añaden paso a paso, más abajo, en `definirGrupos`.)

// ---------------------------------------------------------------------------------------

function header(descripcion) {
    const body = descripcion.trim().split('\n').map(l => (l.trim() ? ` * ${l.trim()}` : ' *')).join('\n');
    return `/**\n${body}\n *\n * Salió de \`party.js\` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada \`party.js\` sigue\n * exportando lo de siempre; lo que se comparte entre módulos vive en \`state.js\` y las claves\n * de los metadatos, en \`keys.js\`.\n */`;
}

/** El tipo de una variable para su setter: el `@type` de su comentario, o el de su valor inicial. */
function setterType(A, s) {
    const doc = A.text.slice(s.start, s.st.start);
    const at = doc.indexOf('@type {');
    if (at !== -1) {
        let depth = 0;
        for (let i = at + 6; i < doc.length; i++) {
            if (doc[i] === '{') depth++;
            if (doc[i] === '}') { depth--; if (depth === 0) return doc.slice(at + 7, i); }
        }
    }
    const init = s.node.declarations?.[0]?.init;
    if (init?.type === 'Literal') {
        if (typeof init.value === 'string') return 'string';
        if (typeof init.value === 'number') return 'number';
        if (typeof init.value === 'boolean') return 'boolean';
    }
    return 'any';
}

const setterName = (name) => `set${name[0].toUpperCase()}${name.slice(1)}`;

function isSimple(node) {
    return ['Identifier', 'Literal', 'MemberExpression', 'CallExpression', 'TemplateLiteral', 'ThisExpression'].includes(node.type);
}

/** Un mapa hijo -> padre del árbol entero. */
function parents(ast) {
    const map = new Map();
    const walk = (node, parent) => {
        if (!node || typeof node.type !== 'string') return;
        map.set(node, parent);
        for (const key of Object.keys(node)) {
            if (key === 'loc' || key === 'range') continue;
            const value = node[key];
            if (Array.isArray(value)) value.forEach(v => walk(v, node));
            else if (value && typeof value.type === 'string') walk(value, node);
        }
    };
    walk(ast, null);
    return map;
}

/**
 * Mover un grupo de nombres de main.js a `party/<target>`.
 *
 * @param {Set<string>} names
 * @param {string} target
 * @param {string} descripcion
 * @param {{setters?: boolean}} [options]
 */
function move(names, target, descripcion, options = {}) {
    const mainFile = readText(MAIN);
    const A = analyse(mainFile.text, MAIN);
    const text = A.text;

    const missing = [...names].filter(n => !A.stmts.some(s => s.key === n || s.names.includes(n)));
    if (missing.length) fail(`no están en main.js: ${missing.join(', ')}`);
    for (const s of A.stmts) {
        if (s.names.some(n => names.has(n)) && !s.names.every(n => names.has(n))) fail(`la sentencia de ${s.names.join(', ')} se partiría`);
    }
    const moving = A.stmts.filter(s => names.has(s.key) || (s.names.length && s.names.every(n => names.has(n))));
    const movedNames = new Set(moving.flatMap(s => s.names));
    const inMoving = (pos) => moving.some(s => s.start <= pos && pos < s.end);

    const errors = [];
    /** @type {Map<string, any>} */
    const needImports = new Map();
    const needFromMain = new Set();
    const mainNeedsFromTarget = new Set();
    const writeRefs = [];

    for (const v of A.modScope.variables) {
        const def = v.defs[0];
        const isImport = def.type === 'ImportBinding';
        const isMoved = movedNames.has(v.name);
        for (const ref of v.references) {
            if (ref.init) continue;
            const pos = ref.identifier.range[0];
            if (inMoving(pos)) {
                if (isImport) {
                    needImports.set(v.name, A.importOf.get(v.name));
                    if (ref.isWrite()) errors.push(`lo movido asigna el import ${v.name}`);
                } else if (!isMoved) {
                    needFromMain.add(v.name);
                    if (ref.isWrite()) errors.push(`lo movido asigna ${v.name}, que se queda en main.js (línea ${ref.identifier.loc.start.line})`);
                }
            } else if (isMoved) {
                mainNeedsFromTarget.add(v.name);
                if (ref.isWrite()) {
                    if (options.setters) writeRefs.push(ref);
                    else errors.push(`main.js asigna ${v.name}, que se va a ${target} (línea ${ref.identifier.loc.start.line})`);
                }
            }
        }
    }
    for (const ref of A.through) {
        if (inMoving(ref.identifier.range[0]) && !KNOWN_GLOBALS.has(ref.identifier.name)) {
            errors.push(`nombre desconocido en lo movido: ${ref.identifier.name} (línea ${ref.identifier.loc.start.line})`);
        }
    }

    const movedText = moving.map(s => text.slice(s.start, s.end)).join('\n');
    let remainingText = text;
    for (const s of [...moving].reverse()) remainingText = remainingText.slice(0, s.start) + remainingText.slice(s.end);
    for (const n of jsdocTypeNames(movedText)) {
        if (A.importOf.has(n)) needImports.set(n, A.importOf.get(n));
        else if (A.declOf.has(n) && !movedNames.has(n)) needFromMain.add(n);
    }
    const remainingTypeNames = jsdocTypeNames(remainingText.replace(/^import[\s\S]*?;$/gm, ''));
    for (const n of remainingTypeNames) if (movedNames.has(n)) mainNeedsFromTarget.add(n);

    // Setters: cada escritura de main.js, por su función.
    const setterEdits = [];
    const settersUsed = new Set();
    if (options.setters && writeRefs.length) {
        const parentOf = parents(A.ast);
        for (const ref of writeRefs) {
            const id = ref.identifier;
            const p = parentOf.get(id);
            const gp = parentOf.get(p);
            const name = id.name;
            const setter = setterName(name);
            const where = `${name}, línea ${id.loc.start.line}`;
            const statementLike = gp?.type === 'ExpressionStatement';
            if (p.type === 'AssignmentExpression' && p.left === id) {
                if (!statementLike) { errors.push(`asignación usada como valor: ${where}`); continue; }
                const right = text.slice(p.right.start, p.right.end);
                if (['||=', '&&=', '??='].includes(p.operator)) {
                    errors.push(`asignación lógica: ${where}`);
                    continue;
                }
                const value = p.operator === '='
                    ? right
                    : `${name} ${p.operator.slice(0, -1)} ${isSimple(p.right) ? right : `(${right})`}`;
                setterEdits.push({ start: p.start, end: p.end, text: `${setter}(${value})` });
            } else if (p.type === 'UpdateExpression') {
                if (!statementLike) { errors.push(`++/-- usado como valor: ${where}`); continue; }
                setterEdits.push({ start: p.start, end: p.end, text: `${setter}(${name} ${p.operator[0]} 1)` });
            } else {
                errors.push(`escritura que no sé reescribir: ${where} (${p.type})`);
                continue;
            }
            settersUsed.add(setter);
        }
    }

    if (errors.length) fail(`no se puede mover a ${target}:\n  ${[...new Set(errors)].join('\n  ')}`);

    // --- el módulo de destino -----------------------------------------------------------
    const targetPath = join(PARTY, target);
    const exists = existsSync(targetPath);
    let T = null;
    let targetHeader = header(descripcion);
    let targetBody = '';
    const targetImports = new Map();
    if (exists) {
        T = analyse(readText(targetPath).text, targetPath);
        const firstImport = T.imports[0];
        const lastImport = T.imports[T.imports.length - 1];
        const headEnd = firstImport ? firstImport.start : (T.stmts[0]?.start ?? T.text.length);
        targetHeader = T.text.slice(0, headEnd).trim();
        targetBody = T.text.slice(lastImport ? lastImport.end : headEnd).trim();
        for (const imp of T.imports) for (const sp of imp.specifiers) targetImports.set(sp.local.name, T.importOf.get(sp.local.name));
    }
    const targetDecls = new Set([...(T?.declOf.keys() ?? []), ...movedNames]);
    // Lo que el destino exporta: lo que usan main.js, los hermanos y la fachada.
    const siblingFiles = readdirSync(PARTY).filter(f => f.endsWith('.js') && f !== 'main.js' && f !== target);
    const facade = readText(FACADE);
    const facadeAst = parse(facade.text, FACADE).ast;
    const facadeNames = new Set();
    for (const st of facadeAst.body) {
        if (st.type === 'ExportNamedDeclaration' && st.source?.value === './party/main.js') for (const sp of st.specifiers) facadeNames.add(sp.local.name);
    }
    const siblingNeeds = new Set();
    const siblingData = [];
    for (const f of siblingFiles) {
        const path = join(PARTY, f);
        const S = analyse(readText(path).text, path);
        const hits = [];
        for (const imp of S.imports) {
            if (imp.source.value !== './main.js') continue;
            for (const sp of imp.specifiers) if (movedNames.has(sp.imported.name)) hits.push(sp.local.name);
        }
        if (hits.length) { siblingData.push({ f, path, S, hits }); for (const h of hits) siblingNeeds.add(S.importOf.get(h).imported); }
    }
    const mustExport = new Set([...mainNeedsFromTarget, ...[...movedNames].filter(n => facadeNames.has(n) || siblingNeeds.has(n))]);
    if (options.setters) for (const n of movedNames) mustExport.add(n);

    const chunks = [];
    for (let i = 0; i < moving.length; i++) {
        const s = moving[i];
        let chunk = text.slice(s.start, s.end);
        if (!s.exported && s.names.some(n => mustExport.has(n))) {
            const at = s.st.start - s.start;
            chunk = `${chunk.slice(0, at)}export ${chunk.slice(at)}`;
        }
        if (options.setters && s.node.type === 'VariableDeclaration' && s.node.kind === 'let') {
            const name = s.names[0];
            chunk = `${chunk.replace(/\n?$/, '\n')}/** @param {${setterType(A, s)}} value */\nexport function ${setterName(name)}(value) { ${name} = value; }\n`;
        }
        const contiguous = i > 0 && moving[i - 1].end === s.start;
        chunks.push(i === 0 || contiguous ? chunk : `\n${chunk}`);
    }
    const movedBlock = chunks.join('').replace(/\s*$/, '');

    // Imports del destino.
    for (const [local, spec] of needImports) {
        const old = targetImports.get(local);
        if (old && (old.source !== spec.source || old.imported !== spec.imported)) fail(`${target} ya importa ${local} de otro sitio`);
        targetImports.set(local, spec);
    }
    for (const n of needFromMain) targetImports.set(n, { source: './main.js', imported: n, local: n });
    for (const local of [...targetImports.keys()]) {
        const spec = targetImports.get(local);
        if (targetDecls.has(local) || spec.source === `./${target}`) targetImports.delete(local);
    }
    const sourceOrder = [...new Set([...A.imports.map(i => i.source.value), ...[...targetImports.values()].map(s => s.source)])];
    const importBlock = sourceOrder
        .map(source => [source, [...targetImports.values()].filter(s => s.source === source)])
        .filter(([, specs]) => specs.length)
        .map(([source, specs]) => formatImport(source, specs))
        .join('\n');

    const typedefs = typedefLines(text);
    const neededTypedefs = [];
    const allTargetText = `${targetBody}\n${movedBlock}`;
    for (const [name, line] of typedefs) {
        if (!new RegExp(`\\b${name}\\b`).test(movedBlock)) continue;
        if (allTargetText.includes(`} ${name} */`)) continue;
        neededTypedefs.push(line);
    }
    const targetText = tidy([targetHeader, importBlock, neededTypedefs.join('\n'), targetBody, movedBlock].filter(Boolean).join('\n\n'));

    // --- main.js ------------------------------------------------------------------------
    const mainEdits = [];
    for (const s of moving) mainEdits.push({ start: s.start, end: s.end, text: '' });
    for (const n of needFromMain) {
        const s = A.declOf.get(n);
        if (!s.exported && !mainEdits.some(e => e.start === s.st.start && e.text === 'export ')) mainEdits.push({ start: s.st.start, end: s.st.start, text: 'export ' });
    }
    mainEdits.push(...setterEdits);
    const stillUsed = (local) => {
        const v = A.modScope.variables.find(x => x.name === local);
        return (v && v.references.some(r => !inMoving(r.identifier.range[0]))) || remainingTypeNames.has(local);
    };
    const removeLocals = new Set([...A.importOf.keys()].filter(local => !stillUsed(local)));
    const addToMain = [...mainNeedsFromTarget, ...settersUsed].sort().map(n => ({ source: `./${target}`, imported: n, local: n }));
    mainEdits.push(...importEdits(A, `./${target}`, addToMain, removeLocals));
    const mainText = tidy(applyEdits(text, mainEdits));

    // --- los hermanos -------------------------------------------------------------------
    const siblingWrites = [];
    for (const { path, S, hits } of siblingData) {
        const hitSet = new Set(hits);
        const add = hits.map(local => ({ ...S.importOf.get(local), source: `./${target}` }));
        const edits = [];
        // Quitar de `./main.js` y poner en `./target`.
        for (const imp of S.imports) {
            if (imp.source.value !== './main.js') continue;
            const keep = imp.specifiers.map(sp => S.importOf.get(sp.local.name)).filter(s => !hitSet.has(s.local));
            if (keep.length === imp.specifiers.length) continue;
            if (keep.length === 0) { const [a, b] = lineBounds(S.text, imp.start, imp.end); edits.push({ start: a, end: b, text: '' }); } else edits.push({ start: imp.start, end: imp.end, text: formatImport('./main.js', keep) });
        }
        const targetImp = S.imports.find(i => i.source.value === `./${target}`);
        if (targetImp) {
            const specs = targetImp.specifiers.map(sp => S.importOf.get(sp.local.name));
            for (const s of add) if (!specs.some(k => k.local === s.local)) specs.push(s);
            edits.push({ start: targetImp.start, end: targetImp.end, text: formatImport(`./${target}`, specs) });
        } else {
            const lastImp = S.imports[S.imports.length - 1];
            edits.push({ start: lastImp.end, end: lastImp.end, text: `\n${formatImport(`./${target}`, add)}` });
        }
        siblingWrites.push({ path, text: tidy(applyEdits(S.text, edits)) });
    }

    // --- la fachada ---------------------------------------------------------------------
    const facadeMoved = [...facadeNames].filter(n => movedNames.has(n));
    let facadeText = facade.text;
    if (facadeMoved.length) facadeText = rewriteFacade(facade.text, facadeAst, new Set(facadeMoved), `./party/${target}`);

    // --- informe y escritura --------------------------------------------------------------
    console.log(`${target}: ${moving.length} sentencias (${movedNames.size} nombres), ${targetText.split('\n').length} líneas`);
    console.log(`  imports del destino: ${targetImports.size} (${needFromMain.size} de main.js)`);
    console.log(`  main.js: -${removeLocals.size} imports, +${addToMain.length} de ./${target}, ${needFromMain.size} exports nuevos, ${setterEdits.length} escrituras por setter`);
    if (siblingData.length) console.log(`  hermanos: ${siblingData.map(s => s.f).join(', ')}`);
    if (facadeMoved.length) console.log(`  fachada: ${facadeMoved.join(', ')}`);
    if (DRY) { console.log('  (en seco: no se escribe nada)'); return []; }
    writeText(targetPath, targetText);
    writeText(MAIN, mainText, mainFile.crlf);
    for (const w of siblingWrites) writeText(w.path, w.text);
    if (facadeMoved.length) writeText(FACADE, facadeText, facade.crlf);
    return [targetPath, MAIN, ...siblingWrites.map(w => w.path), ...(facadeMoved.length ? [FACADE] : [])];
}

function rewriteFacade(text, ast, moved, newSource) {
    const blocks = [];
    let head = null;
    for (const st of ast.body) {
        if (st.type !== 'ExportNamedDeclaration' || !st.source) continue;
        if (head === null) head = text.slice(0, text.lastIndexOf('\n', st.start - 1) + 1);
        blocks.push({ source: st.source.value, names: st.specifiers.map(sp => sp.local.name) });
    }
    const main = blocks.find(b => b.source === './party/main.js');
    if (main) main.names = main.names.filter(n => !moved.has(n));
    let target = blocks.find(b => b.source === newSource);
    if (!target) { target = { source: newSource, names: [] }; blocks.push(target); }
    target.names.push(...moved);
    const body = blocks.filter(b => b.names.length).map(b => formatExportFrom(b.source, b.names)).join('\n');
    return tidy(`${head ?? ''}${body}`);
}

function eslintFix(files) {
    if (DRY || files.length === 0) return;
    const bin = join(ROOT, 'node_modules', 'eslint', 'bin', 'eslint.js');
    const result = spawnSync(process.execPath, [bin, '--fix', ...files], { cwd: ROOT, encoding: 'utf8' });
    const out = `${result.stdout || ''}${result.stderr || ''}`.trim();
    if (out) console.log(out);
    console.log(result.status === 0 ? '  eslint --fix: limpio' : '  eslint --fix: quedan errores (arriba)');
}

// ---------------------------------------------------------------------------------------
// Paso 1: party.js pasa a party/main.js y party.js queda de fachada.

function rewriteSpecifier(spec) {
    if (spec.startsWith('./party/')) return `./${spec.slice('./party/'.length)}`;
    if (spec.startsWith('./')) return `../${spec.slice(2)}`;
    if (spec.startsWith('../')) return `../${spec}`;
    return spec;
}

function moverPaso1() {
    if (existsSync(MAIN)) fail('party/main.js ya existe');
    const original = readText(FACADE);
    const text = original.text
        .replace(/(\bfrom\s+)(['"])(\.{1,2}\/[^'"]*)\2/g, (_, pre, q, spec) => `${pre}${q}${rewriteSpecifier(spec)}${q}`)
        .replace(/(\bimport\(\s*)(['"])(\.{1,2}\/[^'"]*)\2/g, (_, pre, q, spec) => `${pre}${q}${rewriteSpecifier(spec)}${q}`);
    const A = analyse(text, MAIN);
    const exported = A.stmts.filter(s => s.exported).flatMap(s => s.names);
    const facadeText = `/**
 * El panel del grupo y todo el juego que cuelga de él.
 *
 * Era un solo archivo de veintidós mil líneas; desde J15.1 (wiki/ROADMAP_SIN_CONEXION.md) vive
 * en \`party/\`, un módulo por cosa, y este archivo solo dice dónde está cada una. Quien lo
 * importaba (script.js, campaigns.js, las pruebas del navegador) lo sigue importando igual.
 */

${formatExportFrom('./party/main.js', exported)}
`;
    if (DRY) { console.log(`main.js: ${exported.length} exports`); return; }
    const r = spawnSync('git', ['mv', 'public/scripts/party.js', 'public/scripts/party/main.js'], { cwd: ROOT, encoding: 'utf8' });
    if (r.status !== 0) fail(`git mv: ${r.stderr}`);
    writeText(MAIN, text, original.crlf);
    writeText(FACADE, facadeText, original.crlf);
    console.log(`party/main.js: ${text.split('\n').length} líneas; la fachada exporta ${exported.length} nombres`);
}

// ---------------------------------------------------------------------------------------
// Las 14 flechas: `const f = () => ...` pasa a `function f() { ... }`.

function flechas() {
    const file = readText(MAIN);
    const A = analyse(file.text, MAIN);
    const edits = [];
    for (const s of A.stmts) {
        const node = s.node;
        if (node.type !== 'VariableDeclaration' || node.kind !== 'const' || node.declarations.length !== 1) continue;
        const d = node.declarations[0];
        if (d.init?.type !== 'ArrowFunctionExpression' || d.id.type !== 'Identifier') continue;
        const fn = d.init;
        const params = fn.params.length ? file.text.slice(fn.params[0].start, fn.params[fn.params.length - 1].end) : '';
        const body = fn.body.type === 'BlockStatement'
            ? file.text.slice(fn.body.start, fn.body.end)
            : `{\n    return ${file.text.slice(fn.body.start, fn.body.end)};\n}`;
        const prefix = s.exported ? 'export ' : '';
        edits.push({ start: s.st.start, end: s.st.end, text: `${prefix}${fn.async ? 'async ' : ''}function ${d.id.name}(${params}) ${body}` });
        console.log(`  ${d.id.name}`);
    }
    console.log(`${edits.length} flechas`);
    writeText(MAIN, applyEdits(file.text, edits), file.crlf);
    return [MAIN];
}

// ---------------------------------------------------------------------------------------
// Informe: quién asigna cada `let` de nivel superior, por módulo.

function escritores() {
    const files = readdirSync(PARTY).filter(f => f.endsWith('.js'));
    for (const f of files) {
        const path = join(PARTY, f);
        const A = analyse(readText(path).text, path);
        const owner = (pos) => A.stmts.find(s => s.start <= pos && pos < s.end);
        for (const v of A.modScope.variables) {
            const s = A.declOf.get(v.name);
            if (!s || s.node.kind !== 'let') continue;
            const writers = new Set(v.references.filter(r => r.isWrite() && !r.init).map(r => owner(r.identifier.range[0])?.key));
            console.log(`${f}\t${v.name}\t${[...writers].join(',')}`);
        }
    }
}

// ---------------------------------------------------------------------------------------

definirGrupos();

if (flag('--mover')) {
    moverPaso1();
} else if (flag('--flechas')) {
    eslintFix(flechas());
} else if (flag('--escritores')) {
    escritores();
} else if (option('--grupo')) {
    const nombre = option('--grupo');
    const g = GRUPOS[nombre];
    if (!g) fail(`no hay grupo ${nombre}. Hay: ${Object.keys(GRUPOS).join(', ')}`);
    const names = new Set(g.nombres);
    if (nombre === 'keys') {
        const A = analyse(readText(MAIN).text, MAIN);
        for (const s of A.stmts) if (s.node.kind === 'const' && s.names.length === 1 && /_(KEY|STORAGE)$/.test(s.names[0])) names.add(s.names[0]);
    }
    eslintFix(move(names, g.archivo, g.descripcion, { setters: nombre === 'state' }));
} else if (option('--nombres')) {
    const target = option('--a');
    if (!target) fail('falta --a <modulo.js>');
    const g = Object.values(GRUPOS).find(x => x.archivo === target);
    eslintFix(move(new Set(option('--nombres').split(',')), target, g?.descripcion ?? target));
} else {
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 24).join('\n'));
}

function definirGrupos() {
    grupo('keys', 'keys.js', `Las claves con las que la partida guarda sus cosas: en los metadatos del chat (\`*_KEY\`)
        y en este navegador (\`*_STORAGE\`, y \`localFlag\` para leerlo sin que falle).
        Una hoja: no importa nada, y así cualquier módulo de \`party/\` la puede importar.`, 'localFlag');
}
