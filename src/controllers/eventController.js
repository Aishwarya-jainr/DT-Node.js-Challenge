const { getCollection, toObjectId } = require('../config/database');
const { APIError } = require('../middleware/errorHandler');
const { validateEventData, validatePagination } = require('../utils/validator');

const COLLECTION_NAME = 'events';

/*
 * GET /api/v3/app/events?id=:event_id
 * Retrieve single event by MongoDB ObjectId.
 */
const getEventById = async (req, res, next) => {
    try {
        const { id } = req.query;

        if (!id) {
            throw new APIError('Event ID is required', 400);
        }

        /*
         * Validate ObjectId before querying.
         * Invalid IDs return 400 (client error) not 500 (server error).
         */
        const objectId = toObjectId(id);
        if (!objectId) {
            throw new APIError('Invalid event ID format', 400);
        }

        const eventsCollection = getCollection(COLLECTION_NAME);
        const event = await eventsCollection.findOne({ _id: objectId });

        if (!event) {
            throw new APIError('Event not found', 404);
        }

        res.status(200).json({
            success: true,
            data: event
        });
    } catch (error) {
        next(error);
    }
};

/*
 * GET /api/v3/app/events?type=latest&limit=5&page=1
 * Paginated list of events sorted by schedule date.
 */
const getLatestEvents = async (req, res, next) => {
    try {
        const { type, limit, page } = req.query;

        if (type !== 'latest') {
            throw new APIError('Invalid type parameter. Use type=latest', 400);
        }

        const { limit: validatedLimit, page: validatedPage, skip } = validatePagination(limit, page);

        const eventsCollection = getCollection(COLLECTION_NAME);

        /*
         * Two queries needed for pagination:
         * 1. countDocuments() - Get total for page calculations
         * 2. find() with skip/limit - Get current page data
         * 
         * Trade-off: Two DB queries vs accurate pagination metadata.
         * Could cache count, but becomes stale when events added/deleted.
         */
        const totalEvents = await eventsCollection.countDocuments({});

        const events = await eventsCollection
            .find({})
            .sort({ schedule: -1 })  // Latest events first
            .skip(skip)
            .limit(validatedLimit)
            .toArray();

        const totalPages = Math.ceil(totalEvents / validatedLimit);

        res.status(200).json({
            success: true,
            data: events,
            pagination: {
                currentPage: validatedPage,
                totalPages: totalPages,
                totalEvents: totalEvents,
                eventsPerPage: validatedLimit,
                hasNextPage: validatedPage < totalPages,
                hasPrevPage: validatedPage > 1
            }
        });
    } catch (error) {
        next(error);
    }
};

/*
 * POST /api/v3/app/events
 * Create new event with file upload.
 * 
 * 1. Type conversion (strings -> proper types)
 * 2. File handling
 * 3. Validation (expects proper types)
 * 4. Database insertion
 * 
 * Why? Multer sends form-data as strings. Validator expects typed values.
 * Without ORM auto-casting, we handle conversion manually.
 */
const createEvent = async (req, res, next) => {
    try {
        const eventData = { ...req.body };

        /*
         * STEP 1: Type conversion
         * 
         * Problem: Multipart/form-data sends everything as strings.
         * Solution: Manually parse JSON and convert types.
         * 
         * With Mongoose, this would be automatic via schema casting.
         * Trade-off of native driver: manual work but full control.
         */
        if (eventData.attendees && typeof eventData.attendees === 'string') {
            try {
                eventData.attendees = JSON.parse(eventData.attendees);
            } catch (e) {
                throw new APIError('Invalid attendees format. Must be a JSON array', 400);
            }
        } else if (!eventData.attendees) {
            eventData.attendees = [];
        }

        // Convert string numbers to actual numbers
        if (eventData.uid) eventData.uid = parseInt(eventData.uid);
        if (eventData.rigor_rank) eventData.rigor_rank = parseInt(eventData.rigor_rank);
        if (eventData.schedule) eventData.schedule = new Date(eventData.schedule);

        /*
         * STEP 2: File handling
         * Multer middleware already saved file and populated req.file.
         * We just store the file path in the event document.
         */

        if (req.file) {
            eventData.image = req.file.path;
        } else {
            throw new APIError('Event image is required', 400);
        }

        /*
         * STEP 3: Validation
         * Now that types are correct (numbers are Numbers, attendees is Array),
         * validation will pass. Order matters - can't validate before conversion.
         */
        validateEventData(eventData, false);

        /*
         * STEP 4: Set defaults and save
         * Add metadata fields that aren't in user input.
         */
        eventData.type = 'event';
        eventData.uid = eventData.uid || 18;
        eventData.created_at = new Date();
        eventData.updated_at = new Date();

        const eventsCollection = getCollection(COLLECTION_NAME);
        const result = await eventsCollection.insertOne(eventData);

        res.status(201).json({
            success: true,
            message: 'Event created successfully',
            data: {
                id: result.insertedId,
                ...eventData
            }
        });
    } catch (error) {
        next(error);
    }
};

/*
 * PUT /api/v3/app/events/:id
 * Update existing event with partial data.
 * Follows same type conversion pattern as createEvent.
 */
const updateEvent = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updateData = { ...req.body };

        const objectId = toObjectId(id);
        if (!objectId) {
            throw new APIError('Invalid event ID format', 400);
        }

        /*
         * Prevent empty updates - must provide either fields or file.
         * Without this check, update would succeed but change nothing.
         */
        if (Object.keys(updateData).length === 0 && !req.file) {
            throw new APIError('No update data provided', 400);
        }

        if (req.file) {
            updateData.image = req.file.path;
        }

        // Type conversion same as createEvent, but only for provided fields
        if (updateData.attendees && typeof updateData.attendees === 'string') {
            try {
                updateData.attendees = JSON.parse(updateData.attendees);
            } catch (e) {
                throw new APIError('Invalid attendees format. Must be a JSON array', 400);
            }
        }

        if (updateData.rigor_rank) {
            updateData.rigor_rank = parseInt(updateData.rigor_rank);
        }
        if (updateData.schedule) {
            updateData.schedule = new Date(updateData.schedule);
        }
        if (updateData.uid) {
            updateData.uid = parseInt(updateData.uid);
        }

        // Always update timestamp on modification
        updateData.updated_at = new Date();

        const eventsCollection = getCollection(COLLECTION_NAME);

        /*
         * findOneAndUpdate with returnDocument:'after' returns updated document.
         */
        const result = await eventsCollection.findOneAndUpdate(
            { _id: objectId },
            { $set: updateData },
            { returnDocument: 'after' }
        );

        if (!result) {
            throw new APIError('Event not found', 404);
        }

        res.status(200).json({
            success: true,
            message: 'Event updated successfully',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/*
 * DELETE /api/v3/app/events/:id
 * Delete event from database.
 * 
 * Note: Does NOT delete associated image file from uploads/ directory.
 */
const deleteEvent = async (req, res, next) => {
    try {
        const { id } = req.params;

        const objectId = toObjectId(id);
        if (!objectId) {
            throw new APIError('Invalid event ID format', 400);
        }

        const eventsCollection = getCollection(COLLECTION_NAME);
        const result = await eventsCollection.deleteOne({ _id: objectId });

        if (result.deletedCount === 0) {
            throw new APIError('Event not found', 404);
        }

        res.status(200).json({
            success: true,
            message: 'Event deleted successfully',
            data: {
                deletedId: id
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getEventById,
    getLatestEvents,
    createEvent,
    updateEvent,
    deleteEvent
};
