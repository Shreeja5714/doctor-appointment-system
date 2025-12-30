// src/utils/pagination.js
// Helper for handling page/limit pagination parameters.

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

/**
 * Compute pagination parameters from an Express query object.
 *
 * @param {Object} query
 * @returns {{ page: number, limit: number, skip: number }}
 */
const getPaginationParams = (query = {}) => {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  if (Number.isNaN(page) || page < 1) page = DEFAULT_PAGE;
  if (Number.isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

module.exports = {
  getPaginationParams,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
};
