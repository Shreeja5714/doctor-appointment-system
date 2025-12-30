// src/routes/bookingRoutes.js
const express = require('express');
const { query } = require('express-validator');
const { protect } = require('../middlewares/authMiddleware');
const { authorizeRoles } = require('../middlewares/roleMiddleware');
const validate = require('../middlewares/validate');
const {
  validateObjectId,
  validateObjectIdParam,
  validateOptionalString,
} = require('../utils/validation');
const {
  createBooking,
  getMyBookings,
  getAllBookings,
  cancelBooking,
  rescheduleBooking,
  completeBooking,
  expirePastBookings,
} = require('../controllers/bookingController');

const router = express.Router();

// POST /api/bookings - Create a booking (User)
router.post(
  '/',
  protect,
  authorizeRoles('admin', 'user'),
  [validateObjectId('slotId')],
  validate,
  createBooking
);

// GET /api/bookings/my-bookings - Get user's bookings (User)
// This must come before the generic GET / route to avoid route conflicts
router.get(
  '/my-bookings',
  protect,
  authorizeRoles('admin', 'user'),
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('limit must be between 1 and 50'),
  ],
  validate,
  getMyBookings
);

// GET /api/bookings - Get all bookings (Admin)
router.get(
  '/',
  protect,
  authorizeRoles('admin'),
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('limit must be between 1 and 50'),
  ],
  validate,
  getAllBookings
);

// PATCH /api/bookings/:id/cancel - Cancel booking (User/Admin)
router.patch(
  '/:id/cancel',
  protect,
  authorizeRoles('admin', 'user'),
  [validateObjectIdParam('id'), validateOptionalString('cancellationReason')],
  validate,
  cancelBooking
);

// PATCH /api/bookings/:id/reschedule - Reschedule booking (User)
router.patch(
  '/:id/reschedule',
  protect,
  authorizeRoles('admin', 'user'),
  [validateObjectIdParam('id'), validateObjectId('newSlotId')],
  validate,
  rescheduleBooking
);

// PATCH /api/bookings/:id/complete - Mark as completed (Admin)
router.patch(
  '/:id/complete',
  protect,
  authorizeRoles('admin'),
  [validateObjectIdParam('id')],
  validate,
  completeBooking
);

// PATCH /api/bookings/expire-past - Mark eligible bookings as expired (Admin)
router.patch(
  '/expire-past',
  protect,
  authorizeRoles('admin'),
  expirePastBookings
);

module.exports = router;

