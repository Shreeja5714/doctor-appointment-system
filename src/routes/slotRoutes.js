// src/routes/slotRoutes.js
const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const { authorizeRoles } = require('../middlewares/roleMiddleware');
const validate = require('../middlewares/validate');
const {
  validateObjectId,
  validateObjectIdParam,
  validateObjectIdQuery,
  validateDate,
  validateTimezone,
  validateNumber,
} = require('../utils/validation');
const { query } = require('express-validator');
const {
  generateSlots,
  getDoctorSlots,
  getAvailableSlots,
  blockSlot,
  deleteSlot,
} = require('../controllers/slotController');

const router = express.Router();

// POST /api/slots/generate - Generate slots for a doctor (Admin only)
router.post(
  '/generate',
  protect,
  authorizeRoles('admin'),
  [
    validateObjectId('doctorId'),
    validateDate('startDate'),
    validateDate('endDate'),
    validateTimezone(),
    validateNumber('slotDurationMinutes', 5, 480, false),
  ],
  validate,
  generateSlots
);

// GET /api/slots/available - Get available slots (with filters)
// Query params: doctorId, date, startDate, endDate
router.get(
  '/available',
  protect,
  authorizeRoles('admin', 'user'),
  [
    validateObjectIdQuery('doctorId'),
    query('date')
      .optional()
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('Date must be in YYYY-MM-DD format'),
    query('startDate')
      .optional()
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('Start date must be in YYYY-MM-DD format'),
    query('endDate')
      .optional()
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('End date must be in YYYY-MM-DD format'),
  ],
  validate,
  getAvailableSlots
);

// GET /api/slots/doctor/:doctorId - View all slots for a doctor (auth required)
router.get(
  '/doctor/:doctorId',
  protect,
  authorizeRoles('admin', 'user'),
  [
    validateObjectIdParam('doctorId'),
    query('status')
      .optional()
      .isIn(['available', 'booked', 'blocked'])
      .withMessage('Status must be one of: available, booked, blocked'),
  ],
  validate,
  getDoctorSlots
);

// PATCH /api/slots/:slotId/block - Block a specific slot (Admin only)
router.patch(
  '/:slotId/block',
  protect,
  authorizeRoles('admin'),
  [validateObjectIdParam('slotId')],
  validate,
  blockSlot
);

// DELETE /api/slots/:slotId - Delete a slot (Admin only)
router.delete(
  '/:slotId',
  protect,
  authorizeRoles('admin'),
  [validateObjectIdParam('slotId')],
  validate,
  deleteSlot
);

module.exports = router;