// Set environment variables first
process.env.MONGOURI = 'mongodb://localhost:27017/test';
process.env.PASSWORD = 'test-password';
process.env.NODE_ENV = 'test';

const { get: getFollowers, refresh: refreshFollowers } = require('../lib/followers');
const client = require('../lib/db');

// Mock dependencies
jest.mock('../lib/db');

describe('Followers Module', () => {
  let req, res, mockDb, mockCollection;

  beforeEach(() => {
    req = {};
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn()
    };

    mockCollection = {
      find: jest.fn(),
      findOne: jest.fn(),
      insertOne: jest.fn(),
      updateOne: jest.fn(),
      deleteOne: jest.fn(),
      toArray: jest.fn()
    };

    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection)
    };

    client.db = jest.fn().mockReturnValue(mockDb);
    
    // Reset mocks
    jest.clearAllMocks();
    global.fetch.mockClear();
  });

  describe('getFollowers', () => {
    it('should return followers collection', async () => {
      const mockFollowers = [
        { 
          id: 'https://example.com/actor1',
          name: 'Actor 1',
          preferredUsername: 'actor1'
        },
        { 
          id: 'https://example.com/actor2',
          name: 'Actor 2', 
          preferredUsername: 'actor2'
        }
      ];

      mockCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(mockFollowers)
      });

      await getFollowers(req, res);

      expect(res.json).toHaveBeenCalledWith({
        "@context": "https://www.w3.org/ns/activitystreams",
        "type": "OrderedCollection",
        "id": "https://www.sneaas.no/u/trondss/followers",
        "totalItems": 2,
        "first": "https://www.sneaas.no/u/trondss/followers?page=true",
        "orderedItems": mockFollowers
      });
    });

    it('should handle empty followers list', async () => {
      mockCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([])
      });

      await getFollowers(req, res);

      expect(res.json).toHaveBeenCalledWith({
        "@context": "https://www.w3.org/ns/activitystreams",
        "type": "OrderedCollection",
        "id": "https://www.sneaas.no/u/trondss/followers",
        "totalItems": 0,
        "first": "https://www.sneaas.no/u/trondss/followers?page=true",
        "orderedItems": []
      });
    });

    it('should handle database errors gracefully', async () => {
      mockCollection.find.mockImplementation(() => {
        throw new Error('Database error');
      });

      await getFollowers(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith('Internal server error');
    });
  });

  describe('refreshFollowers', () => {
    it('should refresh follower profiles', async () => {
      const mockFollowers = [
        { 
          id: 'https://example.com/actor1',
          name: 'Old Name 1'
        },
        { 
          id: 'https://example.com/actor2',
          name: 'Old Name 2'
        }
      ];

      mockCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(mockFollowers)
      });

      // Mock fetch responses for refreshing profiles
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'https://example.com/actor1',
            name: 'Updated Name 1',
            preferredUsername: 'actor1_updated'
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'https://example.com/actor2',
            name: 'Updated Name 2',
            preferredUsername: 'actor2_updated'
          })
        });

      await refreshFollowers();

      // Verify fetch was called for each follower
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenCalledWith('https://example.com/actor1', {
        headers: {
          'Accept': 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
        }
      });
      expect(global.fetch).toHaveBeenCalledWith('https://example.com/actor2', {
        headers: {
          'Accept': 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
        }
      });

      // Verify database updates
      expect(mockCollection.updateOne).toHaveBeenCalledTimes(2);
      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { id: 'https://example.com/actor1' },
        { 
          $set: {
            id: 'https://example.com/actor1',
            name: 'Updated Name 1',
            preferredUsername: 'actor1_updated'
          }
        }
      );
      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { id: 'https://example.com/actor2' },
        { 
          $set: {
            id: 'https://example.com/actor2',
            name: 'Updated Name 2',
            preferredUsername: 'actor2_updated'
          }
        }
      );
    });

    it('should handle fetch failures gracefully', async () => {
      const mockFollowers = [
        { id: 'https://example.com/actor1', name: 'Actor 1' }
      ];

      mockCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(mockFollowers)
      });

      // Mock fetch failure
      global.fetch.mockRejectedValue(new Error('Network error'));

      await refreshFollowers();

      // Should not crash, just log error
      expect(mockCollection.updateOne).not.toHaveBeenCalled();
    });

    it('should handle non-ok fetch responses', async () => {
      const mockFollowers = [
        { id: 'https://example.com/actor1', name: 'Actor 1' }
      ];

      mockCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(mockFollowers)
      });

      // Mock 404 response
      global.fetch.mockResolvedValue({
        ok: false,
        status: 404
      });

      await refreshFollowers();

      // Should not update database for failed fetches
      expect(mockCollection.updateOne).not.toHaveBeenCalled();
    });

    it('should handle database errors during refresh', async () => {
      mockCollection.find.mockImplementation(() => {
        throw new Error('Database error');
      });

      // Should not crash
      await expect(refreshFollowers()).resolves.toBeUndefined();
    });

    it('should handle empty followers list during refresh', async () => {
      mockCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([])
      });

      await refreshFollowers();

      // Should not make any fetch calls
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockCollection.updateOne).not.toHaveBeenCalled();
    });
  });
});