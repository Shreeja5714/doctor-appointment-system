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

const Booking = mongoose.model('Booking', bookingSchema);
module.exports = Booking;