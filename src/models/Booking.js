// models/Booking.js
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    slotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Slot',
      required: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    bookingStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed', 'expired'],
      default: 'pending',
    },
    bookingDate: {
      type: Date,
      default: Date.now,
    },
    cancellationReason: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// Ensure at most one *active* (pending/confirmed) booking exists per slot.
// This is a partial unique index so that cancelled/completed/expired bookings
// do not block future bookings for the same slot.
bookingSchema.index(
  { slotId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      bookingStatus: { $in: ['pending', 'confirmed'] },
    },
  }
);

const Booking = mongoose.model('Booking', bookingSchema);
module.exports = Booking;
