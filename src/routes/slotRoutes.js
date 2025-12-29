// src/routes/slotRoutes.js
const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const { authorizeRoles } = require('../middlewares/roleMiddleware');
const {
  generateSlots,
  getDoctorSlots,
  getAvailableSlots,
  blockSlot,
  deleteSlot,
} = require('../controllers/slotController');

const router = express.Router();

// POST /api/slots/generate - Generate slots for a doctor (Admin only)
router.post('/generate', protect, authorizeRoles('admin'), generateSlots);

// GET /api/slots/available - Get available slots (with filters)
// Query params: doctorId, date, startDate, endDate
router.get(
  '/available',
  protect,
  authorizeRoles('admin', 'user'),
  getAvailableSlots
);

// GET /api/slots/doctor/:doctorId - View all slots for a doctor (auth required)
// Accessible to both admin and regular users; adjust roles as needed.
router.get(
  '/doctor/:doctorId',
  protect,
  authorizeRoles('admin', 'user'),
  getDoctorSlots
);

// PATCH /api/slots/:slotId/block - Block a specific slot (Admin only)
router.patch('/:slotId/block', protect, authorizeRoles('admin'), blockSlot);

// DELETE /api/slots/:slotId - Delete a slot (Admin only)
router.delete('/:slotId', protect, authorizeRoles('admin'), deleteSlot);

module.exports = router;