// models/Doctor.js
const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // one doctor profile per user
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    specialization: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    // Simple availability/working hours structure
    availability: [
      {
        dayOfWeek: {
          type: Number, // 0=Sunday ... 6=Saturday
          min: 0,
          max: 6,
          required: true,
        },
        startTime: {
          type: String, // e.g. '09:00'
          required: true,
        },
        endTime: {
          type: String, // e.g. '17:00'
          required: true,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Doctor = mongoose.model('Doctor', doctorSchema);
module.exports = Doctor;