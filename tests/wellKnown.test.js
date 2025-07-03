const wellKnown = require('../lib/wellKnown');

describe('WellKnown Module', () => {
  let req, res;

  beforeEach(() => {
    req = {
      query: {}
    };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn()
    };

    jest.clearAllMocks();
  });

  describe('webfinger', () => {
    it('should return correct webfinger response for valid resource', () => {
      req.query.resource = 'acct:trondss@sneaas.no';

      wellKnown.webfinger(req, res);

      expect(res.json).toHaveBeenCalledWith({
        subject: 'acct:trondss@sneaas.no',
        links: [
          {
            rel: 'self',
            type: 'application/activity+json',
            href: 'https://www.sneaas.no/u/trondss'
          }
        ]
      });
    });

    it('should return correct webfinger response for www domain', () => {
      req.query.resource = 'acct:trondss@www.sneaas.no';

      wellKnown.webfinger(req, res);

      expect(res.json).toHaveBeenCalledWith({
        subject: 'acct:trondss@www.sneaas.no',
        links: [
          {
            rel: 'self',
            type: 'application/activity+json',
            href: 'https://www.sneaas.no/u/trondss'
          }
        ]
      });
    });

    it('should handle invalid user in resource', () => {
      req.query.resource = 'acct:invaliduser@sneaas.no';

      wellKnown.webfinger(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith('User not found');
    });

    it('should handle invalid domain in resource', () => {
      req.query.resource = 'acct:trondss@invalid.com';

      wellKnown.webfinger(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith('User not found');
    });

    it('should handle malformed resource', () => {
      req.query.resource = 'invalidformat';

      wellKnown.webfinger(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Invalid resource format');
    });

    it('should handle missing resource parameter', () => {
      // req.query.resource is undefined

      wellKnown.webfinger(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Missing resource parameter');
    });
  });

  describe('nodeinfo', () => {
    it('should return correct nodeinfo response', () => {
      wellKnown.nodeinfo(req, res);

      expect(res.json).toHaveBeenCalledWith({
        links: [
          {
            rel: 'http://nodeinfo.diaspora.software/ns/schema/2.0',
            href: 'https://www.sneaas.no/nodeinfo/2.0.json'
          }
        ]
      });
    });
  });

  describe('nodeinfo2', () => {
    it('should return correct nodeinfo 2.0 response', () => {
      wellKnown.nodeinfo2(req, res);

      expect(res.json).toHaveBeenCalledWith({
        version: '2.0',
        software: {
          name: 'sneaas',
          version: '1.0.0'
        },
        protocols: ['activitypub'],
        usage: {
          users: {
            total: 1,
            activeMonth: 1,
            activeHalfyear: 1
          },
          localPosts: 0
        },
        openRegistrations: false,
        metadata: {
          nodeName: 'Sneaas.no',
          nodeDescription: 'Personal ActivityPub implementation'
        }
      });
    });
  });
});