const client = require('./db');
const crypto = require('crypto');
const { getActorProfile } = require('./middleware');
const { v4: uuidv4 } = require('uuid');
const { sendSignedRequest } = require('./sign');
const log = require('./logger');

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
                log.info('New follower added successfully', {
                    actor: activity.actor,
                    activityId: activity.id
                });
            } else {
                throw new Error('Failed to fetch actor profile for ' + activity.actor);
            }
        } else {
            log.info('Follower already exists', {
                actor: activity.actor,
                activityId: activity.id
            });
        }
    } catch (error) {
        log.error('Error handling Follow activity', error, {
            actor: activity.actor,
            activityId: activity.id,
            activityType: activity.type
        });
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
                log.info('User unfollowed', {
                    actor: activity.actor,
                    objectId: object.id
                });
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
                    log.info('Like removed from note', {
                        noteId: noteId,
                        actor: activity.actor
                    });
                } else {
                    log.warn('Note not found for unlike', null, {
                        noteId: noteId,
                        actor: activity.actor
                    });
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
                    log.info('Announce removed from note', {
                        noteId: announceNoteId,
                        actor: activity.actor
                    });
                } else {
                    log.warn('Note not found for unannounce', null, {
                        noteId: announceNoteId,
                        actor: activity.actor
                    });
                }
                break;

            default:
                log.warn('Unknown Undo object type', null, {
                    objectType: object.type,
                    actor: activity.actor
                });
        }
    } catch (error) {
        log.error('Error handling Undo activity', error, {
            actor: activity.actor,
            objectType: activity.object ? activity.object.type : 'unknown'
        });
        throw error;
    }
}

async function handleCreateActivity(activity) {
    try {
        const { object } = activity;
        
        if (object.type !== 'Note') {
            log.debug('Ignoring Create activity for non-Note type', {
                objectType: object.type,
                actor: activity.actor
            });
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
                log.info('Comment added to note', {
                    originalNoteId: object.inReplyTo,
                    commentId: object.id,
                    actor: activity.actor
                });
            } else {
                log.warn('Original note not found for reply', null, {
                    originalNoteId: object.inReplyTo,
                    commentId: object.id,
                    actor: activity.actor
                });
                await commentsCollection.insertOne(object);
            }
        } else {
            // Handle regular note from followed user
            await notesCollection.insertOne(object);
            log.info('Note received from followed user', {
                noteId: object.id,
                actor: activity.actor
            });
        }
    } catch (error) {
        log.error('Error handling Create activity', error, {
            actor: activity.actor,
            objectType: activity.object ? activity.object.type : 'unknown',
            objectId: activity.object ? activity.object.id : 'unknown'
        });
        throw error;
    }
}

async function handleDeleteActivity(activity) {
    try {
        const { object } = activity;
        
        if (object.type !== 'Note') {
            log.debug('Ignoring Delete activity for non-Note type', {
                objectType: object.type,
                actor: activity.actor
            });
            return;
        }

        const createCollection = getCollection('CREATE');
        const note = await createCollection.findOne({ id: object.id });

        if (note && note.attributedTo === activity.actor) {
            await createCollection.deleteOne({ id: object.id });
            log.info('Note deleted successfully', {
                noteId: object.id,
                actor: activity.actor
            });
        } else if (!note) {
            log.warn('Note not found for deletion', null, {
                noteId: object.id,
                actor: activity.actor
            });
        } else {
            log.warn('Actor tried to delete note they did not create', null, {
                noteId: object.id,
                actor: activity.actor,
                noteOwner: note.attributedTo
            });
        }
    } catch (error) {
        log.error('Error handling Delete activity', error, {
            actor: activity.actor,
            objectType: activity.object ? activity.object.type : 'unknown',
            objectId: activity.object ? activity.object.id : 'unknown'
        });
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
            log.debug('Like already exists', {
                likeId: activity.id,
                actor: activity.actor,
                object: activity.object
            });
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

        log.info('Like added successfully', {
            likeId: activity.id,
            actor: activity.actor,
            object: activity.object
        });
    } catch (error) {
        log.error('Error handling Like activity', error, {
            actor: activity.actor,
            likeId: activity.id,
            object: activity.object
        });
        throw error;
    }
}

async function handleUpdateActivity(activity) {
    try {
        const { object } = activity;
        
        if (object.type !== 'Note') {
            log.debug('Ignoring Update activity for non-Note type', {
                objectType: object.type,
                actor: activity.actor
            });
            return;
        }

        const notesCollection = getCollection('NOTES');
        const note = await notesCollection.findOne({ id: object.id });

        if (note && note.attributedTo === activity.actor) {
            await notesCollection.updateOne(
                { id: object.id },
                { $set: { content: object.content } }
            );
            log.info('Note updated successfully', {
                noteId: object.id,
                actor: activity.actor
            });
        } else if (!note) {
            log.warn('Note not found for update', null, {
                noteId: object.id,
                actor: activity.actor
            });
        } else {
            log.warn('Actor tried to update note they did not create', null, {
                noteId: object.id,
                actor: activity.actor,
                noteOwner: note.attributedTo
            });
        }
    } catch (error) {
        log.error('Error handling Update activity', error, {
            actor: activity.actor,
            objectType: activity.object ? activity.object.type : 'unknown',
            objectId: activity.object ? activity.object.id : 'unknown'
        });
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
            log.debug('Announce already exists', {
                announceId: activity.id,
                actor: activity.actor,
                object: activity.object
            });
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

        log.info('Announce added successfully', {
            announceId: activity.id,
            actor: activity.actor,
            object: activity.object
        });
    } catch (error) {
        log.error('Error handling Announce activity', error, {
            actor: activity.actor,
            announceId: activity.id,
            object: activity.object
        });
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
                log.info('Follow accepted successfully', {
                    actor: follow.object,
                    followId: follow.id
                });
            } else {
                throw new Error('Failed to fetch actor profile for ' + follow.object);
            }
        } else {
            log.warn('Follow activity not found for Accept', null, {
                objectId: activity.object.id,
                actor: activity.actor
            });
        }
    } catch (error) {
        log.error('Error handling Accept activity', error, {
            actor: activity.actor,
            objectId: activity.object ? activity.object.id : 'unknown'
        });
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
            log.info('User blocked in followers collection', {
                blockedUser: activity.object.id,
                actor: activity.actor
            });
        } else if (following) {
            await followsCollection.updateOne(
                { id: activity.actor },
                { $addToSet: { blocked: activity.object.id } }
            );
            log.info('User blocked in following collection', {
                blockedUser: activity.object.id,
                actor: activity.actor
            });
        } else {
            log.warn('User not found for block activity', null, {
                actor: activity.actor,
                blockedUser: activity.object.id
            });
        }
    } catch (error) {
        log.error('Error handling Block activity', error, {
            actor: activity.actor,
            blockedUser: activity.object ? activity.object.id : 'unknown'
        });
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

        log.activity(activity.type, activity.actor, activity, 'INCOMING');

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
                log.warn('Unknown activity type received', null, {
                    activityType: activity.type,
                    actor: activity.actor
                });
        }

        log.info('Activity processed successfully', {
            activityType: activity.type,
            actor: activity.actor,
            activityId: activity.id
        });

        res.status(200).json({ message: 'Activity processed successfully' });
    } catch (error) {
        log.error('Error processing inbox activity', error, {
            activityType: activity ? activity.type : 'unknown',
            actor: activity ? activity.actor : 'unknown',
            url: req.url
        });
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