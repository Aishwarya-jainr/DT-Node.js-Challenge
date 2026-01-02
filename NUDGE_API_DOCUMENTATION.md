# Nudge API Specification

## Overview

Nudges are scheduled notifications that promote events to users. A nudge references an existing event and contains marketing content (title, image, invitation text) with scheduling metadata.

**Purpose:** Increase event engagement through targeted, time-based notifications.

## Data Model

```javascript
{
  "type": "nudge",
  "_id": ObjectId,
  "uid": Number,                      // Creator user ID
  "event_id": ObjectId,               // Reference to events collection
  "title": String,                    // Max 60 characters
  "image": String,                    // Cover image path
  "icon": String,                     // Icon for minimized view
  "invitation": String,               // One-line teaser text
  "description": String,              // Full notification content
  "scheduled_date": Date,             // Target send date
  "timing_from": String,              // Start time (HH:mm format)
  "timing_to": String,                // End time (HH:mm format)
  "status": String,                   // pending | sent | cancelled
  "created_at": Date,
  "updated_at": Date
}
```

### Field Constraints

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `uid` | Number | Yes | Must be valid user ID |
| `event_id` | ObjectId | Yes | Must reference existing event |
| `title` | String | Yes | Max 60 characters (UI constraint) |
| `image` | File | Yes | Image formats only, max 5MB |
| `icon` | File | Yes | Image formats only, max 5MB |
| `invitation` | String | Yes | One-line text |
| `description` | String | Yes | Full content |
| `scheduled_date` | Date | Yes | ISO 8601 format |
| `timing_from` | String | Yes | HH:mm format (e.g., "10:00") |
| `timing_to` | String | Yes | HH:mm format, must be after `timing_from` |
| `status` | String | Auto | Default: "pending" |

### Status Lifecycle

```
pending -> sent        (automatically updated when notification is delivered)
pending -> cancelled   (manually cancelled before delivery)
```

**Note:** In production, a background job (cron/queue) should process pending nudges at their scheduled time and update status to "sent".

## API Endpoints

### Base URL
```
/api/v3/app
```

---

### Create Nudge

```http
POST /nudges
Content-Type: multipart/form-data
```

**Form Data:**
```
uid: 18
event_id: 507f1f77bcf86cd799439011
title: Workshop Reminder
image: [file]
icon: [file]
scheduled_date: 2024-03-15
timing_from: 10:00
timing_to: 12:00
description: Join us for an interactive workshop on distributed systems
invitation: Great workshop starting soon. Swipe to learn more.
```

**Response (201):**
```json
{
  "success": true,
  "message": "Nudge created successfully",
  "data": {
    "id": "507f191e810c19729de860ea",
    "type": "nudge",
    "event_id": "507f1f77bcf86cd799439011",
    "title": "Workshop Reminder",
    "image": "uploads/cover-1704744491234.jpg",
    "icon": "uploads/icon-1704744491235.png",
    "status": "pending",
    ...
  }
}
```

**Errors:**
- `400` - Missing required fields, invalid event_id, title exceeds 60 chars
- `404` - Referenced event does not exist

---

### Get Nudge by ID

```http
GET /nudges?id=:nudge_id
```

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

**Errors:**
- `400` - Invalid ObjectId format
- `404` - Nudge not found

---

### Get Latest Nudges (Paginated)

```http
GET /nudges?type=latest&limit=:n&page=:n
```

**Query Parameters:**
- `type` (required): Must be "latest"
- `limit` (optional): Results per page (1-100, default: 10)
- `page` (optional): Page number (starts at 1, default: 1)

**Response (200):**
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalNudges": 47,
    "nudgesPerPage": 10,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

### Get Nudges by Event ID

```http
GET /nudges?event_id=:event_id
```

**Use Case:** Retrieve all marketing nudges created for a specific event.

**Response (200):**
```json
{
  "success": true,
  "data": [ ... ],
  "count": 3
}
```

**Errors:**
- `400` - Invalid event_id format
- `404` - Event not found (optional validation)

---

### Update Nudge

```http
PUT /nudges/:id
Content-Type: multipart/form-data
```

**Request Body:** Include only fields to update.

**Example:**
```
title: Updated Workshop Title
status: sent
```

**Response (200):**
```json
{
  "success": true,
  "message": "Nudge updated successfully",
  "data": { ... }
}
```

**Errors:**
- `400` - Invalid data, no update fields provided
- `404` - Nudge not found

**Note:** Updating image/icon files will replace existing files but won't delete old files from disk.

---

### Delete Nudge

```http
DELETE /nudges/:id
```

**Response (200):**
```json
{
  "success": true,
  "message": "Nudge deleted successfully",
  "data": {
    "deletedId": "507f191e810c19729de860ea"
  }
}
```

**Errors:**
- `404` - Nudge not found

**Note:** Deleting a nudge does NOT delete the referenced event or uploaded image files.

---

## Implementation Notes

### Multiple File Uploads

Unlike events (single image), nudges require two file uploads:
- `image` - Cover image for notification
- `icon` - Small icon for minimized view

**Multer Configuration:**
```javascript
upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'icon', maxCount: 1 }
])
```

File paths stored as:
```javascript
{
  image: req.files['image'][0].path,
  icon: req.files['icon'][0].path
}
```

### Event Reference Validation

**Optional but Recommended:** Validate that `event_id` references an existing event before creating nudge.

```javascript
const event = await eventsCollection.findOne({ _id: toObjectId(event_id) });
if (!event) {
  throw new APIError('Referenced event not found', 404);
}
```

**Trade-off:** Adds extra DB query but prevents orphaned nudges.

### Scheduled Delivery

Current implementation stores scheduling metadata but does NOT handle delivery. 

**Production Requirements:**
- Background job processor (Bull, Agenda, node-cron)
- Query for `status: "pending"` nudges with `scheduled_date <= now`
- Send notifications via push notification service (FCM, SNS)
- Update `status` to "sent" after delivery

**Example Query:**
```javascript
db.nudges.find({
  status: "pending",
  scheduled_date: { $lte: new Date() }
})
```

### Database Indexes

Recommended indexes for performance:

```javascript
db.nudges.createIndex({ "event_id": 1 })
db.nudges.createIndex({ "scheduled_date": 1, "status": 1 })
db.nudges.createIndex({ "uid": 1 })
db.nudges.createIndex({ "created_at": -1 })
```

**Reasoning:**
- `event_id` - Fast lookup of nudges by event
- `scheduled_date + status` - Efficient job processing queries
- `uid` - User's nudge history
- `created_at` - Pagination sorting

---

## Error Response Format

All errors return consistent structure:

```json
{
  "success": false,
  "error": "Detailed error message"
}
```

### Common Errors

| Status | Scenario | Error Message |
|--------|----------|---------------|
| 400 | Missing fields | `"Missing required fields: title, image, icon"` |
| 400 | Invalid ObjectId | `"Invalid nudge ID format"` |
| 400 | Title too long | `"Title must be 60 characters or less"` |
| 400 | Invalid file type | `"Only image files allowed"` |
| 400 | File too large | `"File size exceeds 5MB limit"` |
| 404 | Not found | `"Nudge not found"` |
| 404 | Event missing | `"Referenced event not found"` |
| 500 | Server error | `"Internal server error"` |

---

## Testing with Postman

### Setup

1. Set base URL: `http://localhost:5000/api/v3/app`
2. Create an event first (needed for valid `event_id`)

### Test Sequence

1. **Create Event** (prerequisite)
   ```
   POST /events
   Save returned event._id for next step
   ```

2. **Create Nudge**
   ```
   POST /nudges
   Body: form-data
   - Add all required fields
   - Use event_id from step 1
   - Select File type for image and icon fields
   Save returned nudge._id
   ```

3. **Get Nudge by ID**
   ```
   GET /nudges?id={nudge_id}
   Verify all fields match creation request
   ```

4. **Get Latest Nudges**
   ```
   GET /nudges?type=latest&limit=5&page=1
   Verify pagination metadata
   ```

5. **Get Nudges by Event**
   ```
   GET /nudges?event_id={event_id}
   Should return nudge created in step 2
   ```

6. **Update Nudge**
   ```
   PUT /nudges/{nudge_id}
   Body: status=sent
   Verify updated_at timestamp changes
   ```

7. **Delete Nudge**
   ```
   DELETE /nudges/{nudge_id}
   Verify 200 response
   GET /nudges?id={nudge_id} should return 404
   ```

---

## Implementation Status

**Current:** Specification only (no code implementation)

This document describes the API contract. Implementation would follow the same architectural patterns as the Events API:
- `src/controllers/nudgeController.js` - Business logic
- `src/routes/nudgeRoutes.js` - Route definitions
- Update `src/utils/validator.js` - Add `validateNudgeData()`
- Register routes in `server.js`

**Estimated Effort:** 2-3 hours (templating from Events API)

---

## Production Considerations

1. **Notification Delivery:**
   - Integrate with push notification service (Firebase Cloud Messaging, AWS SNS)
   - Implement background job processor
   - Add retry logic for failed deliveries
   - Track delivery metrics (sent, opened, clicked)

2. **User Preferences:**
   - Allow users to opt out of nudges
   - Respect quiet hours
   - Frequency capping

3. **Content Moderation:**
   - Validate invitation text for spam/abuse
   - Image content scanning
   - Rate limit nudge creation per user

4. **Analytics:**
   - Track engagement rates
   - A/B test different invitation text
   - Monitor delivery success rate
