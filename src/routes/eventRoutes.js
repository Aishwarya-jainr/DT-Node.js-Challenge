const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const {
    getEventById,
    getLatestEvents,
    createEvent,
    updateEvent,
    deleteEvent
} = require('../controllers/eventController');

/**
 * Route handler to distinguish between different GET requests
 */
router.get('/events', (req, res, next) => {
    // Check if it's a request by ID
    if (req.query.id) {
        return getEventById(req, res, next);
    }

    if (req.query.type === 'latest') {
        return getLatestEvents(req, res, next);
    }

    // Invalid request
    return res.status(400).json({
        success: false,
        error: 'Invalid query parameters. Use either ?id=<event_id> or ?type=latest&limit=<n>&page=<n>'
    });
});

/*
 * POST /events - Create event
 * upload.single('image') middleware runs BEFORE controller.
 * If file validation fails, error handler catches it before reaching controller.
 * If successful, req.file contains file metadata.
 */
router.post('/events', upload.single('image'), createEvent);

/*
 * PUT /events/:id - Update event
 * Image is optional on update - upload middleware accepts missing files gracefully.
 * Controller checks req.file presence to determine if image was updated.
 */
router.put('/events/:id', upload.single('image'), updateEvent);

/*
 * DELETE /events/:id - Delete event
 * No middleware needed - just delete from DB.
 * Note: Does NOT delete image file from disk (prevents accidental file loss).
 */
router.delete('/events/:id', deleteEvent);

module.exports = router;

