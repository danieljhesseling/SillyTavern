// @ts-nocheck
/**
 * World Content Popups
 * Category-specific rich popup forms for creating/viewing/editing world info entries.
 * Styled after the Fable & Friends interface.
 */

import { t } from './i18n.js';
import { POPUP_TYPE, POPUP_RESULT, Popup } from './popup.js';

// ============================================================
//  CONSTANTS
// ============================================================

const ALIGNMENTS_OPT = [
    '', 'Lawful Good', 'Neutral Good', 'Chaotic Good',
    'Lawful Neutral', 'True Neutral', 'Chaotic Neutral',
    'Lawful Evil', 'Neutral Evil', 'Chaotic Evil',
];

const SPELL_SCHOOLS = [
    '', 'Abjuration', 'Conjuration', 'Divination', 'Enchantment',
    'Evocation', 'Illusion', 'Necromancy', 'Transmutation',
];

const RARITIES = ['', 'Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact'];

const SIZES = ['', 'Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];

const DND_SKILLS = [
    'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception',
    'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine',
    'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion',
    'Sleight of Hand', 'Stealth', 'Survival',
];

const DAMAGE_TYPES = [
    'Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning',
    'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder',
];

const ABILITY_NAMES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const ABILITY_LABELS = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };

// ============================================================
//  HTML HELPERS
// ============================================================

function esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escT(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function row(label, inputHtml) {
    return `<div class="wcp-row"><label class="wcp-label">${label}</label><div class="wcp-field-wrap">${inputHtml}</div></div>`;
}

function inp(field, value, placeholder = '', type = 'text') {
    return `<input type="${type}" class="wcp-input wcp-field" data-field="${field}" value="${esc(value || '')}" placeholder="${esc(placeholder)}" />`;
}

function num(field, value, placeholder = '') {
    return `<input type="number" class="wcp-input wcp-field" data-field="${field}" value="${value ?? ''}" placeholder="${esc(placeholder)}" />`;
}

function area(field, value, placeholder = '', rows = 3) {
    return `<textarea class="wcp-input wcp-field wcp-textarea" data-field="${field}" rows="${rows}" placeholder="${esc(placeholder)}">${escT(value || '')}</textarea>`;
}

function sel(field, value, options) {
    const opts = options.map(o => {
        const [val, label] = Array.isArray(o) ? o : [o, o];
        return `<option value="${esc(val)}" ${String(val) === String(value) ? 'selected' : ''}>${escT(label || val)}</option>`;
    });
    return `<select class="wcp-input wcp-field" data-field="${field}">${opts.join('')}</select>`;
}

function colorInp(field, value) {
    return `<div class="wcp-color-row">
        <input type="color" class="wcp-color-picker wcp-field" data-field="${field}" value="${esc(value || '#333333')}" />
        <input type="text" class="wcp-input wcp-color-hex wcp-field" data-field="${field}_hex" value="${esc(value || '#333333')}" placeholder="#hex"
            oninput="this.previousElementSibling.value=this.value"  />
    </div>`;
}

function section(title, icon, colorClass, body) {
    return `<div class="wcp-section wcp-color-${colorClass}">
        <div class="wcp-section-title"><i class="fa-solid ${icon}"></i> ${title}</div>
        <div class="wcp-section-body">${body}</div>
    </div>`;
}

function twoCol(left, right) {
    return `<div class="wcp-two-col"><div class="wcp-col">${left}</div><div class="wcp-col">${right}</div></div>`;
}

function imgBlock(existingBase64) {
    const hasImg = existingBase64 && existingBase64.trim();
    return `<div class="wcp-img-block">
        <div class="wcp-img-preview-box wcp-img-clickable" title="Click to choose image">
            ${hasImg ? `<img class="wcp-img-preview" src="${esc(existingBase64)}" />` : ''}
            <div class="wcp-img-placeholder" ${hasImg ? 'style="display:none"' : ''}><i class="fa-solid fa-image"></i><span>Click to upload</span></div>
        </div>
        <input type="file" class="wcp-img-file-input" accept="image/*" style="display:none" />
        <input type="hidden" class="wcp-field wcp-img-data" data-field="image" value="" />
        ${hasImg ? '<div class="wcp-img-remove" title="Remove image"><i class="fa-solid fa-trash-can"></i></div>' : ''}
    </div>`;
}

function statBox(label, field, value) {
    return `<div class="wcp-stat-box">
        <div class="wcp-stat-label">${label}</div>
        <input type="number" class="wcp-stat-input wcp-field" data-field="${field}" value="${value ?? 10}" min="1" max="30" />
    </div>`;
}

function skillChips(activeSkills) {
    const active = Array.isArray(activeSkills) ? activeSkills : [];
    return `<div class="wcp-skill-chips">${DND_SKILLS.map(s =>
        `<div class="wcp-skill-chip ${active.includes(s) ? 'active' : ''}" data-skill="${esc(s)}" onclick="this.classList.toggle('active')">${s}</div>`
    ).join('')}</div>`;
}

function dynamicActionRow(name = '', desc = '') {
    return `<div class="wcp-dynamic-row wcp-action-row">
        <input type="text" class="wcp-input wcp-dyn-name" value="${esc(name)}" placeholder="Action name..." />
        <textarea class="wcp-input wcp-dyn-desc" rows="2" placeholder="Action description...">${escT(desc)}</textarea>
        <button class="wcp-remove-row menu_button" title="Remove"><i class="fa-solid fa-xmark"></i></button>
    </div>`;
}

function dynamicFeatureRow(level = '', name = '', note = '') {
    return `<div class="wcp-dynamic-row wcp-feature-row">
        <input type="number" class="wcp-input wcp-dyn-level" value="${esc(level)}" placeholder="Lvl" min="1" max="20" style="width:50px" />
        <input type="text" class="wcp-input wcp-dyn-name" value="${esc(name)}" placeholder="Feature name..." style="flex:1" />
        <input type="text" class="wcp-input wcp-dyn-note" value="${esc(note)}" placeholder="Notes..." style="flex:1" />
        <button class="wcp-remove-row menu_button" title="Remove"><i class="fa-solid fa-xmark"></i></button>
    </div>`;
}

// ============================================================
//  DEFAULT DATA PER CATEGORY
// ============================================================

/** @param {string} cat */
function getDefaults(cat) {
    switch (cat) {
        case 'Characters': return {
            image: '', race: '', charClass: '', level: 1, alignment: '', pronouns: '',
            aliases: '', values: '', faction: '', location: '',
            str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
            ac: 10, maxHp: 30, speed: 30,
            skills: [], appearance: '', personality: '', backstory: '', memorandum: '',
            dmgVulnerabilities: '', dmgResistances: '', dmgImmunities: '', condImmunities: '',
        };
        case 'Locations': return { image: '', description: '', region: '' };
        case 'Races': return { image: '', source: '', description: '' };
        case 'Classes': return {
            image: '', source: '', hitDie: '', spellcasting: '', spellcastingAbility: '',
            spellPreparation: '', castingType: '', subclassLevel: '', description: '',
            features: [],
        };
        case 'Factions': return { image: '', source: '', description: '', color: '#333333', members: '' };
        case 'Monsters': return {
            image: '', source: '', cr: '', monsterType: '', size: '',
            hpRange: '', maxHp: 0, ac: 0, xp: 0, languages: '',
            description: '', appearance: '',
            dmgVulnerabilities: '', dmgResistances: '', dmgImmunities: '', condImmunities: '',
            darkvision: '', passivePerception: 0,
            speedWalk: '', speedClimb: '', speedFly: '', speedSwim: '',
            actions: [],
        };
        case 'Items': return {
            image: '', source: '', rarity: '', itemType: '', weight: '', slot: '',
            description: '', appearance: '', baseDamage: '', damageType: '', properties: '',
        };
        case 'Spells': return {
            image: '', school: '', spellLevel: 0, description: '', higherLevels: '',
            damage: '', damageType: '', savingThrowStat: '', saveSuccess: '', saveFailure: '',
            range: '', duration: '', castingTime: '', components: '',
        };
        case 'Boards': return { image: '', description: '', gridWidth: 50, gridHeight: 50 };
        default: return { image: '', description: '' };
    }
}

// ============================================================
//  FORM BUILDERS (per category)
// ============================================================

function buildCharacterForm(d) {
    return `<div class="wcp-popup">
        ${imgBlock(d.image)}
        ${twoCol(
        section('Details', 'fa-scroll', 'cyan', `
                ${row('Race', inp('race', d.race, 'Human, Elf, Dwarf...'))}
                ${row('Class', inp('charClass', d.charClass, 'Fighter, Wizard...'))}
                ${row('Level', num('level', d.level, '1'))}
                ${row('Alignment', sel('alignment', d.alignment, ALIGNMENTS_OPT))}
                ${row('Pronouns', inp('pronouns', d.pronouns, 'He/Him, She/Her...'))}
                ${row('Aliases', inp('aliases', d.aliases, 'Other names...'))}
                ${row('Values', inp('values', d.values, 'Honor, Freedom...'))}
                ${row('Faction', inp('faction', d.faction, 'The Skeliri Clan...'))}
                ${row('Location', inp('location', d.location, 'Ashknot Post...'))}
            `),
        section('Stats', 'fa-chart-bar', 'yellow', `
                <div class="wcp-stats-grid">
                    ${ABILITY_NAMES.map(a => statBox(ABILITY_LABELS[a], a, d[a])).join('')}
                </div>
                <div class="wcp-derived-row">
                    ${row('Armor Class', num('ac', d.ac, '10'))}
                    ${row('Max HP', num('maxHp', d.maxHp, '30'))}
                    ${row('Speed', num('speed', d.speed, '30'))}
                </div>
            `)
    )}
        ${section('Skills', 'fa-star', 'purple', skillChips(d.skills))}
        ${section('Appearance', 'fa-eye', 'purple', area('appearance', d.appearance, 'Physical description, clothing, distinguishing features...', 3))}
        ${section('Personality', 'fa-brain', 'pink', area('personality', d.personality, 'Personality traits, ideals, bonds, flaws...', 3))}
        ${section('Backstory', 'fa-book', 'orange', area('backstory', d.backstory, 'Character history and origin...', 4))}
        ${section('Memorandum', 'fa-sticky-note', 'blue', area('memorandum', d.memorandum, 'Important ongoing notes, current goals...', 3))}
        ${section('Damage & Condition Modifiers', 'fa-shield-halved', 'red', `
            ${row('Damage Vulnerabilities', inp('dmgVulnerabilities', d.dmgVulnerabilities, 'Fire, Lightning...'))}
            ${row('Damage Resistances', inp('dmgResistances', d.dmgResistances, 'Bludgeoning, Piercing...'))}
            ${row('Damage Immunities', inp('dmgImmunities', d.dmgImmunities, 'Poison...'))}
            ${row('Condition Immunities', inp('condImmunities', d.condImmunities, 'Frightened, Charmed...'))}
        `)}
    </div>`;
}

function buildLocationForm(d) {
    return `<div class="wcp-popup">
        ${imgBlock(d.image)}
        ${section('Description', 'fa-scroll', 'cyan', area('description', d.description, 'Describe this location, its atmosphere, features...', 5))}
        ${row('Region', inp('region', d.region, 'Thistlehold Rise, Northern Wastes...'))}
    </div>`;
}

function buildRaceForm(d) {
    return `<div class="wcp-popup">
        ${imgBlock(d.image)}
        ${row('Source / Tag', inp('source', d.source, 'Pollution, Homebrew, PHB...'))}
        ${section('Description', 'fa-scroll', 'cyan', area('description', d.description, 'Describe this race, their traits, culture, appearance...', 6))}
    </div>`;
}

function buildClassForm(d) {
    const features = Array.isArray(d.features) ? d.features : [];
    return `<div class="wcp-popup">
        ${imgBlock(d.image)}
        ${row('Source / Tag', inp('source', d.source, 'Pollution, Homebrew, PHB...'))}
        ${section('Description', 'fa-scroll', 'cyan', area('description', d.description, 'Describe this class, its role, playstyle...', 4))}
        ${section('Details', 'fa-list', 'yellow', `
            ${row('Hit Die', inp('hitDie', d.hitDie, 'd8, d10...'))}
            ${row('Spellcasting', sel('spellcasting', d.spellcasting, ['', 'Yes', 'No']))}
            ${row('Spellcasting Ability', inp('spellcastingAbility', d.spellcastingAbility, 'Intelligence, Wisdom...'))}
            ${row('Spell Preparation', inp('spellPreparation', d.spellPreparation, 'Known, Prepared...'))}
            ${row('Casting Type', inp('castingType', d.castingType, 'Full, Half, Third...'))}
            ${row('Subclass at Level', num('subclassLevel', d.subclassLevel, '3'))}
        `)}
        ${section('Class Features', 'fa-star', 'purple', `
            <div class="wcp-dynamic-list" data-type="feature">
                <div class="wcp-dynamic-rows wcp-feature-rows">
                    ${features.map(f => dynamicFeatureRow(f.level, f.name, f.note)).join('')}
                </div>
                <button class="wcp-add-row-btn wcp-add-feature-btn menu_button"><i class="fa-solid fa-plus"></i> Add Feature</button>
            </div>
        `)}
    </div>`;
}

function buildFactionForm(d) {
    return `<div class="wcp-popup">
        ${imgBlock(d.image)}
        ${row('Source / Tag', inp('source', d.source, 'Pollution, Homebrew...'))}
        ${section('Description', 'fa-scroll', 'cyan', area('description', d.description, 'Describe this faction, their goals, territory...', 5))}
        ${section('Faction Color', 'fa-palette', 'purple', colorInp('color', d.color))}
        ${section('Members', 'fa-users', 'yellow', area('members', d.members, 'List notable members, one per line...', 4))}
    </div>`;
}

function buildMonsterForm(d) {
    const actions = Array.isArray(d.actions) ? d.actions : [];
    return `<div class="wcp-popup">
        ${imgBlock(d.image)}
        ${row('Source / Tag', inp('source', d.source, 'Pollution, Homebrew, MM...'))}
        ${twoCol(
        section('Details', 'fa-scroll', 'cyan', `
                ${row('CR', inp('cr', d.cr, '1/4, 1, 5...'))}
                ${row('Type', inp('monsterType', d.monsterType, 'Beast, Undead, Giant...'))}
                ${row('Size', sel('size', d.size, SIZES))}
                ${row('Max HP', num('maxHp', d.maxHp, '10'))}
                ${row('HP Range', inp('hpRange', d.hpRange, '126 (13d12 + 39)'))}
                ${row('XP', num('xp', d.xp, '2900'))}
                ${row('Languages', inp('languages', d.languages, 'Undercommon, fragments...'))}
            `),
        section('Defense', 'fa-shield-halved', 'green', `
                ${row('Armor Class', num('ac', d.ac, '15'))}
                ${row('Dmg Vulnerabilities', inp('dmgVulnerabilities', d.dmgVulnerabilities, 'Fire...'))}
                ${row('Dmg Resistances', inp('dmgResistances', d.dmgResistances, 'Bludgeoning...'))}
                ${row('Dmg Immunities', inp('dmgImmunities', d.dmgImmunities, 'Poison...'))}
                ${row('Cond. Immunities', inp('condImmunities', d.condImmunities, 'Frightened...'))}
            `)
    )}
        ${twoCol(
        section('Senses', 'fa-eye', 'blue', `
                ${row('Darkvision', inp('darkvision', d.darkvision, '60 ft.'))}
                ${row('Passive Perception', num('passivePerception', d.passivePerception, '10'))}
            `),
        section('Speed', 'fa-person-running', 'yellow', `
                ${row('Walk', inp('speedWalk', d.speedWalk, '40 ft.'))}
                ${row('Climb', inp('speedClimb', d.speedClimb, '20 ft.'))}
                ${row('Fly', inp('speedFly', d.speedFly, ''))}
                ${row('Swim', inp('speedSwim', d.speedSwim, ''))}
            `)
    )}
        ${section('Description', 'fa-align-left', 'cyan', area('description', d.description, 'Description of the monster...', 3))}
        ${section('Appearance', 'fa-eye', 'purple', area('appearance', d.appearance, 'Physical appearance details...', 3))}
        ${section('Actions', 'fa-bolt', 'red', `
            <div class="wcp-dynamic-list" data-type="action">
                <div class="wcp-dynamic-rows wcp-action-rows">
                    ${actions.map(a => dynamicActionRow(a.name, a.description)).join('')}
                </div>
                <button class="wcp-add-row-btn wcp-add-action-btn menu_button"><i class="fa-solid fa-plus"></i> Add Action</button>
            </div>
        `)}
    </div>`;
}

function buildItemForm(d) {
    return `<div class="wcp-popup">
        ${imgBlock(d.image)}
        ${row('Source / Tag', inp('source', d.source, 'Pollution, Homebrew, DMG...'))}
        ${twoCol(
        section('Details', 'fa-scroll', 'cyan', `
                ${row('Rarity', sel('rarity', d.rarity, RARITIES))}
                ${row('Type', inp('itemType', d.itemType, 'Weapon (Martial Melee)...'))}
                ${row('Weight', inp('weight', d.weight, '7.00 lb.'))}
                ${row('Slot', inp('slot', d.slot, 'Hand, Body, Head...'))}
            `),
        section('Weapon Properties', 'fa-gavel', 'red', `
                ${row('Base Damage', inp('baseDamage', d.baseDamage, '1d12 Slashing'))}
                ${row('Damage Type', sel('damageType', d.damageType, ['', ...DAMAGE_TYPES]))}
                ${row('Properties', inp('properties', d.properties, 'Heavy, Two-Handed...'))}
            `)
    )}
        ${section('Description', 'fa-align-left', 'cyan', area('description', d.description, 'Describe the item, its lore, magical properties...', 4))}
        ${section('Appearance', 'fa-eye', 'purple', area('appearance', d.appearance, 'Physical appearance of the item...', 3))}
    </div>`;
}

function buildSpellForm(d) {
    return `<div class="wcp-popup">
        ${imgBlock(d.image)}
        ${twoCol(
        section('Spell Info', 'fa-wand-sparkles', 'purple', `
                ${row('School', sel('school', d.school, SPELL_SCHOOLS))}
                ${row('Level', num('spellLevel', d.spellLevel, '0 = cantrip'))}
                ${row('Range', inp('range', d.range, 'Self (15-foot cone)...'))}
                ${row('Duration', inp('duration', d.duration, 'Instantaneous, 1 minute...'))}
                ${row('Casting Time', inp('castingTime', d.castingTime, '1 action, 1 bonus action...'))}
                ${row('Components', inp('components', d.components, 'V, S, M (a tiny ball)'))}
            `),
        section('Attack Details', 'fa-bolt', 'red', `
                ${row('Damage', inp('damage', d.damage, '3d6 Fire'))}
                ${row('Damage Type', sel('damageType', d.damageType, ['', ...DAMAGE_TYPES]))}
            `) + section('Saving Throw', 'fa-shield-halved', 'yellow', `
                ${row('Save Stat', inp('savingThrowStat', d.savingThrowStat, 'Dexterity, Wisdom...'))}
                ${row('On Success', inp('saveSuccess', d.saveSuccess, 'Target takes 50% damage'))}
                ${row('On Failure', inp('saveFailure', d.saveFailure, 'Target takes 100% damage'))}
            `)
    )}
        ${section('Description', 'fa-scroll', 'cyan', area('description', d.description, 'Describe the spell effect...', 4))}
        ${section('At Higher Levels', 'fa-arrow-up', 'blue', area('higherLevels', d.higherLevels, 'When you cast this spell using a spell slot of 2nd level or higher...', 3))}
    </div>`;
}

function buildBoardForm(d) {
    return `<div class="wcp-popup">
        ${imgBlock(d.image)}
        ${section('Description', 'fa-scroll', 'cyan', area('description', d.description, 'Describe this board/battlemap...', 4))}
        ${twoCol(
        row('Grid Width', num('gridWidth', d.gridWidth, '50')),
        row('Grid Height', num('gridHeight', d.gridHeight, '50'))
    )}
    </div>`;
}

function buildUncategorizedForm(d) {
    return `<div class="wcp-popup">
        ${imgBlock(d.image)}
        ${section('Description', 'fa-scroll', 'cyan', area('description', d.description, 'Describe this entry...', 6))}
    </div>`;
}

// ============================================================
//  DATA READING
// ============================================================

/**
 * Read all form field values from the popup DOM.
 * @param {string} category
 * @returns {any}
 */
function readFormData(category) {
    /** @type {any} */
    const data = {};

    document.querySelectorAll('.wcp-field').forEach(el => {
        const field = /** @type {HTMLInputElement} */ (el).dataset?.field;
        if (!field || field.startsWith('_') || field.endsWith('_hex')) return;
        const tag = el.tagName.toLowerCase();
        const type = /** @type {HTMLInputElement} */ (el).type;

        if (type === 'number') {
            data[field] = Number(/** @type {HTMLInputElement} */ (el).value) || 0;
        } else if (type === 'checkbox') {
            data[field] = /** @type {HTMLInputElement} */ (el).checked;
        } else if (type === 'color') {
            data[field] = /** @type {HTMLInputElement} */ (el).value || '';
        } else if (tag === 'select' || tag === 'textarea') {
            data[field] = /** @type {HTMLInputElement} */ (el).value || '';
        } else {
            data[field] = /** @type {HTMLInputElement} */ (el).value || '';
        }
    });

    // Skills (chip-based)
    if (category === 'Characters') {
        data.skills = [];
        document.querySelectorAll('.wcp-skill-chip.active').forEach(el => {
            const skill = /** @type {HTMLElement} */ (el).dataset?.skill;
            if (skill) data.skills.push(skill);
        });
    }

    // Dynamic actions (monsters)
    if (category === 'Monsters') {
        data.actions = [];
        document.querySelectorAll('.wcp-action-row').forEach(el => {
            const name = /** @type {HTMLInputElement} */ (el.querySelector('.wcp-dyn-name'))?.value || '';
            const desc = /** @type {HTMLTextAreaElement} */ (el.querySelector('.wcp-dyn-desc'))?.value || '';
            if (name || desc) data.actions.push({ name, description: desc });
        });
    }

    // Dynamic features (classes)
    if (category === 'Classes') {
        data.features = [];
        document.querySelectorAll('.wcp-feature-row').forEach(el => {
            const level = /** @type {HTMLInputElement} */ (el.querySelector('.wcp-dyn-level'))?.value || '';
            const name = /** @type {HTMLInputElement} */ (el.querySelector('.wcp-dyn-name'))?.value || '';
            const note = /** @type {HTMLInputElement} */ (el.querySelector('.wcp-dyn-note'))?.value || '';
            if (level || name) data.features.push({ level, name, note });
        });
    }

    return data;
}

// ============================================================
//  CONTENT GENERATION (for WI prompt injection)
// ============================================================

/**
 * Generate human-readable content text from structured data.
 * @param {string} category
 * @param {string} title
 * @param {any} d
 * @returns {string}
 */
function generateContent(category, title, d) {
    const parts = [];
    switch (category) {
        case 'Characters': {
            let header = title;
            if (d.race || d.charClass) header += ` is a Level ${d.level || 1} ${d.race || ''} ${d.charClass || ''}`.trim();
            if (d.alignment) header += ` (${d.alignment})`;
            parts.push(header + '.');
            if (d.pronouns) parts.push(`Pronouns: ${d.pronouns}.`);
            if (d.faction) parts.push(`Faction: ${d.faction}.`);
            if (d.location) parts.push(`Location: ${d.location}.`);
            const stats = ABILITY_NAMES.map(a => `${a.toUpperCase()}: ${d[a] || 10}`).join(', ');
            parts.push(`Stats: ${stats}. AC: ${d.ac || 10}, HP: ${d.maxHp || 30}, Speed: ${d.speed || 30}.`);
            if (d.appearance) parts.push(`Appearance: ${d.appearance}`);
            if (d.personality) parts.push(`Personality: ${d.personality}`);
            if (d.backstory) parts.push(`Backstory: ${d.backstory}`);
            if (d.memorandum) parts.push(`Notes: ${d.memorandum}`);
            break;
        }
        case 'Locations':
            parts.push(`${title} is a location${d.region ? ` in ${d.region}` : ''}.`);
            if (d.description) parts.push(d.description);
            break;
        case 'Races':
            parts.push(`${title} is a race.`);
            if (d.description) parts.push(d.description);
            break;
        case 'Classes': {
            parts.push(`${title} is a class${d.hitDie ? ` (Hit Die: ${d.hitDie})` : ''}.`);
            if (d.description) parts.push(d.description);
            if (d.features?.length) {
                parts.push('Class Features: ' + d.features.map(f => `Level ${f.level}: ${f.name}`).join('; ') + '.');
            }
            break;
        }
        case 'Factions':
            parts.push(`${title} is a faction.`);
            if (d.description) parts.push(d.description);
            if (d.members) parts.push(`Members: ${d.members}`);
            break;
        case 'Monsters': {
            let header = `${title} is a ${d.size || ''} ${d.monsterType || 'creature'}`.trim();
            if (d.cr) header += ` (CR ${d.cr})`;
            parts.push(header + '.');
            parts.push(`AC: ${d.ac || 0}, HP: ${d.hpRange || '?'}, XP: ${d.xp || 0}.`);
            if (d.description) parts.push(d.description);
            if (d.appearance) parts.push(`Appearance: ${d.appearance}`);
            if (d.actions?.length) {
                parts.push('Actions: ' + d.actions.map(a => `${a.name}: ${a.description}`).join(' | '));
            }
            break;
        }
        case 'Items': {
            let header = title;
            if (d.rarity || d.itemType) header += ` — ${[d.rarity, d.itemType].filter(Boolean).join(' • ')}`;
            parts.push(header + '.');
            if (d.baseDamage) parts.push(`Damage: ${d.baseDamage}${d.damageType ? ` ${d.damageType}` : ''}.`);
            if (d.description) parts.push(d.description);
            break;
        }
        case 'Spells': {
            let header = `${title} — Level ${d.spellLevel || 0} ${d.school || 'Spell'}`;
            parts.push(header + '.');
            if (d.range) parts.push(`Range: ${d.range}.`);
            if (d.duration) parts.push(`Duration: ${d.duration}.`);
            if (d.damage) parts.push(`Damage: ${d.damage}${d.damageType ? ` ${d.damageType}` : ''}.`);
            if (d.description) parts.push(d.description);
            if (d.higherLevels) parts.push(`At Higher Levels: ${d.higherLevels}`);
            break;
        }
        default:
            parts.push(title + '.');
            if (d.description) parts.push(d.description);
    }
    return parts.join('\n');
}

// ============================================================
//  MAIN POPUP FUNCTION
// ============================================================

/**
 * Show a category-specific popup for creating or editing an entry.
 * @param {string} category
 * @param {any} [existingDndData]
 * @param {string} [existingTitle]
 * @param {string[]} [worldOptions] - If provided, show world selector (for new entries)
 * @returns {Promise<{title: string, dndData: any, content: string, keys: string[], world: string}|null>}
 */
export async function showCategoryPopup(category, existingDndData, existingTitle, worldOptions) {
    const defaults = getDefaults(category);
    const d = { ...defaults, ...(existingDndData || {}) };

    let formHtml;
    switch (category) {
        case 'Characters': formHtml = buildCharacterForm(d); break;
        case 'Locations': formHtml = buildLocationForm(d); break;
        case 'Races': formHtml = buildRaceForm(d); break;
        case 'Classes': formHtml = buildClassForm(d); break;
        case 'Factions': formHtml = buildFactionForm(d); break;
        case 'Monsters': formHtml = buildMonsterForm(d); break;
        case 'Items': formHtml = buildItemForm(d); break;
        case 'Spells': formHtml = buildSpellForm(d); break;
        case 'Boards': formHtml = buildBoardForm(d); break;
        default: formHtml = buildUncategorizedForm(d); break;
    }

    // Build the full popup HTML with title field and optional world selector
    const worldSel = worldOptions?.length
        ? row('World', sel('_world', worldOptions[0], worldOptions.map(w => [w, w])))
        : '';

    const html = `<div class="wcp-outer">
        ${worldSel}
        ${row('Name', inp('_title', existingTitle || '', 'Entry name...'))}
        ${row('Keywords', inp('_keys', '', 'keyword1, keyword2 (auto-generated if empty)'))}
        ${formHtml}
    </div>`;

    const singular = category.endsWith('es') ? category.slice(0, -2)
        : category.endsWith('s') ? category.slice(0, -1)
            : category;
    const popupTitle = existingTitle ? `Edit ${singular}` : `New ${singular}`;

    const existingImage = d.image || '';

    // Use onClosing to capture form data BEFORE the DOM is removed
    let capturedResult = null;

    const fullContent = `<h3>${popupTitle}</h3>${html}`;
    const popup = new Popup(fullContent, POPUP_TYPE.CONFIRM, null, {
        wider: true,
        allowVerticalScrolling: true,
        onOpen: () => {
            // Pre-populate hidden image input with existing base64/data
            const imgData = document.querySelector('.wcp-img-data');
            if (imgData && existingImage) {
                /** @type {HTMLInputElement} */ (imgData).value = existingImage;
            }
        },
        onClosing: (popup) => {
            if (popup.result === POPUP_RESULT.AFFIRMATIVE) {
                // Read form data while DOM still exists
                const formData = readFormData(category);

                const titleEl = /** @type {HTMLInputElement|null} */ (document.querySelector('.wcp-field[data-field="_title"]'));
                const keysEl = /** @type {HTMLInputElement|null} */ (document.querySelector('.wcp-field[data-field="_keys"]'));
                const worldEl = /** @type {HTMLInputElement|null} */ (document.querySelector('.wcp-field[data-field="_world"]'));

                const title = titleEl?.value?.trim() || existingTitle || 'Untitled';
                const keysRaw = keysEl?.value?.trim() || '';
                const keys = keysRaw ? keysRaw.split(',').map(k => k.trim()).filter(Boolean) : [title];
                const world = worldEl?.value || (worldOptions?.[0] ?? '');

                // Remove internal fields from dndData
                delete formData._title;
                delete formData._keys;
                delete formData._world;

                const content = generateContent(category, title, formData);

                capturedResult = { title, dndData: formData, content, keys, world };
            }
            return true; // allow closing
        },
    });

    await popup.show();
    return capturedResult;
}

// ============================================================
//  EVENT DELEGATION SETUP
// ============================================================

/**
 * Initialize global event handlers for dynamic popup rows.
 * Call this once from the browser module.
 */
export function initWcpHandlers() {
    // Dynamic rows
    $(document).on('click', '.wcp-add-action-btn', function () {
        $(this).siblings('.wcp-action-rows').append(dynamicActionRow());
    });
    $(document).on('click', '.wcp-add-feature-btn', function () {
        $(this).siblings('.wcp-feature-rows').append(dynamicFeatureRow());
    });
    $(document).on('click', '.wcp-remove-row', function () {
        $(this).closest('.wcp-dynamic-row').remove();
    });

    // Image file picker: click preview box → trigger file input
    $(document).on('click', '.wcp-img-clickable', function () {
        $(this).closest('.wcp-img-block').find('.wcp-img-file-input').trigger('click');
    });

    // Image file picker: file selected → read as base64, show preview
    $(document).on('change', '.wcp-img-file-input', function () {
        const file = this.files?.[0];
        if (!file) return;
        const block = $(this).closest('.wcp-img-block');
        const reader = new FileReader();
        reader.onload = function (e) {
            const base64 = e.target?.result;
            if (!base64) return;
            // Store base64 in hidden input
            block.find('.wcp-img-data').val(base64);
            // Show preview
            let img = block.find('.wcp-img-preview');
            if (!img.length) {
                img = $('<img class="wcp-img-preview" />');
                block.find('.wcp-img-placeholder').before(img);
            }
            img.attr('src', base64).show();
            block.find('.wcp-img-placeholder').hide();
            // Add remove button if not present
            if (!block.find('.wcp-img-remove').length) {
                block.append('<div class="wcp-img-remove" title="Remove image"><i class="fa-solid fa-trash-can"></i></div>');
            }
        };
        reader.readAsDataURL(file);
    });

    // Image: remove button
    $(document).on('click', '.wcp-img-remove', function (e) {
        e.stopPropagation();
        const block = $(this).closest('.wcp-img-block');
        block.find('.wcp-img-data').val('');
        block.find('.wcp-img-preview').remove();
        block.find('.wcp-img-placeholder').show();
        block.find('.wcp-img-file-input').val('');
        $(this).remove();
    });
}
