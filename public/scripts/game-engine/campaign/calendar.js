/**
 * Campaign calendar: days and the slots inside them.
 *
 * The Persona loop needs a clock, and the clock has to be scarce for the loop to mean
 * anything. Spending the afternoon at the forge is only a decision if it costs you the
 * chance to spend it with somebody. So a day holds a fixed number of slots, an activity
 * consumes one, and night rolls the day over.
 *
 * The number and names of the slots are data, so a campaign that wants dawn/dusk or a
 * four-slot day changes the pack rather than this file.
 *
 * Pure module. Nothing here saves or renders.
 *
 * See wiki/ROADMAP.md, Fase D (D1).
 */

export const CALENDAR_SCHEMA_VERSION = 1;

/**
 * The default day. Night is the one that rolls over, which is what makes the evening slot
 * feel different from the others without needing a special case anywhere else.
 */
export const DEFAULT_SLOTS = [
    { id: 'morning', label: 'Mañana', advancesDay: false },
    { id: 'afternoon', label: 'Tarde', advancesDay: false },
    { id: 'night', label: 'Noche', advancesDay: true },
];

/**
 * @typedef {Object} CalendarSlot
 * @property {string} id
 * @property {string} label
 * @property {boolean} advancesDay
 */

/**
 * @typedef {Object} Calendar
 * @property {number} version
 * @property {number} day        1-based.
 * @property {number} slotIndex  Index into the slot list.
 * @property {CalendarSlot[]} slots
 */

/**
 * @param {CalendarSlot[]} [slots]
 * @returns {Calendar}
 */
export function createCalendar(slots = DEFAULT_SLOTS) {
    return {
        version: CALENDAR_SCHEMA_VERSION,
        day: 1,
        slotIndex: 0,
        slots: normalizeSlots(slots),
    };
}

/**
 * @param {any} raw
 * @returns {CalendarSlot[]}
 */
function normalizeSlots(raw) {
    const list = (Array.isArray(raw) ? raw : [])
        .filter(s => s && typeof s.id === 'string' && s.id.trim())
        .map(s => ({
            id: String(s.id),
            label: String(s.label || s.id),
            advancesDay: Boolean(s.advancesDay),
        }));

    if (list.length === 0) return DEFAULT_SLOTS.map(s => ({ ...s }));

    // A day that never ends would trap the campaign in day one for ever.
    if (!list.some(s => s.advancesDay)) {
        list[list.length - 1] = { ...list[list.length - 1], advancesDay: true };
    }

    return list;
}

/**
 * Repairs a calendar read from disk.
 * @param {any} raw
 * @returns {Calendar}
 */
export function normalizeCalendar(raw) {
    if (!raw || typeof raw !== 'object') return createCalendar();

    const slots = normalizeSlots(raw.slots);
    const day = Number.isInteger(raw.day) && raw.day > 0 ? raw.day : 1;
    const rawIndex = Number.isInteger(raw.slotIndex) ? raw.slotIndex : 0;

    return {
        version: CALENDAR_SCHEMA_VERSION,
        day,
        slotIndex: Math.min(Math.max(0, rawIndex), slots.length - 1),
        slots,
    };
}

/**
 * @param {Calendar} calendar
 * @returns {CalendarSlot}
 */
export function getCurrentSlot(calendar) {
    const c = normalizeCalendar(calendar);
    return c.slots[c.slotIndex];
}

/**
 * Spends the current slot.
 *
 * Returns a new calendar plus whether the day turned over, because the caller usually has
 * to do something about that — long rest, upkeep, quest timers.
 *
 * @param {Calendar} calendar
 * @returns {{calendar: Calendar, dayAdvanced: boolean}}
 */
export function advanceSlot(calendar) {
    const c = normalizeCalendar(calendar);
    const current = c.slots[c.slotIndex];

    if (current.advancesDay) {
        return {
            calendar: { ...c, day: c.day + 1, slotIndex: 0 },
            dayAdvanced: true,
        };
    }

    return {
        calendar: { ...c, slotIndex: c.slotIndex + 1 },
        dayAdvanced: false,
    };
}

/**
 * Spends several slots in a row, reporting how many days went by.
 * @param {Calendar} calendar
 * @param {number} count
 * @returns {{calendar: Calendar, daysAdvanced: number}}
 */
export function advanceSlots(calendar, count) {
    let current = normalizeCalendar(calendar);
    let daysAdvanced = 0;

    for (let i = 0; i < Math.max(0, Math.floor(Number(count) || 0)); i++) {
        const result = advanceSlot(current);
        current = result.calendar;
        if (result.dayAdvanced) daysAdvanced += 1;
    }

    return { calendar: current, daysAdvanced };
}

/**
 * Jumps straight to the next day, whatever slot we are on. For a long rest, or for
 * anything that writes off the rest of the day.
 * @param {Calendar} calendar
 * @returns {Calendar}
 */
export function advanceToNextDay(calendar) {
    const c = normalizeCalendar(calendar);
    return { ...c, day: c.day + 1, slotIndex: 0 };
}

/**
 * How many slots remain today, including the current one.
 * @param {Calendar} calendar
 * @returns {number}
 */
export function getRemainingSlots(calendar) {
    const c = normalizeCalendar(calendar);
    return c.slots.length - c.slotIndex;
}

/**
 * A readable stamp for the header and for the prompt.
 * @param {Calendar} calendar
 * @returns {string}
 */
export function formatCalendar(calendar) {
    const c = normalizeCalendar(calendar);
    return `Día ${c.day} · ${c.slots[c.slotIndex].label}`;
}

/**
 * Total slots elapsed since the campaign began. Quest and effect timers count in these
 * rather than in days, so something can expire mid-afternoon.
 * @param {Calendar} calendar
 * @returns {number}
 */
export function getElapsedSlots(calendar) {
    const c = normalizeCalendar(calendar);
    return (c.day - 1) * c.slots.length + c.slotIndex;
}
