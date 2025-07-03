const client = require('./db');
const crypto = require('crypto');
const { getActorProfile } = require('./middleware');
const { v4: uuidv4 } = require('uuid');
const { sendSignedRequest } = require('./sign');

const DATABASE = 'activitypub';

// Collection constants
const COLLECTIONS = {
    INBOX: 'inbox',
    FOLLOWERS: 'followers',
    FOLLOW_ACTIVITIES: 'followActivities',
    NOTES: 'notes',
    LIKES: 'like',
    FOLLOWS: 'follow',
    ANNOUNCES: 'announce',
    ACCEPT: 'accept',
    COMMENTS: 'comment',
    OUTBOX: 'outbox',
    CREATE: 'create'
};

// Helper function to get collection
function getCollection(name) {
    return client.db(DATABASE).collection(COLLECTIONS[name]);
}

async function getInbox(req, res) {
    try {
        const collection = getCollection('INBOX');
        const docs = await collection
            .find({ to: 'https://www.w3.org/ns/activitystreams#Public' })
            .toArray();

        const inboxCollection = {
            '@context': 'https://www.w3.org/ns/activitystreams',
            type: 'OrderedCollection',
            totalItems: docs.length,
            first: 'https://www.sneaas.no/u/trondss/inbox?page=true',
            orderedItems: docs
        };

        res.json(inboxCollection);
    } catch (error) {
        console.error('🚨 Error fetching inbox:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to fetch inbox'
        });
    }
}

// Activity handlers
async function handleFollowActivity(activity) {
    try {
        const followersCollection = getCollection('FOLLOWERS');
        const followActivitiesCollection = getCollection('FOLLOW_ACTIVITIES');
        const acceptCollection = getCollection('ACCEPT');

        // Check if follower already exists
        const followerExists = await followersCollection.findOne({ id: activity.actor });

        // Create accept activity
        const acceptActivity = {
            '@context': 'https://www.w3.org/ns/activitystreams',
            type: 'Accept',
            id: `https://www.sneaas.no/u/trondss/accept/${uuidv4()}`,
            published: new Date().toISOString(),
            actor: 'https://www.sneaas.no/u/trondss',
            object: activity.id
        };

        // Send accept response
        const actorInbox = `${activity.actor}/inbox`;
        await sendSignedRequest(
            actorInbox,
            'https://www.sneaas.no/u/trondss#main-key',
            acceptActivity
        );

        // Save accept activity
        await acceptCollection.insertOne(acceptActivity);

        // Add new follower if they don't exist
        if (!followerExists) {
            const actorProfile = await getActorProfile(activity.actor);
            if (actorProfile) {
                await Promise.all([
                    followersCollection.insertOne(actorProfile),
                    followActivitiesCollection.insertOne(activity)
                ]);
                console.log(`✅ New follower added: ${activity.actor}`);
            } else {
                throw new Error(`Failed to fetch actor profile for ${activity.actor}`);
            }
        } else {
            console.log(`👥 Follower already exists: ${activity.actor}`);
        }
    } catch (error) {
        console.error('🚨 Error handling Follow activity:', error);
        throw error;
    }
}

async function handleUndoActivity(activity) {
    try {
        const { object } = activity;
        const followersCollection = getCollection('FOLLOWERS');
        const followActivitiesCollection = getCollection('FOLLOW_ACTIVITIES');
        const likesCollection = getCollection('LIKES');
        const announcesCollection = getCollection('ANNOUNCES');
        const createCollection = getCollection('CREATE');

        switch (object.type) {
            case 'Follow':
                await Promise.all([
                    followersCollection.deleteOne({ actor: activity.actor }),
                    followActivitiesCollection.deleteOne({ id: object.id })
                ]);
                console.log(`💔 Unfollowed by: ${activity.actor}`);
                break;

            case 'Like':
                const noteId = object.object;
                const note = await createCollection.findOne({ id: noteId });
                
                if (note) {
                    await Promise.all([
                        createCollection.updateOne({ id: noteId }, { $inc: { likes: -1 } }),
                        createCollection.updateOne({ id: object.id }, { $inc: { 'object.likes': -1 } }),
                        likesCollection.deleteOne({ id: object.id })
                    ]);
                    console.log(`👎 Like removed from note: ${noteId}`);
                } else {
                    console.warn(`⚠️ Note not found for unlike: ${noteId}`);
                }
                break;

            case 'Announce':
                const announceNoteId = object.object;
                const announceNote = await createCollection.findOne({ id: announceNoteId });
                
                if (announceNote) {
                    await Promise.all([
                        createCollection.updateOne({ id: announceNoteId }, { $inc: { shares: -1 } }),
                        createCollection.updateOne({ id: object.id }, { $inc: { 'object.shares': -1 } }),
                        announcesCollection.deleteOne({ id: object.id })
                    ]);
                    console.log(`🔄 Announce removed from note: ${announceNoteId}`);
                } else {
                    console.warn(`⚠️ Note not found for unannounce: ${announceNoteId}`);
                }
                break;

            default:
                console.warn(`⚠️ Unknown Undo object type: ${object.type}`);
        }
    } catch (error) {
        console.error('🚨 Error handling Undo activity:', error);
        throw error;
    }
}

async function handleCreateActivity(activity) {
    try {
        const { object } = activity;
        
        if (object.type !== 'Note') {
            console.log(`📝 Ignoring Create activity for type: ${object.type}`);
            return;
        }

        const notesCollection = getCollection('NOTES');
        const commentsCollection = getCollection('COMMENTS');
        const createCollection = getCollection('CREATE');

        if (object.inReplyTo) {
            // Handle reply/comment
            const originalNote = await createCollection.findOne({ id: object.inReplyTo });
            
            if (originalNote) {
                await Promise.all([
                    createCollection.updateOne(
                        { id: object.inReplyTo },
                        { 
                            $inc: { 
                                replies: 1,
                                'object.replies': 1 
                            } 
                        }
                    ),
                    commentsCollection.insertOne(object)
                ]);
                console.log(`💬 Comment added to note: ${object.inReplyTo}`);
            } else {
                console.warn(`⚠️ Original note not found: ${object.inReplyTo}`);
                await commentsCollection.insertOne(object);
            }
        } else {
            // Handle regular note from followed user
            await notesCollection.insertOne(object);
            console.log(`📄 Note received from followed user: ${object.id}`);
        }
    } catch (error) {
        console.error('🚨 Error handling Create activity:', error);
        throw error;
    }
}

async function handleDeleteActivity(activity) {
    try {
        const { object } = activity;
        
        if (object.type !== 'Note') {
            console.log(`🗑️ Ignoring Delete activity for type: ${object.type}`);
            return;
        }

        const createCollection = getCollection('CREATE');
        const note = await createCollection.findOne({ id: object.id });

        if (note && note.attributedTo === activity.actor) {
            await createCollection.deleteOne({ id: object.id });
            console.log(`🗑️ Note deleted: ${object.id}`);
        } else if (!note) {
            console.warn(`⚠️ Note not found for deletion: ${object.id}`);
        } else {
            console.warn(`⚠️ Actor ${activity.actor} tried to delete note they didn't create`);
        }
    } catch (error) {
        console.error('🚨 Error handling Delete activity:', error);
        throw error;
    }
}

async function handleLikeActivity(activity) {
    try {
        const likesCollection = getCollection('LIKES');
        const createCollection = getCollection('CREATE');

        // Check if like already exists
        const existingLike = await likesCollection.findOne({ id: activity.id });
        
        if (existingLike) {
            console.log(`👍 Like already exists: ${activity.id}`);
            return;
        }

        // Add like and update counters
        await Promise.all([
            likesCollection.insertOne({
                id: activity.id,
                actor: activity.actor,
                object: activity.object
            }),
            createCollection.updateOne(
                { id: activity.object },
                { 
                    $inc: { 
                        likes: 1,
                        'object.likes': 1 
                    } 
                }
            )
        ]);

        console.log(`👍 Like added to: ${activity.object}`);
    } catch (error) {
        console.error('🚨 Error handling Like activity:', error);
        throw error;
    }
}

async function handleUpdateActivity(activity) {
    try {
        const { object } = activity;
        
        if (object.type !== 'Note') {
            console.log(`📝 Ignoring Update activity for type: ${object.type}`);
            return;
        }

        const notesCollection = getCollection('NOTES');
        const note = await notesCollection.findOne({ id: object.id });

        if (note && note.attributedTo === activity.actor) {
            await notesCollection.updateOne(
                { id: object.id },
                { $set: { content: object.content } }
            );
            console.log(`📝 Note updated: ${object.id}`);
        } else if (!note) {
            console.warn(`⚠️ Note not found for update: ${object.id}`);
        } else {
            console.warn(`⚠️ Actor ${activity.actor} tried to update note they didn't create`);
        }
    } catch (error) {
        console.error('🚨 Error handling Update activity:', error);
        throw error;
    }
}

async function handleAnnounceActivity(activity) {
    try {
        const announcesCollection = getCollection('ANNOUNCES');
        const notesCollection = getCollection('NOTES');
        const createCollection = getCollection('CREATE');

        // Check if announce already exists
        const existingAnnounce = await announcesCollection.findOne({ id: activity.id });
        
        if (existingAnnounce) {
            console.log(`🔄 Announce already exists: ${activity.id}`);
            return;
        }

        // Add announce and update counters
        await Promise.all([
            announcesCollection.insertOne({
                id: activity.id,
                actor: activity.actor,
                object: activity.object
            }),
            notesCollection.updateOne(
                { id: activity.object },
                { $inc: { shares: 1 } }
            ),
            createCollection.updateOne(
                { id: activity.object },
                { $inc: { shares: 1 } }
            ),
            createCollection.updateOne(
                { 'object.id': activity.object },
                { $inc: { 'object.shares': 1 } }
            )
        ]);

        console.log(`🔄 Announce added to: ${activity.object}`);
    } catch (error) {
        console.error('🚨 Error handling Announce activity:', error);
        throw error;
    }
}

async function handleAcceptActivity(activity) {
    try {
        const followsCollection = getCollection('FOLLOWS');
        const followingCollection = getCollection('FOLLOWERS'); // Note: this should be "following"
        const followActivitiesCollection = getCollection('FOLLOW_ACTIVITIES');

        const follow = await followsCollection.findOne({ id: activity.object.id });

        if (follow) {
            const actorProfile = await getActorProfile(follow.object);
            
            if (actorProfile) {
                await Promise.all([
                    followingCollection.insertOne(actorProfile),
                    followActivitiesCollection.insertOne(follow)
                ]);
                console.log(`✅ Follow accepted: ${follow.object}`);
            } else {
                throw new Error(`Failed to fetch actor profile for ${follow.object}`);
            }
        } else {
            console.warn(`⚠️ Follow activity not found: ${activity.object.id}`);
        }
    } catch (error) {
        console.error('🚨 Error handling Accept activity:', error);
        throw error;
    }
}

async function handleBlockActivity(activity) {
    try {
        const followersCollection = getCollection('FOLLOWERS');
        const followsCollection = getCollection('FOLLOWS');

        // This logic seems incomplete in the original - the variables follower and following are not defined
        // For now, I'll implement a basic version
        const [follower, following] = await Promise.all([
            followersCollection.findOne({ id: activity.actor }),
            followsCollection.findOne({ id: activity.actor })
        ]);

        if (follower) {
            await followersCollection.updateOne(
                { id: activity.actor },
                { $addToSet: { blocked: activity.object.id } }
            );
            console.log(`🚫 User blocked in followers: ${activity.object.id}`);
        } else if (following) {
            await followsCollection.updateOne(
                { id: activity.actor },
                { $addToSet: { blocked: activity.object.id } }
            );
            console.log(`🚫 User blocked in following: ${activity.object.id}`);
        } else {
            console.warn(`⚠️ User not found for block: ${activity.actor}`);
        }
    } catch (error) {
        console.error('🚨 Error handling Block activity:', error);
        throw error;
    }
}

async function postInbox(req, res) {
    try {
        const activity = req.body;

        if (!activity || !activity.type) {
            return res.status(400).json({
                error: 'Bad Request: Invalid activity'
            });
        }

        console.log(`📨 Received ${activity.type} activity from: ${activity.actor}`);

        // Route to appropriate handler
        switch (activity.type) {
            case 'Follow':
                await handleFollowActivity(activity);
                break;
            case 'Undo':
                await handleUndoActivity(activity);
                break;
            case 'Create':
                await handleCreateActivity(activity);
                break;
            case 'Delete':
                await handleDeleteActivity(activity);
                break;
            case 'Like':
                await handleLikeActivity(activity);
                break;
            case 'Update':
                await handleUpdateActivity(activity);
                break;
            case 'Announce':
                await handleAnnounceActivity(activity);
                break;
            case 'Block':
                await handleBlockActivity(activity);
                break;
            case 'Accept':
                await handleAcceptActivity(activity);
                break;
            default:
                console.warn(`⚠️ Unknown activity type: ${activity.type}`);
        }

        res.status(200).json({ message: 'Activity processed successfully' });
    } catch (error) {
        console.error('🚨 Error processing inbox activity:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to process activity'
        });
    }
}

module.exports = {
    get: getInbox,
    post: postInbox
};