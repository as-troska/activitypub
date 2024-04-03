function webfinger(req, res) {
    const resource = req.query.resource;
    const username = resource.split(':')[1].split('@')[0];

    if (username === 'trondss') {
        res.set('Content-Type', 'application/jrd+json');
        res.json({
            subject: `acct:${username}@sneaas.no`,
            links: [
                {
                    rel: 'self',
                    type: 'application/activity+json',
                    href: `https://www.sneaas.no/u/${username}`
                }
            ]
        });
    } else {
        res.status(404).send('Not Found');
    }
}

function nodeinfo(req, res) {
    res.json({
        links: [
            {
                rel: 'http://nodeinfo.diaspora.software/ns/schema/2.0',
                href: 'https://www.sneaas.no/nodeinfo/2.0.json'
            }
        ]
    });
}

function nodeinfo2(req, res) {
    res.json({
        version: '2.0',
        software: {
            name: 'sneaas',
            version: '1.0.0'
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
        metadata: {}
    });
}


exports.webfinger = webfinger;
exports.nodeinfo = nodeinfo;
exports.nodeinfo2 = nodeinfo2;