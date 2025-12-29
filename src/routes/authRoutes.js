// src/routes/authRoutes.js
const express = require('express');
const { register, login, getMe } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');
const { authorizeRoles } = require('../middlewares/roleMiddleware');
const validate = require('../middlewares/validate');
const {
  validateEmail,
  validatePassword,
  validateString,
  validateEnum,
} = require('../utils/validation');

const router = express.Router();

// POST /api/auth/register - User registration
router.post(
  '/register',
  [
    validateString('name', 1, 100),
    validateEmail(),
    validatePassword(),
    validateEnum('role', ['admin', 'user'], false),
  ],
  validate,
  register
);

// POST /api/auth/login - User login
router.post(
  '/login',
  [validateEmail(), validateString('password')],
  validate,
  login
);

// GET /api/auth/me - Get current user (protected)
router.get('/me', protect, getMe);

// GET /api/auth/admin-only - Example protected, role-based route (admin only)
router.get('/admin-only', protect, authorizeRoles('admin'), (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Welcome, admin!',
    data: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
  });
});

module.exports = router;
