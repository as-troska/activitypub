const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const log = require('./logger');

dotenv.config();

// Validate environment variables
function validateEnvironment() {
    if (!process.env.MONGOURI) {
        const error = new Error('MONGOURI environment variable is required');
        log.error('Database configuration error: Missing MONGOURI environment variable');
        throw error;
    }
    
    try {
        // Basic URI validation
        new URL(process.env.MONGOURI);
    } catch (urlError) {
        const error = new Error('Invalid MONGOURI format');
        log.error('Database configuration error: Invalid MONGOURI format', urlError);
        throw error;
    }
}

const client = new MongoClient(process.env.MONGOURI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
});

async function connectToDatabase() {
    try {
        validateEnvironment();
        
        log.info('Attempting to connect to MongoDB...', {
            nodeEnv: process.env.NODE_ENV,
            mongouri: process.env.MONGOURI ? 'Configured' : 'Missing'
        });
        
        await client.connect();
        
        // Test the connection
        await client.db('admin').command({ ping: 1 });
        
        log.info('MongoDB connection established and verified');
        return client;
    } catch (error) {
        log.error('Failed to connect to MongoDB', error, {
            nodeEnv: process.env.NODE_ENV,
            errorType: error.constructor.name,
            mongoConfigured: !!process.env.MONGOURI
        });
        
        // In production, we should try to handle this gracefully
        if (process.env.NODE_ENV === 'production') {
            log.error('Fatal error: Cannot start application without database connection');
            process.exit(1);
        } else {
            // In development/test, just throw the error
            throw error;
        }
    }
}

// Handle connection events for better monitoring
client.on('error', function(error) {
    log.error('MongoDB client error event', error);
});

client.on('close', function() {
    log.warn('MongoDB connection closed');
});

client.on('reconnect', function() {
    log.info('MongoDB reconnected successfully');
});

client.on('timeout', function() {
    log.warn('MongoDB connection timeout');
});

client.on('serverOpening', function(event) {
    log.debug('MongoDB server opening', { serverAddress: event.address });
});

client.on('serverClosed', function(event) {
    log.debug('MongoDB server closed', { serverAddress: event.address });
});

// Graceful shutdown handlers
function setupGracefulShutdown() {
    const signals = ['SIGINT', 'SIGTERM'];
    
    signals.forEach(function(signal) {
        process.on(signal, async function() {
            try {
                log.info('Received ' + signal + ', closing MongoDB connection...');
                await client.close();
                log.info('MongoDB connection closed gracefully');
                process.exit(0);
            } catch (error) {
                log.error('Error during graceful shutdown', error);
                process.exit(1);
            }
        });
    });
}

// Initialize connection and setup handlers
if (process.env.NODE_ENV !== 'test') {
    connectToDatabase();
    setupGracefulShutdown();
}

module.exports = client;