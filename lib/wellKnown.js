function webfinger(req, res) {
    try {
        const resource = req.query.resource;
        
        if (!resource) {
            return res.status(400).json({ 
                error: 'Missing required parameter: resource' 
            });
        }

        // Parse resource format: acct:username@domain
        const resourceParts = resource.split(':');
        if (resourceParts.length !== 2 || resourceParts[0] !== 'acct') {
            return res.status(400).json({ 
                error: 'Invalid resource format. Expected: acct:username@domain' 
            });
        }

        const accountParts = resourceParts[1].split('@');
        if (accountParts.length !== 2) {
            return res.status(400).json({ 
                error: 'Invalid account format. Expected: username@domain' 
            });
        }

        const [username, domain] = accountParts;
        
        // Only support our user on our domains
        if (username === 'trondss' && (domain === 'sneaas.no' || domain === 'www.sneaas.no')) {
            res.set('Content-Type', 'application/jrd+json');
            return res.json({
                subject: resource,
                links: [{
                    rel: 'self',
                    type: 'application/activity+json',
                    href: `https://www.sneaas.no/u/${username}`
                }]
            });
        }

        return res.status(404).json({ 
            error: 'User not found' 
        });
    } catch (error) {
        console.error('🚨 Webfinger error:', error);
        return res.status(500).json({ 
            error: 'Internal server error' 
        });
    }
}

function nodeinfo(req, res) {
    try {
        const nodeinfo = {
            links: [{
                rel: 'http://nodeinfo.diaspora.software/ns/schema/2.0',
                href: 'https://www.sneaas.no/nodeinfo/2.0.json'
            }]
        };
        
        res.json(nodeinfo);
    } catch (error) {
        console.error('🚨 NodeInfo error:', error);
        res.status(500).json({ 
            error: 'Internal server error' 
        });
    }
}

function nodeinfo2(req, res) {
    try {
        const nodeinfo = {
            version: '2.0',
            software: {
                name: 'sneaas',
                version: '1.5.0'
            },
            protocols: ['activitypub'],
            services: {
                inbound: [],
                outbound: []
            },
            openRegistrations: false,
            usage: {
                users: {
                    total: 1
                }
            },
            metadata: {
                nodeName: 'Sneaas.no',
                nodeDescription: 'ActivityPub implementation for a personal blog.',
                maintainer: {
                    name: 'Trond Sneås Skauge',
                    email: 'trondss@gmail.com'
                },
                sourceCode: 'https://github.com/as-troska/activitypub'
            }
        };
        
        res.json(nodeinfo);
    } catch (error) {
        console.error('🚨 NodeInfo 2.0 error:', error);
        res.status(500).json({ 
            error: 'Internal server error' 
        });
    }
}


exports.webfinger = webfinger;
exports.nodeinfo = nodeinfo;
exports.nodeinfo2 = nodeinfo2;