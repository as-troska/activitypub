const client = require('./db');
const log = require('./logger');

const DATABASE = 'activitypub';
const FOLLOWERS_COLLECTION = 'followers';

async function getFollowers(req, res) {
    try {
        log.debug('Fetching followers list', {
            userAgent: req.get('User-Agent'),
            ip: req.ip
        });
        
        const collection = client.db(DATABASE).collection(FOLLOWERS_COLLECTION);
        
        let results;
        try {
            results = await Promise.all([
                collection.countDocuments(),
                collection.find().toArray()
            ]);
        } catch (dbError) {
            log.error('Database error fetching followers', dbError, {
                database: DATABASE,
                collection: FOLLOWERS_COLLECTION
            });
            return res.status(500).json({
                error: 'Internal server error',
                message: 'Database error'
            });
        }
        
        const totalItems = results[0];
        const followers = results[1];

        log.dbOperation('find', FOLLOWERS_COLLECTION, {}, followers);
        
        const followersCollection = {
            '@context': 'https://www.w3.org/ns/activitystreams',
            summary: "trondss' followers",
            id: 'https://www.sneaas.no/u/trondss/followers',
            type: 'OrderedCollection',
            totalItems: totalItems,
            first: 'https://www.sneaas.no/u/trondss/followers?page=true',
            orderedItems: followers
        };

        log.info('Followers list retrieved successfully', {
            totalFollowers: totalItems,
            userAgent: req.get('User-Agent')
        });

        res.json(followersCollection);
    } catch (error) {
        log.error('Error fetching followers', error, {
            userAgent: req.get('User-Agent'),
            url: req.url
        });
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to fetch followers'
        });
    }
}

async function refreshFollowers() {
    try {
        log.info('Starting followers refresh process');
        
        const collection = client.db(DATABASE).collection(FOLLOWERS_COLLECTION);
        
        let followers;
        try {
            followers = await collection.find().toArray();
        } catch (dbError) {
            log.error('Database error fetching followers for refresh', dbError, {
                database: DATABASE,
                collection: FOLLOWERS_COLLECTION
            });
            return;
        }

        if (followers.length === 0) {
            log.info('No followers found to refresh');
            return;
        }

        log.info('Refreshing ' + followers.length + ' followers...');

        const refreshPromises = followers.map(async (follower) => {
            try {
                if (!follower.id) {
                    log.warn('Skipping follower with missing id', { follower: follower });
                    return;
                }

                log.debug('Refreshing follower profile', { followerId: follower.id });

                const response = await fetch(follower.id, {
                    headers: {
                        'Accept': 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
                        'User-Agent': 'Sneaas.no ActivityPub Server'
                    },
                    timeout: 15000
                });

                if (!response.ok) {
                    throw new Error('HTTP ' + response.status + ': ' + response.statusText);
                }

                let actorProfile;
                try {
                    actorProfile = await response.json();
                } catch (parseError) {
                    throw new Error('Failed to parse JSON response: ' + parseError.message);
                }

                if (!actorProfile.id) {
                    throw new Error('Invalid actor profile: missing id');
                }

                if (actorProfile.id !== follower.id) {
                    log.warn('Actor profile ID mismatch during refresh', {
                        expected: follower.id,
                        received: actorProfile.id
                    });
                }

                await collection.updateOne(
                    { id: follower.id }, 
                    { $set: actorProfile }
                );

                log.debug('Refreshed follower: ' + follower.id, {
                    followerId: follower.id,
                    followerName: actorProfile.name,
                    followerType: actorProfile.type
                });

            } catch (error) {
                log.error('Error refreshing follower ' + follower.id, error, {
                    followerId: follower.id,
                    errorType: error.constructor.name
                });
            }
        });

        const results = await Promise.allSettled(refreshPromises);
        
        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const errorCount = results.filter(r => r.status === 'rejected').length;
        
        log.info('Followers refresh completed', {
            totalFollowers: followers.length,
            successCount: successCount,
            errorCount: errorCount
        });
        
    } catch (error) {
        log.error('Error during followers refresh process', error);
    }
}





exports.get = getFollowers;
exports.refresh = refreshFollowers;