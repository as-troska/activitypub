const { MongoMemoryServer } = require('mongodb-memory-server');
const { MongoClient } = require('mongodb');

let mongod;
let mongoClient;

// Setup before all tests
beforeAll(async () => {
  // Start in-memory MongoDB instance
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  
  // Set environment variables for testing
  process.env.MONGOURI = uri;
  process.env.PASSWORD = 'test-password';
  process.env.NODE_ENV = 'test';
  
  // Create MongoDB client
  mongoClient = new MongoClient(uri);
  await mongoClient.connect();
}, 60000);

// Cleanup after all tests
afterAll(async () => {
  if (mongoClient) {
    await mongoClient.close();
  }
  if (mongod) {
    await mongod.stop();
  }
}, 60000);

// Clean up database between tests
beforeEach(async () => {
  if (mongoClient) {
    const db = mongoClient.db('activitypub');
    const collections = await db.listCollections().toArray();
    
    for (const collection of collections) {
      await db.collection(collection.name).deleteMany({});
    }
  }
});

// Mock console.log and console.error to reduce test noise
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
};

// Mock fetch globally
global.fetch = jest.fn();

module.exports = {
  getMongoClient: () => mongoClient,
  getMongod: () => mongod
};