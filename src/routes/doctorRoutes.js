// src/routes/doctorRoutes.js
const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const { authorizeRoles } = require('../middlewares/roleMiddleware');
const {
  createDoctor,
  getDoctors,
  getDoctorById,
} = require('../controllers/doctorController');

const router = express.Router();

// POST /api/doctors - Create doctor (Admin only)
router.post('/', protect, authorizeRoles('admin'), createDoctor);

// GET /api/doctors - Get all doctors (Admin & User)
router.get('/', protect, authorizeRoles('admin', 'user'), getDoctors);

// GET /api/doctors/:id - Get doctor by id (Admin & User)
router.get('/:id', protect, authorizeRoles('admin', 'user'), getDoctorById);

module.exports = router;
