// src/middlewares/validate.js
// Validation Middleware Wrapper for express-validator

const { validationResult } = require('express-validator');
const { handleValidationError } = require('./errorHandler');

/**
 * Middleware to handle validation errors from express-validator
 * Should be placed after the validation rules in the route
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = handleValidationError(errors);
    return next(error);
  }

  next();
};

module.exports = validate;



