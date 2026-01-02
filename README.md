# Events API

Production-ready RESTful API for event management built with Node.js, Express, and MongoDB native driver.

## Tech Stack

- **Runtime:** Node.js v14+
- **Framework:** Express.js
- **Database:** MongoDB (native driver, no ORM)
- **File Storage:** Multer (local disk)
- **Config:** dotenv

## Architecture Decisions

### Why Native MongoDB Driver Over Mongoose

**Chosen:** Native `mongodb` driver  
**Trade-off:** Flexibility vs Structure

**Reasoning:**
- **No Schema Lock-in:** Events can have dynamic fields without migration overhead. Business requirements change frequently; schema-less design accommodates this.
- **Direct Control:** Full access to MongoDB query API without abstraction layers. Useful for aggregation pipelines and complex queries.
- **Performance:** One less dependency, no schema validation overhead at runtime.
- **Learning Curve:** Forces understanding of MongoDB operations rather than hiding behind ORM magic.

**Cost:**
- Manual validation required (handled in `utils/validator.js`)
- No automatic type casting (handled in controllers before DB operations)
- Developers must understand MongoDB query syntax

### File Upload Strategy

**Development:** Local `uploads/` directory  
**Production:** Should migrate to object storage (S3, Cloudinary, GCS)

**Current implementation is intentionally simple:**
- Fast local development iteration
- No external service dependencies or costs
- Easy to swap for cloud storage by changing `upload.js` middleware

## Project Structure

```
.
├── server.js                    # Application entry point
├── src/
│   ├── config/
│   │   └── database.js          # MongoDB connection pool manager
│   ├── controllers/
│   │   └── eventController.js   # Business logic layer
│   ├── routes/
│   │   └── eventRoutes.js       # HTTP route definitions
│   ├── middleware/
│   │   ├── errorHandler.js      # Centralized error handling
│   │   └── upload.js            # Multer configuration
│   └── utils/
│       └── validator.js         # Input validation
└── uploads/                     # File storage (gitignored)
```

## Installation

### Prerequisites

- Node.js v14+ 
- MongoDB v4.0+ (running locally or Atlas cluster)

### Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration
```

## Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/events_db
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880
```

**Variable Descriptions:**

| Variable | Required | Default | Description | Failure Behavior |
|----------|----------|---------|-------------|------------------|
| `PORT` | No | `5000` | HTTP server port | Falls back to 5000 |
| `NODE_ENV` | No | `development` | Environment mode | Falls back to development |
| `MONGODB_URI` | **Yes** | `mongodb://localhost:27017/events_db` | MongoDB connection string | Falls back to localhost, may fail if MongoDB not running locally |
| `UPLOAD_DIR` | No | `uploads` | File upload directory | Falls back to `uploads/` |
| `MAX_FILE_SIZE` | No | `5242880` (5MB) | Max upload size in bytes | Falls back to 5MB |

**Critical:** `MONGODB_URI` must point to a valid MongoDB instance. Application will exit with code 1 if connection fails.

## Running the Application

### Development (with nodemon)
```bash
npm run dev
```

### Production
```bash
npm start
```

### Expected Startup Output
```
Connecting to MongoDB...
Connected to MongoDB: events_db
Server running on port 5000
Environment: development
```

## API Reference

### Base URL
```
http://localhost:5000/api/v3/app
```

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/events?id=:id` | Retrieve event by ObjectId |
| `GET` | `/events?type=latest&limit=:n&page=:n` | List events with pagination |
| `POST` | `/events` | Create new event |
| `PUT` | `/events/:id` | Update existing event |
| `DELETE` | `/events/:id` | Delete event |

### Event Schema

```javascript
{
  "type": "event",
  "_id": ObjectId,
  "uid": Number,
  "name": String,
  "tagline": String,
  "schedule": Date,
  "description": String,
  "image": String,                    // File path: uploads/filename.ext
  "moderator": String,
  "category": String,
  "sub_category": String,
  "rigor_rank": Number,
  "attendees": Array<String>,
  "created_at": Date,
  "updated_at": Date
}
```

### Request/Response Examples

#### Create Event

**Request:**
```bash
curl -X POST http://localhost:5000/api/v3/app/events \
  -F "uid=18" \
  -F "name=Engineering Meetup" \
  -F "tagline=Backend systems discussion" \
  -F "schedule=2024-03-15T10:00:00.000Z" \
  -F "description=Deep dive into distributed systems" \
  -F "image=@/path/to/image.jpg" \
  -F "moderator=Jane Doe" \
  -F "category=Technology" \
  -F "sub_category=Backend Engineering" \
  -F "rigor_rank=7" \
  -F 'attendees=["user1","user2"]'
```

**Response (201):**
```json
{
  "success": true,
  "message": "Event created successfully",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "type": "event",
    "name": "Engineering Meetup",
    "image": "uploads/image-1704744491234.jpg",
    ...
  }
}
```

#### Get Event by ID

**Request:**
```bash
curl http://localhost:5000/api/v3/app/events?id=507f1f77bcf86cd799439011
```

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

#### Pagination

**Request:**
```bash
curl "http://localhost:5000/api/v3/app/events?type=latest&limit=10&page=2"
```

**Response (200):**
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "currentPage": 2,
    "totalPages": 5,
    "totalEvents": 47,
    "eventsPerPage": 10,
    "hasNextPage": true,
    "hasPrevPage": true
  }
}
```

### Error Responses

All errors follow consistent format:

```json
{
  "success": false,
  "error": "Error description"
}
```

**Common Status Codes:**
- `400` - Invalid input, missing fields, validation failure
- `404` - Resource not found
- `500` - Internal server error

## Testing

Health check endpoint:
```bash
curl http://localhost:5000/health
```

## Production Considerations

### Before Deployment

1. **Database:**
   - Use MongoDB Atlas or managed cluster
   - Create indexes: `event_id`, `schedule`, `category`, `uid`
   - Enable authentication
   - Set up backups

2. **File Storage:**
   - Migrate to S3/Cloudinary/GCS
   - Update `upload.js` to use cloud SDK
   - Add CDN for image delivery

3. **Security:**
   - Add authentication (JWT recommended)
   - Implement rate limiting (express-rate-limit)
   - Enable helmet.js for HTTP headers
   - Validate/sanitize all inputs
   - Use HTTPS only

4. **Environment:**
   - Set `NODE_ENV=production`
   - Use secrets manager for credentials (AWS Secrets Manager, Vault)
   - Configure CORS origins explicitly

5. **Monitoring:**
   - Add structured logging (Winston/Pino)
   - Set up error tracking (Sentry)
   - Monitor DB query performance
   - Track API response times

## Additional Documentation

See [NUDGE_API_DOCUMENTATION.md](./NUDGE_API_DOCUMENTATION.md) for notification feature specification.

## License

This project is for educational/portfolio purposes.
