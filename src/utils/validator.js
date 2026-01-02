const { APIError } = require('../middleware/errorHandler');

/**
 * Validate required fields in request body
 * @param {Object} data - Request data
 * @param {Array<string>} requiredFields - Array of required field names
 * @throws {APIError} If validation fails
 */
const validateRequiredFields = (data, requiredFields) => {
    const missingFields = [];

    for (const field of requiredFields) {
        if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
            missingFields.push(field);
        }
    }

    if (missingFields.length > 0) {
        throw new APIError(
            `Missing required fields: ${missingFields.join(', ')}`,
            400
        );
    }
};

/**
 * Validate event data
 * @param {Object} eventData - Event data to validate
 * @param {boolean} isUpdate - Whether this is an update operation
 * @throws {APIError} If validation fails
 */
const validateEventData = (eventData, isUpdate = false) => {
    /*
     * CREATE requires all fields.
     * UPDATE allows partial data - only validates provided fields.
     */
    if (!isUpdate) {
        const requiredFields = [
            'name',
            'tagline',
            'schedule',
            'description',
            'moderator',
            'category',
            'sub_category',
            'rigor_rank'
        ];
        validateRequiredFields(eventData, requiredFields);
    }

    /*
     * Validate rigor_rank is a number.
     * parseInt() returns NaN for invalid input, not throwing an error.
     * Explicit check needed to catch this case.
     */
    if (eventData.rigor_rank !== undefined) {
        const rigorRank = parseInt(eventData.rigor_rank);
        if (isNaN(rigorRank)) {
            throw new APIError('rigor_rank must be a valid integer', 400);
        }
    }

    /*
     * Validate schedule is a parseable date.
     * new Date('invalid') returns Invalid Date object (not null/error).
     * Must check with isNaN(date.getTime()) to detect invalid dates.
     */
    if (eventData.schedule) {
        const scheduleDate = new Date(eventData.schedule);
        if (isNaN(scheduleDate.getTime())) {
            throw new APIError('schedule must be a valid date/time', 400);
        }
    }

    /*
     * Validate attendees is an array.
     * Without schemas, type enforcement is manual.
     * Controller should parse '["id1","id2"]' string to array before validation.
     */
    if (eventData.attendees) {
        if (!Array.isArray(eventData.attendees)) {
            throw new APIError('attendees must be an array of user IDs', 400);
        }
    }
};

/**
 * Validate pagination parameters
 * @param {number} limit - Items per page
 * @param {number} page - Page number
 * @returns {Object} Validated and parsed pagination params
 */
const validatePagination = (limit, page) => {
    const parsedLimit = parseInt(limit) || 10;
    const parsedPage = parseInt(page) || 1;

    if (parsedLimit < 1 || parsedLimit > 100) {
        throw new APIError('Limit must be between 1 and 100', 400);
    }

    if (parsedPage < 1) {
        throw new APIError('Page must be greater than 0', 400);
    }

    return {
        limit: parsedLimit,
        page: parsedPage,
        skip: (parsedPage - 1) * parsedLimit  // MongoDB skip() value
    };
};

module.exports = {
    validateRequiredFields,
    validateEventData,
    validatePagination
};
