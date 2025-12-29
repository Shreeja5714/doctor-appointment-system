// src/controllers/bookingController.js
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Slot = require('../models/Slot');
const Doctor = require('../models/Doctor');

// POST /api/bookings - Create a booking (User)
// Body: { slotId }
const createBooking = async (req, res) => {
  if (!req.body) {
    return res.status(400).json({
      success: false,
      message: 'Request body is required',
    });
  }

  const { slotId } = req.body;
  const userId = req.user._id; // From auth middleware

  if (!slotId) {
    return res.status(400).json({
      success: false,
      message: 'slotId is required',
    });
  }

  if (!mongoose.Types.ObjectId.isValid(slotId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid slotId',
    });
  }

  try {
    // Find the slot
    const slot = await Slot.findById(slotId);
    if (!slot) {
      return res.status(404).json({
        success: false,
        message: 'Slot not found',
      });
    }

    // Double booking prevention: Check if slot is already booked
    if (slot.status !== 'available') {
      return res.status(400).json({
        success: false,
        message: 'Slot is not available for booking',
      });
    }

    // Additional check: Verify no active booking exists for this slot
    const existingBooking = await Booking.findOne({
      slotId,
      bookingStatus: { $in: ['pending', 'confirmed'] },
    });

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message: 'Slot is already booked',
      });
    }

    // Verify doctor exists
    const doctor = await Doctor.findById(slot.doctorId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found',
      });
    }

    // Create booking using transaction to prevent race conditions
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update slot status to 'booked'
      slot.status = 'booked';
      await slot.save({ session });

      // Create the booking
      const booking = await Booking.create(
        [
          {
            userId,
            slotId,
            doctorId: slot.doctorId,
            bookingStatus: 'confirmed',
          },
        ],
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      // Populate references for response
      const populatedBooking = await Booking.findById(booking[0]._id)
        .populate('userId', 'name email')
        .populate('slotId')
        .populate('doctorId', 'name specialization email');

      return res.status(201).json({
        success: true,
        message: 'Booking created successfully',
        data: populatedBooking,
      });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } catch (err) {
    console.error('Create booking error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating booking',
    });
  }
};

// GET /api/bookings/my-bookings - Get user's bookings (User)
const getMyBookings = async (req, res) => {
  const userId = req.user._id;

  try {
    const bookings = await Booking.find({ userId })
      .populate('slotId')
      .populate('doctorId', 'name specialization email')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (err) {
    console.error('Get my bookings error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching bookings',
    });
  }
};

// GET /api/bookings - Get all bookings (Admin)
const getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('userId', 'name email')
      .populate('slotId')
      .populate('doctorId', 'name specialization email')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (err) {
    console.error('Get all bookings error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching bookings',
    });
  }
};

// PATCH /api/bookings/:id/cancel - Cancel booking (User/Admin)
const cancelBooking = async (req, res) => {
  const { id } = req.params;
  const { cancellationReason } = req.body || {};
  const userId = req.user._id;
  const userRole = req.user.role;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid booking ID',
    });
  }

  try {
    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Check permissions: User can only cancel their own bookings, Admin can cancel any
    if (userRole !== 'admin' && booking.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this booking',
      });
    }

    // Check if booking can be cancelled
    if (booking.bookingStatus === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Booking is already cancelled',
      });
    }

    if (booking.bookingStatus === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a completed booking',
      });
    }

    // Use transaction to ensure slot status is updated
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update booking status
      booking.bookingStatus = 'cancelled';
      if (cancellationReason) {
        booking.cancellationReason = cancellationReason;
      }
      await booking.save({ session });

      // Update slot status back to 'available'
      const slot = await Slot.findById(booking.slotId);
      if (slot) {
        slot.status = 'available';
        await slot.save({ session });
      }

      await session.commitTransaction();
      session.endSession();

      const populatedBooking = await Booking.findById(id)
        .populate('userId', 'name email')
        .populate('slotId')
        .populate('doctorId', 'name specialization email');

      return res.status(200).json({
        success: true,
        message: 'Booking cancelled successfully',
        data: populatedBooking,
      });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } catch (err) {
    console.error('Cancel booking error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while cancelling booking',
    });
  }
};

// PATCH /api/bookings/:id/reschedule - Reschedule booking (User)
// Body: { newSlotId }
const rescheduleBooking = async (req, res) => {
  if (!req.body) {
    return res.status(400).json({
      success: false,
      message: 'Request body is required',
    });
  }

  const { id } = req.params;
  const { newSlotId } = req.body;
  const userId = req.user._id;

  if (!newSlotId) {
    return res.status(400).json({
      success: false,
      message: 'newSlotId is required',
    });
  }

  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(newSlotId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid booking ID or slot ID',
    });
  }

  try {
    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Check if user owns this booking
    if (booking.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to reschedule this booking',
      });
    }

    // Check if booking can be rescheduled
    if (booking.bookingStatus === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot reschedule a cancelled booking',
      });
    }

    if (booking.bookingStatus === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot reschedule a completed booking',
      });
    }

    // Check if new slot exists and is available
    const newSlot = await Slot.findById(newSlotId);
    if (!newSlot) {
      return res.status(404).json({
        success: false,
        message: 'New slot not found',
      });
    }

    if (newSlot.status !== 'available') {
      return res.status(400).json({
        success: false,
        message: 'New slot is not available',
      });
    }

    // Double booking prevention: Check if new slot is already booked
    const existingBooking = await Booking.findOne({
      slotId: newSlotId,
      bookingStatus: { $in: ['pending', 'confirmed'] },
      _id: { $ne: id }, // Exclude current booking
    });

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message: 'New slot is already booked',
      });
    }

    // Verify new slot belongs to the same doctor
    if (newSlot.doctorId.toString() !== booking.doctorId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'New slot must belong to the same doctor',
      });
    }

    // Use transaction to ensure both slots are updated correctly
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Free up old slot
      const oldSlot = await Slot.findById(booking.slotId);
      if (oldSlot) {
        oldSlot.status = 'available';
        await oldSlot.save({ session });
      }

      // Book new slot
      newSlot.status = 'booked';
      await newSlot.save({ session });

      // Update booking
      booking.slotId = newSlotId;
      await booking.save({ session });

      await session.commitTransaction();
      session.endSession();

      const populatedBooking = await Booking.findById(id)
        .populate('userId', 'name email')
        .populate('slotId')
        .populate('doctorId', 'name specialization email');

      return res.status(200).json({
        success: true,
        message: 'Booking rescheduled successfully',
        data: populatedBooking,
      });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } catch (err) {
    console.error('Reschedule booking error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while rescheduling booking',
    });
  }
};

// PATCH /api/bookings/:id/complete - Mark as completed (Admin)
const completeBooking = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid booking ID',
    });
  }

  try {
    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    if (booking.bookingStatus === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Booking is already completed',
      });
    }

    if (booking.bookingStatus === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot complete a cancelled booking',
      });
    }

    booking.bookingStatus = 'completed';
    await booking.save();

    const populatedBooking = await Booking.findById(id)
      .populate('userId', 'name email')
      .populate('slotId')
      .populate('doctorId', 'name specialization email');

    return res.status(200).json({
      success: true,
      message: 'Booking marked as completed',
      data: populatedBooking,
    });
  } catch (err) {
    console.error('Complete booking error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while completing booking',
    });
  }
};

module.exports = {
  createBooking,
  getMyBookings,
  getAllBookings,
  cancelBooking,
  rescheduleBooking,
  completeBooking,
};

