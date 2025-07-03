const client = require('./db');
const { sendSignedRequest } = require('./sign');
const { v4: uuidv4 } = require('uuid');

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

        const [docs, totalItems] = await Promise.all([
            collection
                .find({})
                .sort({ published: sortOrder })
                .skip(skip)
                .limit(pageSize)
                .toArray(),
            collection.countDocuments({})
        ]);

        const outboxCollection = {
            '@context': 'https://www.w3.org/ns/activitystreams',
            type: 'OrderedCollection',
            id: 'https://www.sneaas.no/u/trondss/outbox',
            totalItems,
            first: 'https://www.sneaas.no/u/trondss/outbox?page=true',
            orderedItems: docs
        };

        // Add pagination if needed
        if (totalItems > pageSize) {
            outboxCollection.type = 'OrderedCollectionPage';
            outboxCollection.first = 'https://www.sneaas.no/u/trondss/outbox?page=1';
            
            if (page > 1) {
                outboxCollection.prev = `https://www.sneaas.no/u/trondss/outbox?page=${page - 1}`;
            }
            
            if (skip + pageSize < totalItems) {
                outboxCollection.next = `https://www.sneaas.no/u/trondss/outbox?page=${page + 1}`;
            }
        }

        res.json(outboxCollection);
    } catch (error) {
        console.error('🚨 Error fetching outbox:', error);
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
            console.log('📭 No followers to deliver to');
            return;
        }

        console.log(`📤 Delivering to ${followers.length} followers`);

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

                    console.log(`✅ Delivered to ${inbox} (${groupedFollowers.length} followers)`);
                } catch (error) {
                    console.error(`🚨 Failed to deliver to ${inbox}:`, error.message);
                }
            }
        );

        await Promise.allSettled(deliveryPromises);
    } catch (error) {
        console.error('🚨 Error during delivery:', error);
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
            console.error('🚨 Background delivery failed:', error);
        });

        // Save to database
        const collectionName = activity.type.toLowerCase();
        const collection = client.db(DATABASE).collection(collectionName);
        await collection.insertOne(activity);

        console.log(`📝 ${activity.type} activity created:`, activity.id);

        const statusCode = activity.type === 'Create' ? 201 : 200;
        res.status(statusCode).json({
            message: 'Activity posted successfully',
            id: activity.id,
            type: activity.type
        });
    } catch (error) {
        console.error('🚨 Error posting to outbox:', error);
        
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
