import {
    extension_prompts,
    setExtensionPrompt,
    extension_prompt_types,
    extension_prompt_roles,
    chat_metadata,
    saveMetadata,
} from '../script.js';
import { Popup, POPUP_TYPE, POPUP_RESULT } from './popup.js';

/**
 * @typedef {Object} CustomInstruction
 * @property {string} id
 * @property {string} label
 * @property {string} text
 * @property {boolean} enabled
 */

const POSITION_LABELS = { [-1]: 'None', 0: 'In Prompt', 1: 'In Chat', 2: 'Before Prompt' };
const ROLE_LABELS = { 0: 'System', 1: 'User', 2: 'Assistant' };

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Get custom instructions array from chat_metadata, ensuring it exists.
 * @returns {CustomInstruction[]}
 */
function getCustomInstructions() {
    if (!chat_metadata.customInstructions) {
        chat_metadata.customInstructions = [];
    }
    return chat_metadata.customInstructions;
}

/**
 * Inject all enabled custom instructions into the extension prompt system.
 */
export function injectCustomInstructions() {
    const instructions = getCustomInstructions();

    // Collect active IDs to know which keys to keep
    const activeKeys = new Set();

    for (const instr of instructions) {
        const key = `CUSTOM_INSTR_${instr.id}`;
        if (instr.enabled && instr.text.trim()) {
            setExtensionPrompt(
                key,
                `[CUSTOM INSTRUCTION: ${instr.label}]\n${instr.text}`,
                extension_prompt_types.IN_PROMPT,
                0,
                false,
                extension_prompt_roles.SYSTEM,
            );
            activeKeys.add(key);
        } else {
            // Clear disabled/empty instructions
            setExtensionPrompt(key, '', extension_prompt_types.IN_PROMPT, 0);
        }
    }

    // Clear any orphan keys from deleted instructions
    for (const key of Object.keys(extension_prompts)) {
        if (key.startsWith('CUSTOM_INSTR_') && !activeKeys.has(key) && !instructions.some(i => `CUSTOM_INSTR_${i.id}` === key)) {
            setExtensionPrompt(key, '', extension_prompt_types.IN_PROMPT, 0);
        }
    }
}

/**
 * Build and show the Active Instructions popup.
 */
async function openActiveInstructionsPopup() {
    const instructions = getCustomInstructions();

    // ---- Build read-only active prompts section ----
    let activePromptsHtml = '';
    const sortedKeys = Object.keys(extension_prompts).sort();
    for (const key of sortedKeys) {
        const prompt = extension_prompts[key];
        if (!prompt || !prompt.value || !prompt.value.trim()) continue;
        // Skip custom instructions — they'll appear in the editable section
        if (key.startsWith('CUSTOM_INSTR_')) continue;

        const posLabel = POSITION_LABELS[prompt.position] ?? `Pos ${prompt.position}`;
        const roleLabel = ROLE_LABELS[prompt.role] ?? `Role ${prompt.role}`;
        const depth = prompt.depth ?? 0;
        const truncated = prompt.value.length > 500
            ? escapeHtml(prompt.value.substring(0, 500)) + '…'
            : escapeHtml(prompt.value);

        activePromptsHtml += `
        <div class="ai-prompt-item" data-key="${escapeHtml(key)}">
            <div class="ai-prompt-header">
                <span class="ai-prompt-key">${escapeHtml(key)}</span>
                <span class="ai-prompt-meta">${posLabel} · ${roleLabel} · Depth ${depth}</span>
                <i class="ai-prompt-toggle fa-solid fa-chevron-down"></i>
            </div>
            <div class="ai-prompt-value" style="display:none;">
                <pre>${truncated}</pre>
            </div>
        </div>`;
    }

    if (!activePromptsHtml) {
        activePromptsHtml = '<div class="ai-empty">No active extension prompts found.</div>';
    }

    // ---- Build custom instructions section ----
    let customHtml = '';
    for (const instr of instructions) {
        customHtml += buildCustomInstructionCard(instr);
    }

    const html = `
    <div class="ai-container">
        <div class="ai-section">
            <div class="ai-section-title"><i class="fa-solid fa-eye"></i> Active Prompts (read-only)</div>
            <div class="ai-prompt-list">${activePromptsHtml}</div>
        </div>
        <div class="ai-section">
            <div class="ai-section-title"><i class="fa-solid fa-pen-to-square"></i> Custom Instructions</div>
            <div id="ai_custom_list">${customHtml}</div>
            <button id="ai_add_instruction" class="ai-add-btn menu_button">
                <i class="fa-solid fa-plus"></i> Add Instruction
            </button>
        </div>
    </div>`;

    const content = $(html);

    // ---- Wire event handlers ----

    // Collapse/expand active prompts
    content.on('click', '.ai-prompt-header', function () {
        const $item = $(this).closest('.ai-prompt-item');
        const $value = $item.find('.ai-prompt-value');
        const $icon = $item.find('.ai-prompt-toggle');
        $value.slideToggle(150);
        $icon.toggleClass('fa-chevron-down fa-chevron-up');
    });

    // Toggle custom instruction
    content.on('change', '.ai-custom-toggle', function () {
        const id = $(this).closest('.ai-custom-card').data('id');
        const instr = instructions.find(i => i.id === id);
        if (instr) {
            instr.enabled = this.checked;
            injectCustomInstructions();
            saveMetadata();
        }
    });

    // Delete custom instruction
    content.on('click', '.ai-custom-delete', function () {
        const id = $(this).closest('.ai-custom-card').data('id');
        const idx = instructions.findIndex(i => i.id === id);
        if (idx >= 0) {
            const key = `CUSTOM_INSTR_${instructions[idx].id}`;
            instructions.splice(idx, 1);
            setExtensionPrompt(key, '', extension_prompt_types.IN_PROMPT, 0);
            $(this).closest('.ai-custom-card').remove();
            injectCustomInstructions();
            saveMetadata();
        }
    });

    // Edit custom instruction
    content.on('click', '.ai-custom-edit', async function () {
        const id = $(this).closest('.ai-custom-card').data('id');
        const instr = instructions.find(i => i.id === id);
        if (!instr) return;
        const result = await openInstructionEditor(instr.label, instr.text);
        if (result) {
            instr.label = result.label;
            instr.text = result.text;
            // Refresh the card
            const $card = $(this).closest('.ai-custom-card');
            $card.find('.ai-custom-label').text(instr.label);
            $card.find('.ai-custom-preview').text(instr.text.substring(0, 120) + (instr.text.length > 120 ? '…' : ''));
            injectCustomInstructions();
            saveMetadata();
        }
    });

    // Add new instruction
    content.on('click', '#ai_add_instruction', async function () {
        const result = await openInstructionEditor('', '');
        if (result && result.text.trim()) {
            const newInstr = {
                id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                label: result.label || 'Untitled',
                text: result.text,
                enabled: true,
            };
            instructions.push(newInstr);
            content.find('#ai_custom_list').append(buildCustomInstructionCard(newInstr));
            injectCustomInstructions();
            saveMetadata();
        }
    });

    const popup = new Popup(content, POPUP_TYPE.CONFIRM, null, {
        wider: true,
        okButton: 'Close',
        cancelButton: null,
        allowVerticalScrolling: true,
    });
    await popup.show();
}

/**
 * Build HTML for a single custom instruction card.
 * @param {CustomInstruction} instr
 * @returns {string}
 */
function buildCustomInstructionCard(instr) {
    const preview = instr.text.substring(0, 120) + (instr.text.length > 120 ? '…' : '');
    return `
    <div class="ai-custom-card" data-id="${escapeHtml(instr.id)}">
        <label class="ai-custom-toggle-wrap">
            <input type="checkbox" class="ai-custom-toggle" ${instr.enabled ? 'checked' : ''} />
        </label>
        <div class="ai-custom-body">
            <div class="ai-custom-label">${escapeHtml(instr.label || 'Untitled')}</div>
            <div class="ai-custom-preview">${escapeHtml(preview)}</div>
        </div>
        <div class="ai-custom-actions">
            <button class="ai-custom-edit menu_button" title="Edit"><i class="fa-solid fa-pen"></i></button>
            <button class="ai-custom-delete menu_button" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
    </div>`;
}

/**
 * Open a sub-popup to edit/create an instruction.
 * @param {string} initialLabel
 * @param {string} initialText
 * @returns {Promise<{label: string, text: string}|null>}
 */
async function openInstructionEditor(initialLabel, initialText) {
    const editorHtml = `
    <div class="ai-editor">
        <div class="ai-editor-field">
            <label class="ai-editor-label">Label</label>
            <input type="text" id="ai_editor_label" class="text_pole" value="${escapeHtml(initialLabel)}" placeholder="e.g. Combat Rules" />
        </div>
        <div class="ai-editor-field">
            <label class="ai-editor-label">Instruction Text</label>
            <textarea id="ai_editor_text" class="text_pole ai-editor-textarea" placeholder="Enter the instruction text that will be sent as context...">${escapeHtml(initialText)}</textarea>
        </div>
    </div>`;

    const editorContent = $(editorHtml);
    const editorPopup = new Popup(editorContent, POPUP_TYPE.CONFIRM, null, {
        wider: false,
        okButton: 'Save',
        cancelButton: 'Cancel',
        allowVerticalScrolling: true,
    });

    const result = await editorPopup.show();
    if (result !== POPUP_RESULT.AFFIRMATIVE) return null;

    return {
        label: editorContent.find('#ai_editor_label').val()?.toString().trim() || 'Untitled',
        text: editorContent.find('#ai_editor_text').val()?.toString() || '',
    };
}

/**
 * Initialize the Active Instructions button handler.
 */
export function initActiveInstructions() {
    $(document).on('click', '#option_toggle_instructions', function () {
        $('#options').hide();
        openActiveInstructionsPopup();
    });
}
