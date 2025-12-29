// src/controllers/slotController.js
const mongoose = require('mongoose');
const Doctor = require('../models/Doctor');
const Slot = require('../models/Slot');
const { generateSlotsForDoctor } = require('../utils/slotGenerator');

// POST /api/slots/generate - Generate slots for a doctor (Admin only)
// Body: { doctorId, startDate, endDate, slotDurationMinutes?, timezone }
const generateSlots = async (req, res) => {
  if (!req.body) {
    return res.status(400).json({
      success: false,
      message: 'Request body is required',
    });
  }

  const { doctorId, startDate, endDate, slotDurationMinutes, timezone } =
    req.body;

  if (!doctorId || !startDate || !endDate || !timezone) {
    return res.status(400).json({
      success: false,
      message:
        'doctorId, startDate, endDate and timezone are required to generate slots',
    });
  }

  try {
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found',
      });
    }

    const { createdCount } = await generateSlotsForDoctor({
      doctor,
      startDate,
      endDate,
      slotDurationMinutes,
      timezone,
    });

    return res.status(201).json({
      success: true,
      message: `Generated ${createdCount} slots for doctor`,
      data: { createdCount },
    });
  } catch (err) {
    console.error('Generate slots error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while generating slots',
    });
  }
};

// GET /api/slots/doctor/:doctorId - View all slots for a doctor
// Optional query params: ?status=available|booked|blocked
const getDoctorSlots = async (req, res) => {
  const { doctorId } = req.params;
  const { status } = req.query;

  if (!mongoose.Types.ObjectId.isValid(doctorId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid doctorId',
    });
  }

  const filter = { doctorId };
  if (status) {
    filter.status = status;
  }

  try {
    const slots = await Slot.find(filter)
      .sort({ date: 1, startTime: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: slots.length,
      data: slots,
    });
  } catch (err) {
    console.error('Get doctor slots error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching slots',
    });
  }
};

// PATCH /api/slots/:slotId/block - Block a specific slot (Admin)
const blockSlot = async (req, res) => {
  const { slotId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(slotId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid slotId',
    });
  }

  try {
    const slot = await Slot.findById(slotId);

    if (!slot) {
      return res.status(404).json({
        success: false,
        message: 'Slot not found',
      });
    }

    slot.status = 'blocked';
    await slot.save();

    return res.status(200).json({
      success: true,
      message: 'Slot blocked successfully',
      data: slot,
    });
  } catch (err) {
    console.error('Block slot error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while blocking slot',
    });
  }
};

// GET /api/slots/available - Get available slots (with filters)
// Query params: doctorId, date, startDate, endDate
const getAvailableSlots = async (req, res) => {
  const { doctorId, date, startDate, endDate } = req.query;

  try {
    // Build filter - always filter by status 'available'
    const filter = { status: 'available' };

    // Filter by doctorId if provided
    if (doctorId) {
      if (!mongoose.Types.ObjectId.isValid(doctorId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid doctorId',
        });
      }
      filter.doctorId = doctorId;
    }

    // Filter by date if provided (specific date)
    if (date) {
      const dateObj = new Date(date);
      if (Number.isNaN(dateObj.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format. Use YYYY-MM-DD',
        });
      }
      // Set to start and end of day for comparison
      const startOfDay = new Date(dateObj);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(dateObj);
      endOfDay.setHours(23, 59, 59, 999);
      filter.date = {
        $gte: startOfDay,
        $lte: endOfDay,
      };
    } else if (startDate || endDate) {
      // Filter by date range if startDate or endDate is provided
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid date format. Use YYYY-MM-DD',
          });
        }
        if (end < start) {
          return res.status(400).json({
            success: false,
            message: 'endDate must be after or equal to startDate',
          });
        }
        // Set to start and end of day
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        filter.date = {
          $gte: start,
          $lte: end,
        };
      } else if (startDate) {
        const start = new Date(startDate);
        if (Number.isNaN(start.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid startDate format. Use YYYY-MM-DD',
          });
        }
        start.setHours(0, 0, 0, 0);
        filter.date = { $gte: start };
      } else if (endDate) {
        const end = new Date(endDate);
        if (Number.isNaN(end.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid endDate format. Use YYYY-MM-DD',
          });
        }
        end.setHours(23, 59, 59, 999);
        filter.date = { $lte: end };
      }
    }

    const slots = await Slot.find(filter)
      .sort({ date: 1, startTime: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: slots.length,
      data: slots,
    });
  } catch (err) {
    console.error('Get available slots error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching available slots',
    });
  }
};

// DELETE /api/slots/:slotId - Delete a slot (Admin)
const deleteSlot = async (req, res) => {
  const { slotId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(slotId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid slotId',
    });
  }

  try {
    const slot = await Slot.findByIdAndDelete(slotId);

    if (!slot) {
      return res.status(404).json({
        success: false,
        message: 'Slot not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Slot deleted successfully',
    });
  } catch (err) {
    console.error('Delete slot error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting slot',
    });
  }
};

module.exports = {
  generateSlots,
  getDoctorSlots,
  getAvailableSlots,
  blockSlot,
  deleteSlot,
};