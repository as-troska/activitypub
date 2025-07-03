const request = require('supertest');
const express = require('express');
const cors = require('cors');

// Mock modules before requiring app
jest.mock('../lib/db', () => ({
  db: jest.fn(() => ({
    collection: jest.fn(() => ({
      find: jest.fn(() => ({
        toArray: jest.fn().mockResolvedValue([])
      })),
      findOne: jest.fn().mockResolvedValue(null),
      insertOne: jest.fn().mockResolvedValue({}),
      updateOne: jest.fn().mockResolvedValue({}),
      deleteOne: jest.fn().mockResolvedValue({})
    }))
  }))
}));

jest.mock('../lib/sign', () => ({
  sendSignedRequest: jest.fn().mockResolvedValue({ status: 200 })
}));

jest.mock('node-cron', () => ({
  schedule: jest.fn()
}));

// Mock winston logger
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn()
  })),
  format: {
    printf: jest.fn()
  },
  transports: {
    File: jest.fn()
  }
}));

// Mock morgan
jest.mock('morgan', () => {
  return jest.fn(() => (req, res, next) => next());
});

// Mock fs
jest.mock('fs', () => ({
  createWriteStream: jest.fn(() => ({}))
}));

describe('Application Integration Tests', () => {
  let app;

  beforeAll(() => {
    // Set environment variables
    process.env.MONGOURI = 'mongodb://localhost:27017/test';
    process.env.PASSWORD = 'test-password';
    
    // Require app after mocking
    app = require('../app');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockClear();
  });

  describe('Webfinger Endpoints', () => {
    it('GET /.well-known/webfinger should work for valid user', async () => {
      const response = await request(app)
        .get('/.well-known/webfinger')
        .query({ resource: 'acct:trondss@sneaas.no' })
        .expect(200);

      expect(response.body).toHaveProperty('subject', 'acct:trondss@sneaas.no');
      expect(response.body).toHaveProperty('links');
      expect(response.body.links[0]).toHaveProperty('href', 'https://www.sneaas.no/u/trondss');
    });

    it('GET /.well-known/webfinger should return 404 for invalid user', async () => {
      await request(app)
        .get('/.well-known/webfinger')
        .query({ resource: 'acct:invalid@sneaas.no' })
        .expect(404);
    });

    it('GET /.well-known/nodeinfo should return nodeinfo links', async () => {
      const response = await request(app)
        .get('/.well-known/nodeinfo')
        .expect(200);

      expect(response.body).toHaveProperty('links');
      expect(Array.isArray(response.body.links)).toBe(true);
    });

    it('GET /nodeinfo/2.0.json should return nodeinfo 2.0', async () => {
      const response = await request(app)
        .get('/nodeinfo/2.0.json')
        .expect(200);

      expect(response.body).toHaveProperty('version', '2.0');
      expect(response.body).toHaveProperty('software');
      expect(response.body).toHaveProperty('protocols');
    });
  });

  describe('User Profile Endpoints', () => {
    it('GET /u/trondss should return actor profile', async () => {
      const response = await request(app)
        .get('/u/trondss')
        .set('Accept', 'application/activity+json')
        .expect(200);

      expect(response.body).toHaveProperty('@context');
      expect(response.body).toHaveProperty('type', 'Person');
      expect(response.body).toHaveProperty('id', 'https://www.sneaas.no/u/trondss');
    });

    it('GET /u/trondss/outbox should return outbox collection', async () => {
      const response = await request(app)
        .get('/u/trondss/outbox')
        .set('Accept', 'application/activity+json')
        .expect(200);

      expect(response.body).toHaveProperty('@context');
      expect(response.body).toHaveProperty('type', 'OrderedCollection');
      expect(response.body).toHaveProperty('id', 'https://www.sneaas.no/u/trondss/outbox');
    });

    it('GET /u/trondss/followers should return followers collection', async () => {
      const response = await request(app)
        .get('/u/trondss/followers')
        .set('Accept', 'application/activity+json')
        .expect(200);

      expect(response.body).toHaveProperty('@context');
      expect(response.body).toHaveProperty('type', 'OrderedCollection');
      expect(response.body).toHaveProperty('id', 'https://www.sneaas.no/u/trondss/followers');
    });

    it('GET /u/trondss/following should return following collection', async () => {
      const response = await request(app)
        .get('/u/trondss/following')
        .set('Accept', 'application/activity+json')
        .expect(200);

      expect(response.body).toHaveProperty('@context');
      expect(response.body).toHaveProperty('type', 'OrderedCollection');
      expect(response.body).toHaveProperty('id', 'https://www.sneaas.no/u/trondss/following');
    });

    it('GET /u/trondss/inbox should return inbox collection', async () => {
      const response = await request(app)
        .get('/u/trondss/inbox')
        .set('Accept', 'application/activity+json')
        .expect(200);

      expect(response.body).toHaveProperty('@context');
      expect(response.body).toHaveProperty('type', 'OrderedCollection');
    });
  });

  describe('Inbox Endpoint', () => {
    it('POST /u/trondss/inbox should accept valid ActivityPub activity', async () => {
      const followActivity = {
        '@context': 'https://www.w3.org/ns/activitystreams',
        type: 'Follow',
        id: 'https://example.com/follow/123',
        actor: 'https://example.com/actor',
        object: 'https://www.sneaas.no/u/trondss'
      };

      // Mock the middleware checks to pass
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          id: 'https://example.com/actor',
          publicKey: {
            publicKeyPem: 'mock-public-key'
          }
        })
      });

      await request(app)
        .post('/u/trondss/inbox')
        .set('Content-Type', 'application/activity+json')
        .set('Signature', 'keyId="https://example.com/actor#main-key",algorithm="rsa-sha256",headers="(request-target) host date",signature="mock-signature"')
        .send(followActivity)
        .expect(200);
    });

    it('POST /u/trondss/inbox should reject invalid content type', async () => {
      const activity = { type: 'Follow' };

      await request(app)
        .post('/u/trondss/inbox')
        .set('Content-Type', 'application/json')
        .send(activity)
        .expect(415);
    });

    it('POST /u/trondss/inbox should reject invalid activity type', async () => {
      const activity = { type: 'InvalidType' };

      await request(app)
        .post('/u/trondss/inbox')
        .set('Content-Type', 'application/activity+json')
        .send(activity)
        .expect(400);
    });
  });

  describe('Outbox Endpoint', () => {
    it('POST /u/trondss/outbox should accept valid activity with auth', async () => {
      const createActivity = {
        type: 'Create',
        object: {
          type: 'Note',
          content: 'Hello world!'
        }
      };

      await request(app)
        .post('/u/trondss/outbox')
        .send({
          ...createActivity,
          password: 'test-password'
        })
        .expect(200);
    });

    it('POST /u/trondss/outbox should reject without auth', async () => {
      const createActivity = {
        type: 'Create',
        object: {
          type: 'Note',
          content: 'Hello world!'
        }
      };

      await request(app)
        .post('/u/trondss/outbox')
        .send(createActivity)
        .expect(401);
    });

    it('POST /u/trondss/outbox should reject with wrong password', async () => {
      const createActivity = {
        type: 'Create',
        object: {
          type: 'Note',
          content: 'Hello world!'
        }
      };

      await request(app)
        .post('/u/trondss/outbox')
        .send({
          ...createActivity,
          password: 'wrong-password'
        })
        .expect(401);
    });
  });

  describe('Following Endpoints', () => {
    it('GET /findUser/:user should require auth', async () => {
      await request(app)
        .get('/findUser/testuser')
        .expect(401);
    });

    it('GET /findUser/:user should work with auth', async () => {
      // Mock a successful response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          id: 'https://example.com/testuser',
          name: 'Test User'
        })
      });

      await request(app)
        .get('/findUser/testuser')
        .send({ password: 'test-password' })
        .expect(200);
    });

    it('POST /follow/:actor should require auth', async () => {
      await request(app)
        .post('/follow/https%3A%2F%2Fexample.com%2Factor')
        .send({})
        .expect(401);
    });
  });

  describe('Static Routes', () => {
    it('GET /createNote should serve HTML file', async () => {
      // Mock fs.existsSync and fs.readFileSync for serving files
      const fs = require('fs');
      fs.readFileSync = jest.fn().mockReturnValue('<html>Create Note</html>');
      fs.existsSync = jest.fn().mockReturnValue(true);

      await request(app)
        .get('/createNote')
        .expect(200);
    });

    it('GET /lookupUser should serve HTML file', async () => {
      // Mock fs.existsSync and fs.readFileSync for serving files
      const fs = require('fs');
      fs.readFileSync = jest.fn().mockReturnValue('<html>User Lookup</html>');
      fs.existsSync = jest.fn().mockReturnValue(true);

      await request(app)
        .get('/lookupUser')
        .expect(200);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for unknown routes', async () => {
      await request(app)
        .get('/unknown-route')
        .expect(404);
    });
  });
});