const { MongoClient, ObjectId } = require('mongodb');

// MongoDB connection state
let db = null;
let client = null;

/**
 * Initialize MongoDB connection with pooling.
 * Connection pool reduces overhead of creating new connections per request.
 * Pool size configured based on expected concurrency - adjust for production load.
 */
const connectDB = async () => {
  try {
    if (db) {
      console.log('Already connected to MongoDB');
      return db;
    }

    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const dbName = process.env.DB_NAME || 'events_db';

    console.log('Connecting to MongoDB...');

    /*
     * Connection pool configuration:
     * maxPoolSize: Maximum concurrent connections (prevents overwhelming DB)
     * minPoolSize: Keeps connections warm (reduces latency for burst traffic)
     * serverSelectionTimeoutMS: Fail fast if DB unreachable (better than hanging requests)
     */
    client = new MongoClient(uri, {
      maxPoolSize: 10,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
    });

    await client.connect();
    db = client.db(dbName);

    console.log(`Connected to MongoDB: ${dbName}`);

    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1); // Exit immediately - no point running without database
  }
};

/**
 * Get database instance.
 * Throws if called before connectDB() - fail fast pattern.
 */
const getDB = () => {
  if (!db) {
    throw new Error('Database not initialized. Call connectDB first.');
  }
  return db;
};

/**
 * Get collection by name.
 * Using native driver means no predefined schemas - flexibility vs type safety trade-off.
 */
const getCollection = (collectionName) => {
  const database = getDB();
  return database.collection(collectionName);
};

/**
 * Close MongoDB connection
 */
const closeDB = async () => {
  if (client) {
    await client.close();
    db = null;
    client = null;
    console.log('MongoDB connection closed');
  }
};

/**
 * Validate and convert string to ObjectId.
 * MongoDB's ObjectId.isValid() is lenient - accepts some invalid formats.
 * Explicit try-catch ensures we only return truly valid ObjectIds or null.
 * 
 * Returns null on invalid input rather than throwing to allow controllers
 * to provide user-friendly error messages (400 vs 500).
 */
const toObjectId = (id) => {
  try {
    if (ObjectId.isValid(id)) {
      return new ObjectId(id);
    }
    return null;
  } catch (error) {
    return null;
  }
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await closeDB();
  process.exit(0);
});

module.exports = {
  connectDB,
  getDB,
  getCollection,
  closeDB,
  toObjectId,
  ObjectId
};
