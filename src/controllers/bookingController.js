// src/controllers/bookingController.js
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Slot = require('../models/Slot');
const Doctor = require('../models/Doctor');
const { isSlotInPast } = require('../utils/time');
const { getPaginationParams } = require('../utils/pagination');

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

    // Time-based guard: don't allow booking past slots
    if (isSlotInPast(slot)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot book a slot in the past',
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

      // Handle potential duplicate key error from partial unique index on slotId
      if (err && err.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Slot is already booked',
        });
      }

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
  const { page, limit, skip } = getPaginationParams(req.query);

  try {
    const [total, bookings] = await Promise.all([
      Booking.countDocuments({ userId }),
      Booking.find({ userId })
        .populate('slotId')
        .populate('doctorId', 'name specialization email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      page,
      limit,
      total,
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
  const { page, limit, skip } = getPaginationParams(req.query);

  try {
    const [total, bookings] = await Promise.all([
      Booking.countDocuments(),
      Booking.find()
        .populate('userId', 'name email')
        .populate('slotId')
        .populate('doctorId', 'name specialization email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      page,
      limit,
      total,
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

    if (booking.bookingStatus === 'expired') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel an expired booking',
      });
    }

    // Check if associated slot is already in the past
    const currentSlot = await Slot.findById(booking.slotId);
    if (currentSlot && isSlotInPast(currentSlot)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a booking for a past slot',
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

    if (booking.bookingStatus === 'expired') {
      return res.status(400).json({
        success: false,
        message: 'Cannot reschedule an expired booking',
      });
    }

    // Prevent rescheduling if current slot is already in the past
    const currentSlot = await Slot.findById(booking.slotId);
    if (currentSlot && isSlotInPast(currentSlot)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot reschedule a booking for a past slot',
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

    // Time-based guard: new slot cannot be in the past
    if (isSlotInPast(newSlot)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot reschedule to a past slot',
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
    const booking = await Booking.findById(id).populate('slotId');
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

    if (booking.bookingStatus === 'expired') {
      return res.status(400).json({
        success: false,
        message: 'Cannot complete an expired booking',
      });
    }

    // Enforce time-based completion: only allow completing past slots
    if (booking.slotId && !isSlotInPast(booking.slotId)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot complete a booking for a future slot',
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

// PATCH /api/bookings/expire-past - Mark eligible pending/confirmed bookings as expired (Admin)
const expirePastBookings = async (req, res) => {
  try {
    // Load bookings that are still active
    const activeBookings = await Booking.find({
      bookingStatus: { $in: ['pending', 'confirmed'] },
    }).populate('slotId');

    const toExpireIds = activeBookings
      .filter((booking) => booking.slotId && isSlotInPast(booking.slotId))
      .map((booking) => booking._id);

    if (toExpireIds.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No bookings to expire',
        count: 0,
      });
    }

    const result = await Booking.updateMany(
      { _id: { $in: toExpireIds } },
      { $set: { bookingStatus: 'expired' } }
    );

    return res.status(200).json({
      success: true,
      message: 'Expired past bookings successfully',
      count: result.modifiedCount || 0,
    });
  } catch (err) {
    console.error('Expire past bookings error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while expiring bookings',
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
  expirePastBookings,
};



