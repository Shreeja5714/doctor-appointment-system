// src/utils/validation.js
// Reusable Validation Rules using express-validator

const { body, param, query } = require('express-validator');
const mongoose = require('mongoose');

// Email validation
const validateEmail = (field = 'email') => {
  return body(field)
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail();
};

// Password validation with strength requirements
// Set strong=true for strong password requirements, false for basic (min 6 chars)
const validatePassword = (field = 'password', isRequired = true, strong = false) => {
  let validation = body(field)
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long');

  if (strong) {
    validation = validation
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage(
        'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      );
  }

  if (isRequired) {
    return validation.notEmpty().withMessage('Password is required');
  }
  return validation.optional();
};

// Date validation (ISO 8601 format: YYYY-MM-DD)
const validateDate = (field = 'date', isRequired = true) => {
  const validation = body(field)
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Date must be in YYYY-MM-DD format (ISO 8601)')
    .custom((value) => {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid date');
      }
      return true;
    });

  if (isRequired) {
    return validation.notEmpty().withMessage(`${field} is required`);
  }
  return validation.optional();
};

// Date range validation
const validateDateRange = (startField = 'startDate', endField = 'endDate') => {
  return [
    validateDate(startField),
    validateDate(endField),
    body(endField).custom((endDate, { req }) => {
      if (endDate && req.body[startField]) {
        const start = new Date(req.body[startField]);
        const end = new Date(endDate);
        if (end < start) {
          throw new Error(`${endField} must be after or equal to ${startField}`);
        }
      }
      return true;
    }),
  ];
};

// Time validation (HH:MM format, 24-hour)
const validateTime = (field = 'time', isRequired = true) => {
  const validation = body(field)
    .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Time must be in HH:MM format (24-hour)')
    .custom((value) => {
      const [hours, minutes] = value.split(':');
      const hour = parseInt(hours, 10);
      const minute = parseInt(minutes, 10);
      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        throw new Error('Invalid time value');
      }
      return true;
    });

  if (isRequired) {
    return validation.notEmpty().withMessage(`${field} is required`);
  }
  return validation.optional();
};

// MongoDB ObjectId validation
const validateObjectId = (field = 'id', location = 'body') => {
  const validator = location === 'param' ? param : location === 'query' ? query : body;

  return validator(field)
    .notEmpty()
    .withMessage(`${field} is required`)
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error(`Invalid ${field} format`);
      }
      return true;
    });
};

// MongoDB ObjectId in params (for route parameters)
const validateObjectIdParam = (field = 'id') => {
  return validateObjectId(field, 'param');
};

// MongoDB ObjectId in query
const validateObjectIdQuery = (field = 'id') => {
  return validateObjectId(field, 'query');
};

// String validation (required)
const validateString = (field, minLength = 1, maxLength = undefined) => {
  let validation = body(field)
    .trim()
    .notEmpty()
    .withMessage(`${field} is required`);

  if (minLength > 0) {
    validation = validation
      .isLength({ min: minLength })
      .withMessage(`${field} must be at least ${minLength} characters`);
  }

  if (maxLength) {
    validation = validation
      .isLength({ max: maxLength })
      .withMessage(`${field} must be at most ${maxLength} characters`);
  }

  return validation;
};

// Optional string validation
const validateOptionalString = (field, minLength = 0, maxLength = undefined) => {
  let validation = body(field).optional().trim();

  if (minLength > 0) {
    validation = validation.isLength({ min: minLength });
  }

  if (maxLength) {
    validation = validation.isLength({ max: maxLength });
  }

  return validation;
};

// Number validation
const validateNumber = (field, min = undefined, max = undefined, isRequired = true) => {
  let validation = body(field)
    .isNumeric()
    .withMessage(`${field} must be a number`)
    .toInt();

  if (min !== undefined) {
    validation = validation
      .isInt({ min })
      .withMessage(`${field} must be at least ${min}`);
  }

  if (max !== undefined) {
    validation = validation
      .isInt({ max })
      .withMessage(`${field} must be at most ${max}`);
  }

  if (isRequired) {
    return validation.notEmpty().withMessage(`${field} is required`);
  }
  return validation.optional();
};

// Enum validation
const validateEnum = (field, values, isRequired = true) => {
  const validation = body(field)
    .isIn(values)
    .withMessage(`${field} must be one of: ${values.join(', ')}`);

  if (isRequired) {
    return validation.notEmpty().withMessage(`${field} is required`);
  }
  return validation.optional();
};

// Timezone validation (basic check)
const validateTimezone = (field = 'timezone', isRequired = true) => {
  const validation = body(field)
    .matches(/^[A-Za-z_]+\/[A-Za-z_]+$/)
    .withMessage(
      'Timezone must be in format: Continent/City (e.g., Asia/Kolkata, America/New_York)'
    );

  if (isRequired) {
    return validation.notEmpty().withMessage(`${field} is required`);
  }
  return validation.optional();
};

module.exports = {
  validateEmail,
  validatePassword,
  validateDate,
  validateDateRange,
  validateTime,
  validateObjectId,
  validateObjectIdParam,
  validateObjectIdQuery,
  validateString,
  validateOptionalString,
  validateNumber,
  validateEnum,
  validateTimezone,
};

