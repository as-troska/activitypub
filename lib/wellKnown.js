const log = require('./logger');

function webfinger(req, res) {
    try {
        const resource = req.query.resource;
        
        log.debug('Webfinger request received', {
            resource: resource,
            userAgent: req.get('User-Agent'),
            ip: req.ip
        });
        
        if (!resource) {
            log.warn('Webfinger request missing resource parameter', null, {
                query: req.query,
                userAgent: req.get('User-Agent')
            });
            return res.status(400).json({ 
                error: 'Missing required parameter: resource' 
            });
        }

        // Parse resource format: acct:username@domain
        const resourceParts = resource.split(':');
        if (resourceParts.length !== 2 || resourceParts[0] !== 'acct') {
            log.warn('Invalid webfinger resource format', null, {
                resource: resource,
                resourceParts: resourceParts,
                userAgent: req.get('User-Agent')
            });
            return res.status(400).json({ 
                error: 'Invalid resource format. Expected: acct:username@domain' 
            });
        }

        const accountParts = resourceParts[1].split('@');
        if (accountParts.length !== 2) {
            log.warn('Invalid webfinger account format', null, {
                resource: resource,
                accountPart: resourceParts[1],
                userAgent: req.get('User-Agent')
            });
            return res.status(400).json({ 
                error: 'Invalid account format. Expected: username@domain' 
            });
        }

        const username = accountParts[0];
        const domain = accountParts[1];
        
        log.debug('Webfinger parsed successfully', {
            username: username,
            domain: domain,
            resource: resource
        });
        
        // Only support our user on our domains
        if (username === 'trondss' && (domain === 'sneaas.no' || domain === 'www.sneaas.no')) {
            log.info('Webfinger successful lookup', {
                username: username,
                domain: domain,
                userAgent: req.get('User-Agent')
            });
            
            res.set('Content-Type', 'application/jrd+json');
            return res.json({
                subject: resource,
                links: [{
                    rel: 'self',
                    type: 'application/activity+json',
                    href: 'https://www.sneaas.no/u/' + username
                }]
            });
        }

        log.warn('Webfinger user not found', null, {
            requestedUsername: username,
            requestedDomain: domain,
            resource: resource,
            userAgent: req.get('User-Agent')
        });

        return res.status(404).json({ 
            error: 'User not found' 
        });
    } catch (error) {
        log.error('Webfinger error', error, {
            resource: req.query.resource,
            userAgent: req.get('User-Agent')
        });
        return res.status(500).json({ 
            error: 'Internal server error' 
        });
    }
}

function nodeinfo(req, res) {
    try {
        log.debug('NodeInfo discovery request', {
            userAgent: req.get('User-Agent'),
            ip: req.ip
        });
        
        const nodeinfo = {
            links: [{
                rel: 'http://nodeinfo.diaspora.software/ns/schema/2.0',
                href: 'https://www.sneaas.no/nodeinfo/2.0.json'
            }]
        };
        
        log.info('NodeInfo discovery response sent', {
            userAgent: req.get('User-Agent')
        });
        
        res.json(nodeinfo);
    } catch (error) {
        log.error('NodeInfo discovery error', error, {
            userAgent: req.get('User-Agent')
        });
        res.status(500).json({ 
            error: 'Internal server error' 
        });
    }
}

function nodeinfo2(req, res) {
    try {
        log.debug('NodeInfo 2.0 request', {
            userAgent: req.get('User-Agent'),
            ip: req.ip
        });
        
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
        
        log.info('NodeInfo 2.0 response sent', {
            userAgent: req.get('User-Agent'),
            version: nodeinfo.version,
            software: nodeinfo.software.name
        });
        
        res.json(nodeinfo);
    } catch (error) {
        log.error('NodeInfo 2.0 error', error, {
            userAgent: req.get('User-Agent')
        });
        res.status(500).json({ 
            error: 'Internal server error' 
        });
    }
}


exports.webfinger = webfinger;
exports.nodeinfo = nodeinfo;
exports.nodeinfo2 = nodeinfo2;