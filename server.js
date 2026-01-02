require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./src/config/database');
const eventRoutes = require('./src/routes/eventRoutes');
const { errorHandler, notFound } = require('./src/middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// API Routes
app.use('/api/v3/app', eventRoutes);

// Handle 404 - Route not found
app.use(notFound);

// Global error handler
app.use(errorHandler);

// Start server
const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectDB();

        // Start listening
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`Health check: http://localhost:${PORT}/health`);
            console.log(`API Base URL: http://localhost:${PORT}/api/v3/app`);
        });
    } catch (error) {
        console.error('Failed to start server:', error.message);
        process.exit(1);
    }
};

// Start the server
startServer();

module.exports = app;
