const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

const client = new MongoClient(process.env.MONGOURI, {});

async function connectToDatabase() {
    try {
        await client.connect();
        console.log('🚀 Connected to MongoDB');
        return client;
    } catch (error) {
        console.error('💥 Failed to connect to MongoDB:', error.message);
        process.exit(1);
    }
}

// Initialize connection
if (process.env.NODE_ENV !== 'test') {
    connectToDatabase();
}

module.exports = client;