/**
 * El guion de una campaña en Word, de ida y vuelta (J5.7 y J5.8 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * De ida, los bloques de `script-doc.js` pasan a un .docx que se lee como un guion: la portada,
 * cómo corregirlo, un título por parte, capítulo e hito, y cada línea como «**Tomás (el posadero)**
 * *(enfadado)*: ¡Al ladrón!», con tus opciones en viñetas debajo y la marca de la línea al final,
 * pequeña y en gris. Las líneas sin nadie que las diga («Narrador») salen con la etiqueta en rojo
 * oscuro, para encontrarlas a simple vista (D-J60).
 *
 * De vuelta, `docxParagraphs` saca el texto de cada párrafo del `word/document.xml`, sin mirar
 * cómo lo partió Word en trozos: lo que se escribió con el control de cambios puesto cuenta como
 * escrito, y lo tachado no cuenta.
 *
 * Puro: devuelve y lee los archivos del .docx como texto. El zip lo pone quien llama (fflate en
 * `tools/guion-word.mjs`; en el navegador valdría JSZip), así que esto sirve también para los
 * botones del gremio cuando los haya.
 */

import { blockParts, NARRATOR, HERO } from './script-doc.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';

/** El estilo de párrafo de cada clase de bloque. */
const STYLES = {
    titulo: 'Title',
    subtitulo: 'Subtitle',
    parte: 'Heading1',
    capitulo: 'Heading2',
    seccion: 'Heading3',
    apartado: 'Heading4',
    nota: 'GuionNota',
    linea: 'GuionLinea',
};

/**
 * Un texto que se puede poner en XML: sin los caracteres que XML no admite y con `&`, `<` y `>`
 * escritos como tocan.
 *
 * @param {any} value
 * @returns {string}
 */
export function xmlText(value) {
    return String(value ?? '')
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Un trozo de texto con su formato. Los saltos de línea van como `<w:br/>`.
 *
 * @param {string} said
 * @param {string} props Lo de dentro de `<w:rPr>`.
 * @returns {string}
 */
function run(said, props) {
    const rPr = props ? `<w:rPr>${props}</w:rPr>` : '';
    return String(said).split('\n').map((piece, i) => {
        const br = i > 0 ? `<w:r>${rPr}<w:br/></w:r>` : '';
        return piece ? `${br}<w:r>${rPr}<w:t xml:space="preserve">${xmlText(piece)}</w:t></w:r>` : br;
    }).join('');
}

/**
 * El formato de cada trozo de una línea.
 *
 * @param {'pre'|'label'|'mood'|'text'|'mark'|'plain'} style
 * @param {string} label Quién habla: el narrador y tú van en color.
 * @returns {string}
 */
function runProps(style, label) {
    if (style === 'pre') return '<w:i/><w:color w:val="7F6A4D"/>';
    if (style === 'label') {
        if (label === NARRATOR) return '<w:b/><w:color w:val="9C2A2A"/>';
        if (label === HERO) return '<w:b/><w:color w:val="1F4E79"/>';
        return '<w:b/>';
    }
    if (style === 'mood') return '<w:i/><w:color w:val="595959"/>';
    // La marca: pequeña, gris y sin corrector (que no subraye los ids en rojo).
    if (style === 'mark') return '<w:noProof/><w:color w:val="A6A6A6"/><w:sz w:val="14"/><w:szCs w:val="14"/>';
    return '';
}

/**
 * Un párrafo del guion.
 *
 * @param {import('./script-doc.js').ScriptBlock} block
 * @returns {string}
 */
function paragraph(block) {
    const depth = Math.max(0, Math.min(3, Number(block.depth) || 0));
    const pPr = [`<w:pStyle w:val="${STYLES[block.type] ?? 'GuionLinea'}"/>`];
    if (block.bullet) pPr.push(`<w:numPr><w:ilvl w:val="${depth}"/><w:numId w:val="1"/></w:numPr>`);
    else if (depth > 0) pPr.push(`<w:ind w:left="${720 * depth}"/>`);
    const label = String(block.label ?? '');
    const runs = blockParts(block).map(part => run(part.text, runProps(part.style, label))).join('');
    return `<w:p><w:pPr>${pPr.join('')}</w:pPr>${runs}</w:p>`;
}

/** Los estilos: el castellano para el corrector, la letra y los títulos. */
function stylesXml() {
    const heading = (/** @type {string} */ id, /** @type {string} */ name, /** @type {number} */ level, /** @type {number} */ size, /** @type {string} */ extra = '') => `
<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="GuionLinea"/><w:uiPriority w:val="9"/><w:qFormat/>
<w:pPr><w:keepNext/><w:keepLines/>${extra}<w:spacing w:before="${level === 0 ? 0 : 240}" w:after="120"/><w:outlineLvl w:val="${level}"/></w:pPr>
<w:rPr><w:b/><w:color w:val="2F3E55"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr></w:style>`;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${W_NS}">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="es-ES" w:eastAsia="es-ES" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="GuionLinea"><w:name w:val="Guion: línea"/><w:basedOn w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="GuionNota"><w:name w:val="Guion: nota"/><w:basedOn w:val="Normal"/><w:next w:val="GuionLinea"/><w:qFormat/><w:pPr><w:spacing w:after="60"/></w:pPr><w:rPr><w:i/><w:color w:val="6B6B6B"/><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Subtitle"/><w:qFormat/><w:pPr><w:spacing w:before="1200" w:after="120"/></w:pPr><w:rPr><w:b/><w:color w:val="2F3E55"/><w:sz w:val="56"/><w:szCs w:val="56"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="GuionLinea"/><w:qFormat/><w:pPr><w:spacing w:after="360"/></w:pPr><w:rPr><w:i/><w:color w:val="595959"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>
${heading('Heading1', 'heading 1', 0, 40, '<w:pageBreakBefore/>')}
${heading('Heading2', 'heading 2', 1, 32)}
${heading('Heading3', 'heading 3', 2, 26)}
${heading('Heading4', 'heading 4', 3, 23)}
</w:styles>`;
}

/** Las viñetas, una forma por nivel. */
function numberingXml() {
    // Las opciones de una escena van en el nivel 1: también con el punto gordo.
    const marks = ['•', '•', '◦', '–'];
    const levels = marks.map((mark, level) => `<w:lvl w:ilvl="${level}"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="${mark}"/><w:lvlJc w:val="left"/>`
        + `<w:pPr><w:ind w:left="${720 + 360 * level}" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:hint="default"/></w:rPr></w:lvl>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="${W_NS}"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${levels}</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;
}

/** El pie, con el número de página. */
function footerXml() {
    const grey = '<w:rPr><w:color w:val="808080"/><w:sz w:val="16"/></w:rPr>';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="${W_NS}" xmlns:r="${R_NS}"><w:p><w:pPr><w:jc w:val="center"/></w:pPr>`
        + `<w:r>${grey}<w:fldChar w:fldCharType="begin"/></w:r><w:r>${grey}<w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>`
        + `<w:r>${grey}<w:fldChar w:fldCharType="separate"/></w:r><w:r>${grey}<w:t>1</w:t></w:r><w:r>${grey}<w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`;
}

/**
 * Los archivos de un .docx con el guion, por su ruta dentro del zip.
 *
 * @param {import('./script-doc.js').Script} script
 * @param {Object} [input]
 * @param {string} [input.when] La fecha y hora, como `2026-10-02T12:00:00Z`.
 * @param {string} [input.author]
 * @returns {Record<string, string>}
 */
export function scriptToDocx(script, { when = '2026-01-01T00:00:00Z', author = 'El juego' } = {}) {
    const body = script.blocks.map(paragraph).join('\n');
    const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W_NS}" xmlns:r="${R_NS}"><w:body>
${body}
<w:sectPr><w:footerReference w:type="default" r:id="rId4"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr>
</w:body></w:document>`;
    const stamp = xmlText(when);
    return {
        '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`,
        '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${PKG_REL}">
<Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="${REL}/extended-properties" Target="docProps/app.xml"/>
</Relationships>`,
        'word/_rels/document.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${PKG_REL}">
<Relationship Id="rId1" Type="${REL}/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="${REL}/numbering" Target="numbering.xml"/>
<Relationship Id="rId3" Type="${REL}/settings" Target="settings.xml"/>
<Relationship Id="rId4" Type="${REL}/footer" Target="footer1.xml"/>
</Relationships>`,
        'word/document.xml': document,
        'word/styles.xml': stylesXml(),
        'word/numbering.xml': numberingXml(),
        'word/footer1.xml': footerXml(),
        'word/settings.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="${W_NS}"><w:defaultTabStop w:val="708"/><w:characterSpacingControl w:val="doNotCompress"/><w:themeFontLang w:val="es-ES"/>`
            + '<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>',
        'docProps/core.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${xmlText(`${script.title}: el guion`)}</dc:title><dc:language>es-ES</dc:language><dc:creator>${xmlText(author)}</dc:creator><cp:lastModifiedBy>${xmlText(author)}</cp:lastModifiedBy>
<dcterms:created xsi:type="dcterms:W3CDTF">${stamp}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${stamp}</dcterms:modified>
</cp:coreProperties>`,
        'docProps/app.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>${xmlText(author)}</Application></Properties>`,
    };
}

/**
 * Un texto de XML en limpio: `&amp;` es `&`, `&#225;` es `á`.
 *
 * @param {string} value
 * @returns {string}
 */
function decodeXml(value) {
    return value.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/gi, (all, entity) => {
        const name = String(entity).toLowerCase();
        if (name === 'amp') return '&';
        if (name === 'lt') return '<';
        if (name === 'gt') return '>';
        if (name === 'quot') return '"';
        if (name === 'apos') return '\'';
        const code = name.startsWith('#x') ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : all;
    });
}

/**
 * Los párrafos de un `word/document.xml`, en texto plano y en orden. Da igual en cuántos trozos
 * partiera Word cada línea; un tabulador es `\t` y un salto de línea, `\n`. Con el control de
 * cambios, lo añadido cuenta y lo tachado no.
 *
 * @param {string} xml
 * @returns {string[]}
 */
export function docxParagraphs(xml) {
    return docxBlocks(xml).map(paragraph => paragraph.text);
}

/**
 * Lo mismo, con el estilo de cada párrafo (`Heading3`, `GuionNota`…): lo que no es una línea
 * (un título, una nota del guion) no se toma por una línea nueva.
 *
 * @param {string} xml
 * @returns {Array<{text: string, style: string}>}
 */
export function docxBlocks(xml) {
    /** @type {Array<{text: string, style: string}>} */
    const out = [];
    /** @type {Array<{text: string, style: string}>} */
    const open = [];
    let inText = false;
    let struck = 0;
    // Los tabuladores y saltos solo cuentan dentro de un trozo de texto (`w:r`): en el formato
    // del párrafo, `w:tab` es una tabulación definida, no escrita.
    let inRun = 0;
    const add = (/** @type {string} */ said) => {
        if (open.length > 0 && struck === 0) open[open.length - 1].text += said;
    };
    for (const m of String(xml ?? '').matchAll(/<(\/?)([A-Za-z][\w.:-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|([^<]+)/g)) {
        if (m[5] !== undefined) {
            if (inText) add(decodeXml(m[5]));
            continue;
        }
        const closing = m[1] === '/';
        const selfClosing = m[4] === '/';
        const name = m[2];
        if (name === 'w:p') {
            if (selfClosing) out.push({ text: '', style: '' });
            else if (closing) out.push(open.pop() ?? { text: '', style: '' });
            else open.push({ text: '', style: '' });
        } else if (name === 'w:pStyle') {
            const style = /w:val\s*=\s*"([^"]*)"/.exec(m[3])?.[1];
            // El primero es el de ahora (el de un cambio de formato guardado va después).
            if (open.length > 0 && style && !open[open.length - 1].style) open[open.length - 1].style = style;
        } else if (name === 'w:t') {
            inText = !closing && !selfClosing;
        } else if (name === 'w:r') {
            if (!selfClosing) inRun = Math.max(0, inRun + (closing ? -1 : 1));
        } else if (name === 'w:del' || name === 'w:moveFrom') {
            if (!selfClosing) struck = Math.max(0, struck + (closing ? -1 : 1));
        } else if (closing || inRun === 0) {
            continue;
        } else if (name === 'w:tab' || name === 'w:ptab') {
            add('\t');
        } else if (name === 'w:br' || name === 'w:cr') {
            add('\n');
        } else if (name === 'w:noBreakHyphen') {
            add('-');
        }
    }
    return out;
}
