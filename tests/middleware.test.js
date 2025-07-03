const { 
  checkContentType, 
  checkActivityType, 
  checkActor, 
  checkSignature, 
  checkAuth,
  getActorProfile 
} = require('../lib/middleware');
const client = require('../lib/db');

// Mock the database client module
jest.mock('../lib/db', () => ({
  db: jest.fn(() => ({
    collection: jest.fn(() => ({
      findOne: jest.fn()
    }))
  }))
}));

describe('Middleware Functions', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      method: 'POST',
      get: jest.fn(),
      headers: {},
      body: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
    next = jest.fn();
    
    // Reset mocks
    jest.clearAllMocks();
    global.fetch.mockClear();
  });

  describe('checkContentType', () => {
    it('should pass for valid content type application/ld+json', async () => {
      req.get.mockReturnValue('application/ld+json');
      
      await checkContentType(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should pass for valid content type application/activity+json', async () => {
      req.get.mockReturnValue('application/activity+json');
      
      await checkContentType(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should handle content type with charset', async () => {
      req.get.mockReturnValue('application/ld+json; charset=utf-8');
      
      await checkContentType(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject invalid content type', async () => {
      req.get.mockReturnValue('application/json');
      
      await checkContentType(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(415);
      expect(res.send).toHaveBeenCalledWith('Unsupported Media Type');
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject missing content type', async () => {
      req.get.mockReturnValue(null);
      
      await checkContentType(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(415);
      expect(res.send).toHaveBeenCalledWith('Unsupported Media Type');
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass for non-POST requests', async () => {
      req.method = 'GET';
      
      await checkContentType(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('checkActivityType', () => {
    it('should pass for valid activity types', async () => {
      const validTypes = ['Create', 'Update', 'Delete', 'Follow', 'Accept', 'Reject', 'Add', 'Remove', 'Like', 'Announce', 'Undo', 'Block', 'Flag'];
      
      for (const type of validTypes) {
        req.body = { type };
        await checkActivityType(req, res, next);
        expect(next).toHaveBeenCalled();
        
        // Reset for next iteration
        next.mockClear();
      }
    });

    it('should reject invalid activity type', async () => {
      req.body = { type: 'InvalidType' };
      
      await checkActivityType(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Bad Request: Invalid activity type');
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject missing activity type', async () => {
      req.body = {};
      
      await checkActivityType(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Bad Request: Missing activity type');
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject missing body', async () => {
      req.body = null;
      
      await checkActivityType(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Bad Request: Missing activity type');
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass for non-POST requests', async () => {
      req.method = 'GET';
      req.body = null;
      
      await checkActivityType(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('checkActor', () => {
    const mockDb = {
      collection: jest.fn(() => ({
        findOne: jest.fn()
      }))
    };

    beforeEach(() => {
      client.db.mockReturnValue(mockDb);
    });

    it('should pass for Follow activity type', async () => {
      req.body = { type: 'Follow', actor: 'https://example.com/actor' };
      
      await checkActor(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should pass for Accept activity type', async () => {
      req.body = { type: 'Accept', actor: 'https://example.com/actor' };
      
      await checkActor(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject missing actor', async () => {
      req.body = { type: 'Create' };
      
      await checkActor(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Bad Request: Missing actor');
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass when actor is found in followers', async () => {
      req.body = { type: 'Create', actor: 'https://example.com/actor' };
      
      const mockCollection = {
        findOne: jest.fn()
      };
      mockDb.collection.mockReturnValue(mockCollection);
      mockCollection.findOne
        .mockResolvedValueOnce({ id: 'https://example.com/actor' }) // followers check
        .mockResolvedValueOnce(null); // following check
      
      // Mock fetch for actor profile
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'https://example.com/actor' })
      });
      
      await checkActor(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should pass when actor is found in following', async () => {
      req.body = { type: 'Create', actor: 'https://example.com/actor' };
      
      const mockCollection = {
        findOne: jest.fn()
      };
      mockDb.collection.mockReturnValue(mockCollection);
      mockCollection.findOne
        .mockResolvedValueOnce(null) // followers check
        .mockResolvedValueOnce({ id: 'https://example.com/actor' }); // following check
      
      // Mock fetch for actor profile
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'https://example.com/actor' })
      });
      
      await checkActor(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject when actor not found in database', async () => {
      req.body = { type: 'Create', actor: 'https://example.com/actor' };
      
      const mockCollection = {
        findOne: jest.fn().mockResolvedValue(null)
      };
      mockDb.collection.mockReturnValue(mockCollection);
      
      await checkActor(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith('Not Found: Actor not found');
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass for non-POST requests', async () => {
      req.method = 'GET';
      
      await checkActor(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('checkAuth', () => {
    it('should pass with correct password', async () => {
      req.body = { password: 'test-password' };
      
      await checkAuth(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject with incorrect password', async () => {
      req.body = { password: 'wrong-password' };
      
      await checkAuth(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith('Unauthorized');
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject with missing password', async () => {
      req.body = {};
      
      await checkAuth(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith('Unauthorized');
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('getActorProfile', () => {
    it('should fetch and return actor profile', async () => {
      const mockProfile = { id: 'https://example.com/actor', name: 'Test Actor' };
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProfile)
      });
      
      const result = await getActorProfile('https://example.com/actor');
      
      expect(global.fetch).toHaveBeenCalledWith('https://example.com/actor', {
        headers: {
          'Accept': 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
        }
      });
      expect(result).toEqual(mockProfile);
    });

    it('should return null on fetch error', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });
      
      const result = await getActorProfile('https://example.com/actor');
      
      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));
      
      const result = await getActorProfile('https://example.com/actor');
      
      expect(result).toBeNull();
    });
  });
});