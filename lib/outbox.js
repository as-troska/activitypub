const client = require('./db');
const sign = require('./sign');
const uuid = require('uuid');
const log = require('./logger');
const activityTypes = require('./activityTypes');

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
    const activityId = 'https://www.sneaas.no/u/trondss/' + type.toLowerCase() + '/' + uuid;
    const timestamp = new Date().toISOString();

    const baseActivity = {
        '@context': 'https://www.w3.org/ns/activitystreams',
        id: activityId,
        type: type,
        actor: actorId,
        published: timestamp
    };

    switch (type) {
        case 'Create':
            return createCreateActivity(baseActivity, body, uuid, actorId, timestamp);

        case 'Like':
            return Object.assign({}, baseActivity, {
                object: body.object
            });

        case 'Announce':
            return Object.assign({}, baseActivity, {
                object: body.object
            });

        case 'Follow':
            return Object.assign({}, baseActivity, {
                object: body.object
            });

        case 'Undo':
            return Object.assign({}, baseActivity, {
                object: body.object
            });

        case 'Read':
            return Object.assign({}, baseActivity, {
                object: body.book || body.object,
                startTime: timestamp,
                endTime: body.endTime || null
            });

        case 'Want':
            return Object.assign({}, baseActivity, {
                object: body.book || body.object
            });

        case 'Rate':
            return Object.assign({}, baseActivity, {
                object: body.book || body.object,
                rating: body.rating || 0
            });

        case 'Shelve':
            return Object.assign({}, baseActivity, {
                object: body.book || body.object,
                target: body.shelf || body.target
            });

        default:
            throw new Error('Unsupported activity type: ' + type);
    }
}

// Helper function to create Create activities with different object types
function createCreateActivity(baseActivity, body, uuid, actorId, timestamp) {
    const objectType = body.objectType || 'Note';
    
    // Validate that we support this object type
    if (!activityTypes.isValidObjectType(objectType)) {
        throw new Error('Unsupported object type: ' + objectType);
    }
    
    const objectId = 'https://www.sneaas.no/u/trondss/' + objectType.toLowerCase() + '/' + uuid;
    
    const baseObject = {
        '@context': 'https://www.w3.org/ns/activitystreams',
        id: objectId,
        type: objectType,
        attributedTo: actorId,
        published: timestamp
    };
    
    let objectData;
    
    switch (objectType) {
        case 'Note':
            objectData = Object.assign({}, baseObject, {
                content: '<p>' + (body.content || '') + '</p>',
                inReplyTo: body.inReplyTo || null
            });
            break;
            
        case 'Image':
            objectData = Object.assign({}, baseObject, {
                name: body.name || body.altText || '',
                summary: body.summary || body.caption || '',
                url: body.url || body.image,
                mediaType: body.mediaType || 'image/jpeg',
                content: body.content ? '<p>' + body.content + '</p>' : null
            });
            break;
            
        case 'Video':
            objectData = Object.assign({}, baseObject, {
                name: body.name || body.title || '',
                summary: body.summary || body.description || '',
                url: body.url || body.video,
                mediaType: body.mediaType || 'video/mp4',
                duration: body.duration || null,
                content: body.content ? '<p>' + body.content + '</p>' : null
            });
            break;
            
        case 'Article':
            objectData = Object.assign({}, baseObject, {
                name: body.title || body.name || '',
                content: body.content || '',
                summary: body.summary || body.excerpt || ''
            });
            break;
            
        case 'Book':
            objectData = Object.assign({}, baseObject, {
                name: body.title || body.name || '',
                summary: body.summary || body.description || '',
                isbn: body.isbn || null,
                author: body.author || body.authors || [],
                published: body.publicationDate || null
            });
            break;
            
        case 'Review':
            objectData = Object.assign({}, baseObject, {
                content: body.content || '',
                inReplyTo: body.book || body.inReplyTo,
                rating: body.rating || null,
                summary: body.summary || ''
            });
            break;
            
        case 'Audio':
            objectData = Object.assign({}, baseObject, {
                name: body.name || body.title || '',
                summary: body.summary || body.description || '',
                url: body.url || body.audio,
                mediaType: body.mediaType || 'audio/mpeg',
                duration: body.duration || null
            });
            break;
            
        default:
            // Generic object creation
            objectData = Object.assign({}, baseObject, {
                name: body.name || body.title || '',
                content: body.content || '',
                summary: body.summary || ''
            });
            break;
    }
    
    return Object.assign({}, baseActivity, {
        to: body.to || 'https://www.w3.org/ns/activitystreams#Public',
        cc: body.cc || null,
        object: objectData
    });
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
        const followersBySharedInbox = followers.reduce(function(groups, follower) {
            const endpoints = follower.endpoints || {};
            const inbox = endpoints.sharedInbox || follower.inbox;
            if (!groups[inbox]) {
                groups[inbox] = [];
            }
            groups[inbox].push(follower);
            return groups;
        }, {});

        const deliveryPromises = Object.entries(followersBySharedInbox).map(
            async function(entry) {
                const inbox = entry[0];
                const groupedFollowers = entry[1];
                try {
                    const activityToSend = Object.assign({}, activity);
                    
                    // Add CC for shared inboxes
                    if (groupedFollowers.length > 1) {
                        activityToSend.cc = groupedFollowers.map(function(f) { return f.id; });
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
        
        const successCount = results.filter(function(r) { return r.status === 'fulfilled'; }).length;
        const errorCount = results.filter(function(r) { return r.status === 'rejected'; }).length;
        
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
        const activityType = req.body.type;

        if (!activityType) {
            return res.status(400).json({
                error: 'Bad Request: Missing activity type'
            });
        }

        const uuid = uuidv4();
        const activity = createActivity(activityType, req.body, uuid);

        // Deliver to followers (don't await to avoid blocking response)
        deliverToFollowers(activity).catch(function(error) {
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
