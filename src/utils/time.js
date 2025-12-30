// src/utils/time.js
// Time-based helpers for working with slots and bookings.

/**
 * Parse an 'HH:mm' time string into { hours, minutes }.
 */
const parseTimeString = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const [h, m] = timeStr.split(':').map((v) => parseInt(v, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return { hours: h, minutes: m };
};

/**
 * Build a Date from a Date-only value and a 'HH:mm' time string.
 *
 * Note: For simplicity, this uses the server's local timezone. The Slot
 * model still stores a "timezone" string for clients; we don't do
 * full timezone math here to keep this beginner/intermediate-level.
 */
const buildDateTime = (dateValue, timeStr) => {
  if (!dateValue) return null;
  const base = new Date(dateValue);
  if (Number.isNaN(base.getTime())) return null;

  const parsed = parseTimeString(timeStr);
  if (!parsed) return null;

  const dateTime = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  dateTime.setHours(parsed.hours, parsed.minutes, 0, 0);
  return dateTime;
};

/**
 * Determine if a slot is strictly in the past, based on its date and endTime.
 *
 * @param {Object} slot - Slot document or plain object with { date, startTime, endTime }.
 * @returns {boolean}
 */
const isSlotInPast = (slot) => {
  if (!slot || !slot.date) return false;

  // Use endTime when available; fall back to startTime.
  const timeStr = slot.endTime || slot.startTime;
  const dateTime = buildDateTime(slot.date, timeStr);
  if (!dateTime) return false;

  return dateTime.getTime() < Date.now();
};

module.exports = {
  parseTimeString,
  buildDateTime,
  isSlotInPast,
};
