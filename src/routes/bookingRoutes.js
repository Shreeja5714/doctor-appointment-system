// src/routes/bookingRoutes.js
const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const { authorizeRoles } = require('../middlewares/roleMiddleware');
const {
  createBooking,
  getMyBookings,
  getAllBookings,
  cancelBooking,
  rescheduleBooking,
  completeBooking,
} = require('../controllers/bookingController');

const router = express.Router();

// POST /api/bookings - Create a booking (User)
router.post('/', protect, authorizeRoles('admin', 'user'), createBooking);

// GET /api/bookings/my-bookings - Get user's bookings (User)
// This must come before the generic GET / route to avoid route conflicts
router.get('/my-bookings', protect, authorizeRoles('admin', 'user'), getMyBookings);

// GET /api/bookings - Get all bookings (Admin)
router.get('/', protect, authorizeRoles('admin'), getAllBookings);

// PATCH /api/bookings/:id/cancel - Cancel booking (User/Admin)
router.patch('/:id/cancel', protect, authorizeRoles('admin', 'user'), cancelBooking);

// PATCH /api/bookings/:id/reschedule - Reschedule booking (User)
router.patch('/:id/reschedule', protect, authorizeRoles('admin', 'user'), rescheduleBooking);

// PATCH /api/bookings/:id/complete - Mark as completed (Admin)
router.patch('/:id/complete', protect, authorizeRoles('admin'), completeBooking);

module.exports = router;

