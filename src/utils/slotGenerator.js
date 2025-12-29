// src/utils/slotGenerator.js
// Utility to generate time slots for a doctor based on their availability.

const Slot = require('../models/Slot');

// Parse 'HH:mm' -> minutes from midnight
const parseTimeToMinutes = (timeStr) => {
  const [h, m] = timeStr.split(':').map((v) => parseInt(v, 10));
  return h * 60 + m;
};

// Format minutes from midnight -> 'HH:mm'
const formatMinutesToTime = (minutes) => {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

/**
 * Generate slots for a doctor between startDate and endDate (inclusive).
 *
 * @param {Object} options
 * @param {import('../models/Doctor')} options.doctor - Doctor document with availability
 * @param {string|Date} options.startDate - Start date (YYYY-MM-DD or Date)
 * @param {string|Date} options.endDate - End date (YYYY-MM-DD or Date)
 * @param {number} [options.slotDurationMinutes=30] - Duration of each slot
 * @param {string} options.timezone - Timezone string to store with slot (e.g. 'Asia/Kolkata')
 * @returns {Promise<{ createdCount: number }>} Number of created slots
 */
const generateSlotsForDoctor = async ({
  doctor,
  startDate,
  endDate,
  slotDurationMinutes = 30,
  timezone,
}) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Invalid startDate or endDate');
  }

  if (end < start) {
    throw new Error('endDate must be after or equal to startDate');
  }

  const duration = Number(slotDurationMinutes) || 30;

  let createdCount = 0;

  // Iterate each day in the range
  for (
    let current = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    current <= end;
    current.setDate(current.getDate() + 1)
  ) {
    const dayOfWeek = current.getDay(); // 0-6

    const dayAvailability = (doctor.availability || []).filter(
      (slot) => slot.dayOfWeek === dayOfWeek
    );

    for (const avail of dayAvailability) {
      const startMinutes = parseTimeToMinutes(avail.startTime);
      const endMinutes = parseTimeToMinutes(avail.endTime);

      for (
        let t = startMinutes;
        t + duration <= endMinutes;
        t += duration
      ) {
        const slotStartTime = formatMinutesToTime(t);
        const slotEndTime = formatMinutesToTime(t + duration);

        // Date in DB will represent the day; time is stored separately as strings
        const dateOnly = new Date(
          current.getFullYear(),
          current.getMonth(),
          current.getDate()
        );

        // Use upsert-style behaviour to avoid duplicate key errors
        const result = await Slot.updateOne(
          {
            doctorId: doctor._id,
            date: dateOnly,
            startTime: slotStartTime,
          },
          {
            $setOnInsert: {
              doctorId: doctor._id,
              date: dateOnly,
              startTime: slotStartTime,
              endTime: slotEndTime,
              status: 'available',
              timezone,
            },
          },
          { upsert: true }
        );

        // If a new document was inserted, increment count
        if (result.upsertedCount && result.upsertedCount > 0) {
          createdCount += result.upsertedCount;
        }
      }
    }
  }

  return { createdCount };
};

module.exports = {
  generateSlotsForDoctor,
};