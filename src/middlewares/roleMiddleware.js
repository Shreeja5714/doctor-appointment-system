// src/middlewares/roleMiddleware.js

/**
 * Role-based authorization middleware.
 * Use AFTER `protect` so that `req.user` is already populated.
 *
 * Example:
 *   router.post('/admin-only', protect, authorizeRoles('admin'), handler);
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    // `protect` middleware should have attached the user
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, user not authenticated',
      });
    }

    const userRole = req.user.role;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: insufficient permissions',
      });
    }

    next();
  };
};

module.exports = {
  authorizeRoles,
};