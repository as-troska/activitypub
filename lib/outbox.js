const client = require('./db');
const sign = require('./sign');
const uuid = require('uuid');
const log = require('./logger');

const sendSignedRequest = sign.sendSignedRequest;
const uuidv4 = uuid.v4;

const DATABASE = 'activitypub';
const CREATE_COLLECTION = 'create';
const FOLLOWERS_COLLECTION = 'followers';

async function getOutbox(req, res) {
    try {
        const collection = client.db(DATABASE).collection(CREATE_COLLECTION);

        // Parse pagination parameters
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 50));
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
        const skip = (page - 1) * pageSize;

        const results = await Promise.all([
            collection
                .find({})
                .sort({ published: sortOrder })
                .skip(skip)
                .limit(pageSize)
                .toArray(),
            collection.countDocuments({})
        ]);
        
        const docs = results[0];
        const totalItems = results[1];

        const outboxCollection = {
            '@context': 'https://www.w3.org/ns/activitystreams',
            type: 'OrderedCollection',
            id: 'https://www.sneaas.no/u/trondss/outbox',
            totalItems: totalItems,
            first: 'https://www.sneaas.no/u/trondss/outbox?page=true',
            orderedItems: docs
        };

        // Add pagination if needed
        if (totalItems > pageSize) {
            outboxCollection.type = 'OrderedCollectionPage';
            outboxCollection.first = 'https://www.sneaas.no/u/trondss/outbox?page=1';
            
            if (page > 1) {
                outboxCollection.prev = 'https://www.sneaas.no/u/trondss/outbox?page=' + (page - 1);
            }
            
            if (skip + pageSize < totalItems) {
                outboxCollection.next = 'https://www.sneaas.no/u/trondss/outbox?page=' + (page + 1);
            }
        }

        log.info('Outbox fetched successfully', {
            totalItems: totalItems,
            pageSize: pageSize,
            page: page,
            userAgent: req.get('User-Agent')
        });

        res.json(outboxCollection);
    } catch (error) {
        log.error('Error fetching outbox', error, {
            page: req.query.page,
            pageSize: req.query.pageSize,
            userAgent: req.get('User-Agent')
        });
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to fetch outbox'
        });
    }
}

// Helper function to create different activity types
function createActivity(type, body, uuid) {
    const actorId = 'https://www.sneaas.no/u/trondss';
    const activityId = `https://www.sneaas.no/u/trondss/${type.toLowerCase()}/${uuid}`;
    const timestamp = new Date().toISOString();

    const baseActivity = {
        '@context': 'https://www.w3.org/ns/activitystreams',
        id: activityId,
        type,
        actor: actorId,
        published: timestamp
    };

    switch (type) {
        case 'Create':
            const noteId = `https://www.sneaas.no/u/trondss/note/${uuid}`;
            return {
                ...baseActivity,
                to: 'https://www.w3.org/ns/activitystreams#Public',
                object: {
                    '@context': 'https://www.w3.org/ns/activitystreams',
                    id: noteId,
                    type: 'Note',
                    content: `<p>${body.content || ''}</p>`,
                    attributedTo: actorId,
                    published: timestamp
                }
            };

        case 'Like':
            return {
                ...baseActivity,
                object: body.object
            };

        case 'Announce':
            return {
                ...baseActivity,
                object: body.object
            };

        case 'Follow':
            return {
                ...baseActivity,
                object: body.object
            };

        case 'Undo':
            return {
                ...baseActivity,
                object: body.object
            };

        default:
            throw new Error(`Unsupported activity type: ${type}`);
    }
}

// Helper function to deliver activity to followers
async function deliverToFollowers(activity) {
    try {
        const followersCollection = client.db(DATABASE).collection(FOLLOWERS_COLLECTION);
        const followers = await followersCollection.find().toArray();

        if (followers.length === 0) {
            log.info('No followers to deliver activity to');
            return;
        }

        log.info('Delivering activity to ' + followers.length + ' followers', {
            activityType: activity.type,
            activityId: activity.id,
            followerCount: followers.length
        });

        // Group followers by shared inbox for efficient delivery
        const followersBySharedInbox = followers.reduce((groups, follower) => {
            const inbox = follower.endpoints?.sharedInbox || follower.inbox;
            if (!groups[inbox]) {
                groups[inbox] = [];
            }
            groups[inbox].push(follower);
            return groups;
        }, {});

        const deliveryPromises = Object.entries(followersBySharedInbox).map(
            async ([inbox, groupedFollowers]) => {
                try {
                    const activityToSend = { ...activity };
                    
                    // Add CC for shared inboxes
                    if (groupedFollowers.length > 1) {
                        activityToSend.cc = groupedFollowers.map(f => f.id);
                    }

                    await sendSignedRequest(
                        inbox,
                        'https://www.sneaas.no/u/trondss#main-key',
                        activityToSend
                    );

                    log.info('Activity delivered successfully', {
                        inbox: inbox,
                        followerCount: groupedFollowers.length,
                        activityType: activity.type
                    });
                } catch (error) {
                    log.error('Failed to deliver activity to inbox', error, {
                        inbox: inbox,
                        followerCount: groupedFollowers.length,
                        activityType: activity.type
                    });
                }
            }
        );

        const results = await Promise.allSettled(deliveryPromises);
        
        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const errorCount = results.filter(r => r.status === 'rejected').length;
        
        log.info('Activity delivery completed', {
            totalInboxes: results.length,
            successCount: successCount,
            errorCount: errorCount,
            activityType: activity.type
        });
        
    } catch (error) {
        log.error('Error during activity delivery', error, {
            activityType: activity.type,
            activityId: activity.id
        });
        throw error;
    }
}

async function postOutbox(req, res) {
    try {
        const { type: activityType } = req.body;

        if (!activityType) {
            return res.status(400).json({
                error: 'Bad Request: Missing activity type'
            });
        }

        const uuid = uuidv4();
        const activity = createActivity(activityType, req.body, uuid);

        // Deliver to followers (don't await to avoid blocking response)
        deliverToFollowers(activity).catch(error => {
            log.error('Background delivery failed', error, {
                activityType: activity.type,
                activityId: activity.id
            });
        });

        // Save to database
        const collectionName = activity.type.toLowerCase();
        const collection = client.db(DATABASE).collection(collectionName);
        
        try {
            await collection.insertOne(activity);
            log.dbOperation('insert', collectionName, activity, null);
        } catch (dbError) {
            log.error('Database error saving activity', dbError, {
                activityType: activity.type,
                activityId: activity.id,
                collection: collectionName
            });
            throw dbError;
        }

        log.info('Activity created successfully', {
            activityType: activity.type,
            activityId: activity.id,
            collection: collectionName
        });

        const statusCode = activity.type === 'Create' ? 201 : 200;
        res.status(statusCode).json({
            message: 'Activity posted successfully',
            id: activity.id,
            type: activity.type
        });
    } catch (error) {
        log.error('Error posting to outbox', error, {
            activityType: req.body.type,
            url: req.url,
            userAgent: req.get('User-Agent')
        });
        
        if (error.message.includes('Unsupported activity type')) {
            return res.status(400).json({
                error: 'Bad Request: ' + error.message
            });
        }

        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to post activity'
        });
    }
}



exports.get = getOutbox;
exports.post = postOutbox;
