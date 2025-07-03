const { get: getInbox, post: postInbox } = require('../lib/inbox');
const client = require('../lib/db');
const { sendSignedRequest } = require('../lib/sign');
const { v4: uuidv4 } = require('uuid');

// Mock dependencies
jest.mock('../lib/db');
jest.mock('../lib/sign');
jest.mock('uuid');

describe('Inbox Module', () => {
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
  });

  describe('getInbox', () => {
    it('should return inbox collection with public items', async () => {
      const mockDocs = [
        { id: '1', type: 'Create', to: 'https://www.w3.org/ns/activitystreams#Public' },
        { id: '2', type: 'Like', to: 'https://www.w3.org/ns/activitystreams#Public' }
      ];

      mockCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(mockDocs)
      });

      await getInbox(req, res);

      expect(mockCollection.find).toHaveBeenCalledWith({ 
        "to": "https://www.w3.org/ns/activitystreams#Public" 
      });
      expect(res.json).toHaveBeenCalledWith({
        "@context": "https://www.w3.org/ns/activitystreams",
        "type": "OrderedCollection",
        "totalItems": 2,
        "first": "https://www.sneaas.no/u/trondss/inbox?page=true",
        "orderedItems": mockDocs
      });
    });

    it('should handle database errors gracefully', async () => {
      mockCollection.find.mockImplementation(() => {
        throw new Error('Database error');
      });

      await getInbox(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith('Internal server error');
    });
  });

  describe('postInbox', () => {
    describe('Follow activity', () => {
      it('should handle new follow request', async () => {
        const followActivity = {
          type: 'Follow',
          id: 'https://example.com/follow/123',
          actor: 'https://example.com/actor'
        };
        req.body = followActivity;

        // Mock collections
        const followersCollection = { ...mockCollection, findOne: jest.fn().mockResolvedValue(null) };
        const acceptCollection = { ...mockCollection };
        const followActivitiesCollection = { ...mockCollection };

        mockDb.collection
          .mockReturnValueOnce(followersCollection) // followers
          .mockReturnValueOnce(followActivitiesCollection) // followActivities
          .mockReturnValueOnce(mockCollection) // notes
          .mockReturnValueOnce(mockCollection) // likes
          .mockReturnValueOnce(mockCollection) // follows
          .mockReturnValueOnce(mockCollection) // announces
          .mockReturnValueOnce(acceptCollection) // accept
          .mockReturnValueOnce(mockCollection) // comments
          .mockReturnValueOnce(mockCollection) // outbox
          .mockReturnValueOnce(mockCollection); // create

        // Mock actor profile fetch
        global.fetch.mockResolvedValueOnce({
          headers: { 'Accept': 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"' },
          json: () => Promise.resolve({ 
            id: 'https://example.com/actor', 
            name: 'Test Actor' 
          })
        });

        // Mock sendSignedRequest
        sendSignedRequest.mockResolvedValue({ status: 200 });

        await postInbox(req, res);

        expect(sendSignedRequest).toHaveBeenCalledWith(
          'https://example.com/actor/inbox',
          'https://www.sneaas.no/u/trondss#main-key',
          expect.objectContaining({
            type: 'Accept',
            actor: 'https://www.sneaas.no/u/trondss',
            object: followActivity.id
          })
        );
        expect(acceptCollection.insertOne).toHaveBeenCalled();
        expect(followersCollection.insertOne).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
      });

      it('should handle existing follower', async () => {
        const followActivity = {
          type: 'Follow',
          id: 'https://example.com/follow/123',
          actor: 'https://example.com/actor'
        };
        req.body = followActivity;

        // Mock existing follower
        const followersCollection = { 
          ...mockCollection, 
          findOne: jest.fn().mockResolvedValue({ id: 'https://example.com/actor' }) 
        };
        const acceptCollection = { ...mockCollection };

        mockDb.collection
          .mockReturnValueOnce(followersCollection)
          .mockReturnValueOnce(mockCollection) // followActivities
          .mockReturnValueOnce(mockCollection) // notes
          .mockReturnValueOnce(mockCollection) // likes
          .mockReturnValueOnce(mockCollection) // follows
          .mockReturnValueOnce(mockCollection) // announces
          .mockReturnValueOnce(acceptCollection) // accept
          .mockReturnValueOnce(mockCollection) // comments
          .mockReturnValueOnce(mockCollection) // outbox
          .mockReturnValueOnce(mockCollection); // create

        sendSignedRequest.mockResolvedValue({ status: 200 });

        await postInbox(req, res);

        expect(acceptCollection.insertOne).toHaveBeenCalled();
        expect(followersCollection.insertOne).not.toHaveBeenCalled(); // Should not add existing follower
        expect(res.status).toHaveBeenCalledWith(200);
      });
    });

    describe('Like activity', () => {
      it('should handle new like', async () => {
        const likeActivity = {
          type: 'Like',
          id: 'https://example.com/like/123',
          actor: 'https://example.com/actor',
          object: 'https://www.sneaas.no/note/456'
        };
        req.body = likeActivity;

        const likesCollection = { 
          ...mockCollection, 
          findOne: jest.fn().mockResolvedValue(null) 
        };
        const createCollection = { ...mockCollection };

        mockDb.collection
          .mockReturnValueOnce(mockCollection) // followers
          .mockReturnValueOnce(mockCollection) // followActivities
          .mockReturnValueOnce(mockCollection) // notes
          .mockReturnValueOnce(likesCollection) // likes
          .mockReturnValueOnce(mockCollection) // follows
          .mockReturnValueOnce(mockCollection) // announces
          .mockReturnValueOnce(mockCollection) // accept
          .mockReturnValueOnce(mockCollection) // comments
          .mockReturnValueOnce(mockCollection) // outbox
          .mockReturnValueOnce(createCollection); // create

        await postInbox(req, res);

        expect(likesCollection.insertOne).toHaveBeenCalledWith({
          id: likeActivity.id,
          actor: likeActivity.actor,
          object: likeActivity.object
        });
        expect(createCollection.updateOne).toHaveBeenCalledWith(
          { id: likeActivity.object },
          { $inc: { likes: 1 } }
        );
        expect(res.status).toHaveBeenCalledWith(200);
      });

      it('should handle existing like', async () => {
        const likeActivity = {
          type: 'Like',
          id: 'https://example.com/like/123',
          actor: 'https://example.com/actor',
          object: 'https://www.sneaas.no/note/456'
        };
        req.body = likeActivity;

        const likesCollection = { 
          ...mockCollection, 
          findOne: jest.fn().mockResolvedValue({ id: likeActivity.id }) 
        };

        mockDb.collection
          .mockReturnValueOnce(mockCollection) // followers
          .mockReturnValueOnce(mockCollection) // followActivities
          .mockReturnValueOnce(mockCollection) // notes
          .mockReturnValueOnce(likesCollection) // likes
          .mockReturnValueOnce(mockCollection) // follows
          .mockReturnValueOnce(mockCollection) // announces
          .mockReturnValueOnce(mockCollection) // accept
          .mockReturnValueOnce(mockCollection) // comments
          .mockReturnValueOnce(mockCollection) // outbox
          .mockReturnValueOnce(mockCollection); // create

        await postInbox(req, res);

        expect(likesCollection.insertOne).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
      });
    });

    describe('Undo activity', () => {
      it('should handle undo follow', async () => {
        const undoActivity = {
          type: 'Undo',
          actor: 'https://example.com/actor',
          object: {
            type: 'Follow',
            id: 'https://example.com/follow/123'
          }
        };
        req.body = undoActivity;

        const followersCollection = { ...mockCollection };
        const followActivitiesCollection = { ...mockCollection };

        mockDb.collection
          .mockReturnValueOnce(followersCollection) // followers
          .mockReturnValueOnce(followActivitiesCollection) // followActivities
          .mockReturnValueOnce(mockCollection) // notes
          .mockReturnValueOnce(mockCollection) // likes
          .mockReturnValueOnce(mockCollection) // follows
          .mockReturnValueOnce(mockCollection) // announces
          .mockReturnValueOnce(mockCollection) // accept
          .mockReturnValueOnce(mockCollection) // comments
          .mockReturnValueOnce(mockCollection) // outbox
          .mockReturnValueOnce(mockCollection); // create

        await postInbox(req, res);

        expect(followersCollection.deleteOne).toHaveBeenCalledWith({
          actor: undoActivity.actor
        });
        expect(followActivitiesCollection.deleteOne).toHaveBeenCalledWith({
          id: undoActivity.object.id
        });
        expect(res.status).toHaveBeenCalledWith(200);
      });

      it('should handle undo like', async () => {
        const undoActivity = {
          type: 'Undo',
          actor: 'https://example.com/actor',
          object: {
            type: 'Like',
            id: 'https://example.com/like/123',
            object: 'https://www.sneaas.no/note/456'
          }
        };
        req.body = undoActivity;

        const createCollection = { 
          ...mockCollection, 
          findOne: jest.fn().mockResolvedValue({ id: undoActivity.object.object }) 
        };
        const likesCollection = { ...mockCollection };

        mockDb.collection
          .mockReturnValueOnce(mockCollection) // followers
          .mockReturnValueOnce(mockCollection) // followActivities
          .mockReturnValueOnce(mockCollection) // notes
          .mockReturnValueOnce(likesCollection) // likes
          .mockReturnValueOnce(mockCollection) // follows
          .mockReturnValueOnce(mockCollection) // announces
          .mockReturnValueOnce(mockCollection) // accept
          .mockReturnValueOnce(mockCollection) // comments
          .mockReturnValueOnce(mockCollection) // outbox
          .mockReturnValueOnce(createCollection); // create

        await postInbox(req, res);

        expect(createCollection.updateOne).toHaveBeenCalledWith(
          { id: undoActivity.object.object },
          { $inc: { likes: -1 } }
        );
        expect(likesCollection.deleteOne).toHaveBeenCalledWith({
          id: undoActivity.object.id
        });
        expect(res.status).toHaveBeenCalledWith(200);
      });
    });

    describe('Create activity', () => {
      it('should handle create note (reply)', async () => {
        const createActivity = {
          type: 'Create',
          object: {
            type: 'Note',
            id: 'https://example.com/note/123',
            inReplyTo: 'https://www.sneaas.no/note/456',
            content: 'This is a reply'
          }
        };
        req.body = createActivity;

        const createCollection = { 
          ...mockCollection, 
          findOne: jest.fn().mockResolvedValue({ id: createActivity.object.inReplyTo }) 
        };
        const commentsCollection = { ...mockCollection };

        mockDb.collection
          .mockReturnValueOnce(mockCollection) // followers
          .mockReturnValueOnce(mockCollection) // followActivities
          .mockReturnValueOnce(mockCollection) // notes
          .mockReturnValueOnce(mockCollection) // likes
          .mockReturnValueOnce(mockCollection) // follows
          .mockReturnValueOnce(mockCollection) // announces
          .mockReturnValueOnce(mockCollection) // accept
          .mockReturnValueOnce(commentsCollection) // comments
          .mockReturnValueOnce(mockCollection) // outbox
          .mockReturnValueOnce(createCollection); // create

        await postInbox(req, res);

        expect(createCollection.updateOne).toHaveBeenCalledWith(
          { id: createActivity.object.inReplyTo },
          { $inc: { replies: 1 } }
        );
        expect(commentsCollection.insertOne).toHaveBeenCalledWith(createActivity.object);
        expect(res.status).toHaveBeenCalledWith(200);
      });

      it('should handle create note (not a reply)', async () => {
        const createActivity = {
          type: 'Create',
          object: {
            type: 'Note',
            id: 'https://example.com/note/123',
            content: 'This is a note'
          }
        };
        req.body = createActivity;

        const notesCollection = { ...mockCollection };

        mockDb.collection
          .mockReturnValueOnce(mockCollection) // followers
          .mockReturnValueOnce(mockCollection) // followActivities
          .mockReturnValueOnce(notesCollection) // notes
          .mockReturnValueOnce(mockCollection) // likes
          .mockReturnValueOnce(mockCollection) // follows
          .mockReturnValueOnce(mockCollection) // announces
          .mockReturnValueOnce(mockCollection) // accept
          .mockReturnValueOnce(mockCollection) // comments
          .mockReturnValueOnce(mockCollection) // outbox
          .mockReturnValueOnce(mockCollection); // create

        await postInbox(req, res);

        expect(notesCollection.insertOne).toHaveBeenCalledWith(createActivity.object);
        expect(res.status).toHaveBeenCalledWith(200);
      });
    });

    describe('Delete activity', () => {
      it('should handle delete note by correct actor', async () => {
        const deleteActivity = {
          type: 'Delete',
          actor: 'https://example.com/actor',
          object: {
            type: 'Note',
            id: 'https://example.com/note/123'
          }
        };
        req.body = deleteActivity;

        const createCollection = { 
          ...mockCollection, 
          findOne: jest.fn().mockResolvedValue({ 
            id: deleteActivity.object.id,
            attributedTo: deleteActivity.actor 
          }) 
        };

        mockDb.collection
          .mockReturnValueOnce(mockCollection) // followers
          .mockReturnValueOnce(mockCollection) // followActivities
          .mockReturnValueOnce(mockCollection) // notes
          .mockReturnValueOnce(mockCollection) // likes
          .mockReturnValueOnce(mockCollection) // follows
          .mockReturnValueOnce(mockCollection) // announces
          .mockReturnValueOnce(mockCollection) // accept
          .mockReturnValueOnce(mockCollection) // comments
          .mockReturnValueOnce(mockCollection) // outbox
          .mockReturnValueOnce(createCollection); // create

        await postInbox(req, res);

        expect(createCollection.deleteOne).toHaveBeenCalledWith({
          id: deleteActivity.object.id
        });
        expect(res.status).toHaveBeenCalledWith(200);
      });

      it('should reject delete by wrong actor', async () => {
        const deleteActivity = {
          type: 'Delete',
          actor: 'https://example.com/actor',
          object: {
            type: 'Note',
            id: 'https://example.com/note/123'
          }
        };
        req.body = deleteActivity;

        const createCollection = { 
          ...mockCollection, 
          findOne: jest.fn().mockResolvedValue({ 
            id: deleteActivity.object.id,
            attributedTo: 'https://different.com/actor' // Different actor
          }) 
        };

        mockDb.collection
          .mockReturnValueOnce(mockCollection) // followers
          .mockReturnValueOnce(mockCollection) // followActivities
          .mockReturnValueOnce(mockCollection) // notes
          .mockReturnValueOnce(mockCollection) // likes
          .mockReturnValueOnce(mockCollection) // follows
          .mockReturnValueOnce(mockCollection) // announces
          .mockReturnValueOnce(mockCollection) // accept
          .mockReturnValueOnce(mockCollection) // comments
          .mockReturnValueOnce(mockCollection) // outbox
          .mockReturnValueOnce(createCollection); // create

        await postInbox(req, res);

        expect(createCollection.deleteOne).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
      });
    });

    describe('Unknown activity type', () => {
      it('should handle unknown activity type', async () => {
        const unknownActivity = {
          type: 'UnknownType',
          actor: 'https://example.com/actor'
        };
        req.body = unknownActivity;

        // Set up basic collections
        mockDb.collection.mockReturnValue(mockCollection);

        await postInbox(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
      });
    });

    describe('Error handling', () => {
      it('should handle database errors', async () => {
        req.body = { type: 'Follow', actor: 'https://example.com/actor' };

        mockDb.collection.mockImplementation(() => {
          throw new Error('Database error');
        });

        await postInbox(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.send).toHaveBeenCalledWith('Internal server error');
      });
    });
  });
});