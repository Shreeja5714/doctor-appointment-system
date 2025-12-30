// src/controllers/doctorController.js
const mongoose = require('mongoose');
const Doctor = require('../models/Doctor');
const User = require('../models/User');
const { getPaginationParams } = require('../utils/pagination');

// POST /api/doctors - Create a doctor profile (Admin only)
// Body: { userId, name, specialization, email, availability? }
const createDoctor = async (req, res) => {
  // Safely handle cases where req.body is undefined or not an object
  const { userId, name, specialization, email, availability } = req.body || {};

  if (!userId || !name || !specialization || !email) {
    return res.status(400).json({
      success: false,
      message: 'userId, name, specialization and email are required',
    });
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid userId',
    });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found for given userId',
      });
    }

    const existingDoctor = await Doctor.findOne({ userId });
    if (existingDoctor) {
      return res.status(400).json({
        success: false,
        message: 'Doctor profile already exists for this user',
      });
    }

    const doctor = await Doctor.create({
      userId,
      name,
      specialization,
      email,
      availability,
    });

    return res.status(201).json({
      success: true,
      data: doctor,
    });
  } catch (err) {
    console.error('Create doctor error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating doctor',
    });
  }
};

// GET /api/doctors - Get all doctors
const getDoctors = async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req.query);

  try {
    const [total, doctors] = await Promise.all([
      Doctor.countDocuments(),
      Doctor.find()
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      page,
      limit,
      total,
      count: doctors.length,
      data: doctors,
    });
  } catch (err) {
    console.error('Get doctors error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching doctors',
    });
  }
};

// GET /api/doctors/:id - Get a single doctor by id
const getDoctorById = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid doctor id',
    });
  }

  try {
    const doctor = await Doctor.findById(id).lean();

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: doctor,
    });
  } catch (err) {
    console.error('Get doctor by id error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching doctor',
    });
  }
};

module.exports = {
  createDoctor,
  getDoctors,
  getDoctorById,
};
