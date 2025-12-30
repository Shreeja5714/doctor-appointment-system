// src/routes/doctorRoutes.js
const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const { authorizeRoles } = require('../middlewares/roleMiddleware');
const validate = require('../middlewares/validate');
const {
  validateObjectId,
  validateObjectIdParam,
  validateString,
  validateEmail,
  validateTime,
} = require('../utils/validation');
const { body, query } = require('express-validator');
const {
  createDoctor,
  getDoctors,
  getDoctorById,
} = require('../controllers/doctorController');

const router = express.Router();

// POST /api/doctors - Create doctor (Admin only)
router.post(
  '/',
  protect,
  authorizeRoles('admin'),
  [
    validateString('name', 1, 100),
    validateEmail(),
    validateString('specialization', 1, 100),
    body('availability')
      .isArray({ min: 1 })
      .withMessage('Availability must be an array with at least one item'),
    body('availability.*.dayOfWeek')
      .isInt({ min: 0, max: 6 })
      .withMessage('dayOfWeek must be a number between 0 (Sunday) and 6 (Saturday)'),
    body('availability.*.startTime').custom((value) => {
      if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
        throw new Error('startTime must be in HH:MM format (24-hour)');
      }
      return true;
    }),
    body('availability.*.endTime').custom((value) => {
      if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
        throw new Error('endTime must be in HH:MM format (24-hour)');
      }
      return true;
    }),
    body('availability.*').custom((value) => {
      const start = value.startTime.split(':').map(Number);
      const end = value.endTime.split(':').map(Number);
      const startMinutes = start[0] * 60 + start[1];
      const endMinutes = end[0] * 60 + end[1];
      if (endMinutes <= startMinutes) {
        throw new Error('endTime must be after startTime');
      }
      return true;
    }),
  ],
  validate,
  createDoctor
);

// GET /api/doctors - Get all doctors (Admin & User)
router.get(
  '/',
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
  getDoctors
);

// GET /api/doctors/:id - Get doctor by id (Admin & User)
router.get(
  '/:id',
  protect,
  authorizeRoles('admin', 'user'),
  [validateObjectIdParam('id')],
  validate,
  getDoctorById
);

module.exports = router;
