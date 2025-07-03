// Set environment variables first
process.env.MONGOURI = 'mongodb://localhost:27017/test';
process.env.PASSWORD = 'test-password';
process.env.NODE_ENV = 'test';

const { get: getOutbox, post: postOutbox } = require('../lib/outbox');
const client = require('../lib/db');
const { sendSignedRequest } = require('../lib/sign');
const { v4: uuidv4 } = require('uuid');

// Mock dependencies
jest.mock('../lib/db');
jest.mock('../lib/sign');
jest.mock('uuid');

describe('Outbox Module', () => {
  let req, res, mockDb, mockCollection;

  beforeEach(() => {
    req = {
      body: {}
    };
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
    uuidv4.mockReturnValue('test-uuid-123');
    sendSignedRequest.mockResolvedValue({ status: 200 });
  });

  describe('getOutbox', () => {
    it('should return outbox collection', async () => {
      const mockActivities = [
        { id: '1', type: 'Create', object: { type: 'Note', content: 'Hello' } },
        { id: '2', type: 'Like', object: 'https://example.com/note/123' }
      ];

      mockCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(mockActivities)
      });

      await getOutbox(req, res);

      expect(res.json).toHaveBeenCalledWith({
        "@context": "https://www.w3.org/ns/activitystreams",
        "type": "OrderedCollection",
        "id": "https://www.sneaas.no/u/trondss/outbox",
        "totalItems": 2,
        "first": "https://www.sneaas.no/u/trondss/outbox?page=true",
        "orderedItems": mockActivities
      });
    });

    it('should handle database errors gracefully', async () => {
      mockCollection.find.mockImplementation(() => {
        throw new Error('Database error');
      });

      await getOutbox(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith('Internal server error');
    });
  });

  describe('postOutbox', () => {
    describe('Create activity', () => {
      it('should handle create note activity', async () => {
        const createActivity = {
          type: 'Create',
          object: {
            type: 'Note',
            content: 'Hello world!',
            to: ['https://www.w3.org/ns/activitystreams#Public']
          }
        };
        req.body = createActivity;

        // Mock followers
        mockCollection.find.mockReturnValue({
          toArray: jest.fn().mockResolvedValue([
            { 
              id: 'https://example.com/actor1',
              inbox: 'https://example.com/actor1/inbox'
            },
            { 
              id: 'https://example.com/actor2',
              inbox: 'https://example.com/actor2/inbox'
            }
          ])
        });

        await postOutbox(req, res);

        // Verify activity was saved to outbox
        expect(mockCollection.insertOne).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'Create',
            actor: 'https://www.sneaas.no/u/trondss',
            published: expect.any(String),
            id: expect.stringContaining('https://www.sneaas.no/u/trondss/create/'),
            object: expect.objectContaining({
              type: 'Note',
              content: 'Hello world!',
              id: expect.stringContaining('https://www.sneaas.no/u/trondss/note/'),
              attributedTo: 'https://www.sneaas.no/u/trondss',
              published: expect.any(String)
            })
          })
        );

        // Verify delivery to followers
        expect(sendSignedRequest).toHaveBeenCalledTimes(2);
        expect(res.status).toHaveBeenCalledWith(200);
      });

      it('should handle create note with mentions', async () => {
        const createActivity = {
          type: 'Create',
          object: {
            type: 'Note',
            content: 'Hello @user@example.com!',
            to: ['https://www.w3.org/ns/activitystreams#Public'],
            tag: [
              {
                type: 'Mention',
                href: 'https://example.com/user',
                name: '@user@example.com'
              }
            ]
          }
        };
        req.body = createActivity;

        // Mock followers (empty for this test)
        mockCollection.find.mockReturnValue({
          toArray: jest.fn().mockResolvedValue([])
        });

        // Mock fetch for mentioned user's inbox
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            inbox: 'https://example.com/user/inbox'
          })
        });

        await postOutbox(req, res);

        // Verify delivery to mentioned user
        expect(sendSignedRequest).toHaveBeenCalledWith(
          'https://example.com/user/inbox',
          'https://www.sneaas.no/u/trondss#main-key',
          expect.objectContaining({
            type: 'Create',
            object: expect.objectContaining({
              tag: expect.arrayContaining([
                expect.objectContaining({
                  type: 'Mention',
                  href: 'https://example.com/user'
                })
              ])
            })
          })
        );

        expect(res.status).toHaveBeenCalledWith(200);
      });
    });

    describe('Like activity', () => {
      it('should handle like activity', async () => {
        const likeActivity = {
          type: 'Like',
          object: 'https://example.com/note/123'
        };
        req.body = likeActivity;

        // Mock fetch for the liked object to get its author's inbox
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            attributedTo: 'https://example.com/author',
            id: 'https://example.com/note/123'
          })
        });

        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            inbox: 'https://example.com/author/inbox'
          })
        });

        await postOutbox(req, res);

        // Verify like activity was saved
        expect(mockCollection.insertOne).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'Like',
            actor: 'https://www.sneaas.no/u/trondss',
            object: 'https://example.com/note/123',
            id: expect.stringContaining('https://www.sneaas.no/u/trondss/like/'),
            published: expect.any(String)
          })
        );

        // Verify delivery to object author
        expect(sendSignedRequest).toHaveBeenCalledWith(
          'https://example.com/author/inbox',
          'https://www.sneaas.no/u/trondss#main-key',
          expect.objectContaining({
            type: 'Like',
            object: 'https://example.com/note/123'
          })
        );

        expect(res.status).toHaveBeenCalledWith(200);
      });
    });

    describe('Follow activity', () => {
      it('should handle follow activity', async () => {
        const followActivity = {
          type: 'Follow',
          object: 'https://example.com/actor'
        };
        req.body = followActivity;

        // Mock fetch for the actor being followed
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            inbox: 'https://example.com/actor/inbox',
            id: 'https://example.com/actor'
          })
        });

        await postOutbox(req, res);

        // Verify follow activity was saved
        expect(mockCollection.insertOne).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'Follow',
            actor: 'https://www.sneaas.no/u/trondss',
            object: 'https://example.com/actor',
            id: expect.stringContaining('https://www.sneaas.no/u/trondss/follow/'),
            published: expect.any(String)
          })
        );

        // Verify delivery to followed actor
        expect(sendSignedRequest).toHaveBeenCalledWith(
          'https://example.com/actor/inbox',
          'https://www.sneaas.no/u/trondss#main-key',
          expect.objectContaining({
            type: 'Follow',
            object: 'https://example.com/actor'
          })
        );

        expect(res.status).toHaveBeenCalledWith(200);
      });
    });

    describe('Undo activity', () => {
      it('should handle undo follow', async () => {
        const undoActivity = {
          type: 'Undo',
          object: {
            type: 'Follow',
            id: 'https://www.sneaas.no/u/trondss/follow/123',
            object: 'https://example.com/actor'
          }
        };
        req.body = undoActivity;

        // Mock finding the original follow activity
        mockCollection.findOne.mockResolvedValue({
          id: 'https://www.sneaas.no/u/trondss/follow/123',
          type: 'Follow',
          object: 'https://example.com/actor'
        });

        // Mock fetch for the actor being unfollowed
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            inbox: 'https://example.com/actor/inbox'
          })
        });

        await postOutbox(req, res);

        // Verify undo activity was saved
        expect(mockCollection.insertOne).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'Undo',
            actor: 'https://www.sneaas.no/u/trondss',
            object: expect.objectContaining({
              type: 'Follow',
              object: 'https://example.com/actor'
            }),
            id: expect.stringContaining('https://www.sneaas.no/u/trondss/undo/'),
            published: expect.any(String)
          })
        );

        // Verify delivery to unfollowed actor
        expect(sendSignedRequest).toHaveBeenCalledWith(
          'https://example.com/actor/inbox',
          'https://www.sneaas.no/u/trondss#main-key',
          expect.objectContaining({
            type: 'Undo',
            object: expect.objectContaining({
              type: 'Follow'
            })
          })
        );

        expect(res.status).toHaveBeenCalledWith(200);
      });
    });

    describe('Unknown activity type', () => {
      it('should handle unknown activity type', async () => {
        const unknownActivity = {
          type: 'UnknownType',
          object: 'https://example.com/something'
        };
        req.body = unknownActivity;

        await postOutbox(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
      });
    });

    describe('Error handling', () => {
      it('should handle database errors', async () => {
        req.body = { type: 'Create', object: { type: 'Note', content: 'Test' } };

        mockDb.collection.mockImplementation(() => {
          throw new Error('Database error');
        });

        await postOutbox(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.send).toHaveBeenCalledWith('Internal server error');
      });

      it('should handle delivery failures gracefully', async () => {
        const createActivity = {
          type: 'Create',
          object: {
            type: 'Note',
            content: 'Hello world!',
            to: ['https://www.w3.org/ns/activitystreams#Public']
          }
        };
        req.body = createActivity;

        // Mock followers
        mockCollection.find.mockReturnValue({
          toArray: jest.fn().mockResolvedValue([
            { 
              id: 'https://example.com/actor1',
              inbox: 'https://example.com/actor1/inbox'
            }
          ])
        });

        // Mock delivery failure
        sendSignedRequest.mockRejectedValue(new Error('Delivery failed'));

        await postOutbox(req, res);

        // Should still save to outbox and return 200
        expect(mockCollection.insertOne).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
      });
    });
  });
});