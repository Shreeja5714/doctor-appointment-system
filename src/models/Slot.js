// models/Slot.js
const mongoose = require('mongoose');

const slotSchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    date: {
      type: Date, // date of the appointment (no time semantics beyond this)
      required: true,
    },
    startTime: {
      type: String, // 'HH:mm' or full ISO time string; up to you
      required: true,
    },
    endTime: {
      type: String, // 'HH:mm'
      required: true,
    },
    status: {
      type: String,
      enum: ['available', 'booked', 'blocked'],
      default: 'available',
    },
    timezone: {
      type: String,
      required: true, // e.g. 'Asia/Kolkata', 'America/New_York'
    },
  },
  {
    timestamps: true,
  }
);

// Important: Unique index on (doctorId + date + startTime)
slotSchema.index(
  { doctorId: 1, date: 1, startTime: 1 },
  { unique: true }
);

const Slot = mongoose.model('Slot', slotSchema);
module.exports = Slot;