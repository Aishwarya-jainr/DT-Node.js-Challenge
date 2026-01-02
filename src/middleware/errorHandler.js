/**
 * Custom API Error class
 */
class APIError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;
    error.statusCode = err.statusCode || 500;

    // Log error for debugging
    if (process.env.NODE_ENV === 'development') {
        console.error('Error:', err);
    }

    /*
     * Multer-specific errors - these come from file upload middleware.
     * Multer uses error codes, not classes, so we check by code property.
     */
    if (err.code === 'LIMIT_FILE_SIZE') {
        error.message = 'File size too large. Maximum size is 5MB';
        error.statusCode = 400;
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        error.message = 'Too many files or unexpected field name';
        error.statusCode = 400;
    }

    // MongoDB errors
    if (err.name === 'MongoError') {
        error.message = 'Database error occurred';
        error.statusCode = 500;
    }

    /*
     * Validation errors from our validator utility.
     * These are already user-friendly, pass message through.
     */
    if (err.name === 'ValidationError') {
        error.message = err.message || 'Validation failed';
        error.statusCode = 400;
    }

    // Send error response
    res.status(error.statusCode).json({
        success: false,
        error: error.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

/**
 * Handle 404 - Route not found
 */
const notFound = (req, res, next) => {
    const error = new APIError(`Route not found - ${req.originalUrl}`, 404);
    next(error);
};

module.exports = {
    errorHandler,
    notFound,
    APIError
};
