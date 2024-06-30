const client = require('./db');
const crypto = require('crypto');
const { getActorProfile } = require('./middleware');
const { v4: uuidv4 } = require('uuid');

const database = "activitypub";

const { sendSignedRequest } = require('./sign');

async function getInbox(req, res) {
    try {
        const collection = client.db(database).collection("inbox");
        const docs = await collection.find({ "to": "https://www.w3.org/ns/activitystreams#Public" }).toArray();
        res.json({
            "@context": "https://www.w3.org/ns/activitystreams", 
            "type": "OrderedCollection", 
            "totalItems": docs.length, 
            "first": "https://www.sneaas.no/u/trondss/inbox?page=true", 
            "orderedItems": docs
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal server error');
    }
}

async function postInbox(req, res) {
    try {
        const activity = req.body;

        const followersCollection = client.db(database).collection("followers");
        const followActivitiesCollection = client.db(database).collection("followActivities");
        const notesCollection = client.db(database).collection("notes");
        const likesCollection = client.db(database).collection("like");
        const followsCollection = client.db(database).collection("follow");
        const announcesCollection = client.db(database).collection("announce");
        const acceptCollection = client.db(database).collection("accept");
        const commentsCollection = client.db(database).collection("comment");
        const outboxCollection = client.db(database).collection("outbox");
        const createCollection = client.db(database).collection("create");
        
        switch (activity.type) {
            case 'Follow':
                const followerExists = await followersCollection.findOne({id: activity.actor});
            
                const acceptActivity = {
                    '@context': 'https://www.w3.org/ns/activitystreams',
                    type: 'Accept',
                    id: `https://www.sneaas.no/u/trondss/accept/${uuidv4()}`,
                    published: new Date().toISOString(),
                    actor: 'https://www.sneaas.no/u/trondss',
                    object: activity.id
                };

                const actorInbox = activity.actor + '/inbox';
                const response = await sendSignedRequest(actorInbox, 'https://www.sneaas.no/u/trondss#main-key', acceptActivity);

                acceptCollection.insertOne(acceptActivity);
                
                if (!followerExists) {
                    const response = await fetch(activity.actor, {
                        headers: {
                            'Accept': 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
                        }
                    });
                    const actorProfile = await response.json();

                    await followersCollection.insertOne(actorProfile);                
                    await followActivitiesCollection.insertOne(activity);
                }
                break;

            case 'Undo':
                const noteId = activity.object.object;
                const note = await createCollection.findOne({id: noteId});

                switch (activity.object.type) {
                    case 'Follow':            
                        await followersCollection.deleteOne({actor: activity.actor});
                        await followActivitiesCollection.deleteOne({id: activity.object.id});
                        break;
                    case 'Like':            
                        if (note) {
                            await createCollection.updateOne({id: noteId}, {$inc: {likes: -1}});  
                            await createCollection.updateOne({id: activity.object}, {$inc: {'object.likes': -1}});        
                            await likesCollection.deleteOne({id: activity.object.id});
                        } else {
                            console.log(`Note ${noteId} not found`);
                        }
                        break;
                    case 'Announce':            
                        if (note) {
                            await createCollection.updateOne({id: noteId}, {$inc: {shares: -1}});  
                            await createCollection.updateOne({id: activity.object}, {$inc: {'object.shares': -1}});        
                            await announcesCollection.deleteOne({id: activity.object.id});
                        } else {
                            console.log(`Note ${noteId} not found`);
                        }
                        break;             
                    default:
                        console.log(`Received unknown Undo object type: ${activity.object.type}`);
                }
                break;

            case 'Create':
                if (activity.object.type === 'Note') {
                    if (activity.object.inReplyTo) {
                        // The following logic is for handling replies/comments
                        const originalNoteId = activity.object.inReplyTo;
                        const originalNote = await createCollection.findOne({id: originalNoteId});
            
                        if (originalNote) {
                            await notesCollection.updateOne({id: originalNoteId}, {$inc: {replies: 1}});
                        } else {
                            console.log(`Original note ${originalNoteId} not found`);
                        }            
                        await commentsCollection.insertOne(activity.object);
                    } else {
                        // This is what will happen with followed users notes broadcasted to my inbox
                        await notesCollection.insertOne(activity.object);
                    }
                }
                break;
            case 'Delete':
                if (activity.object.type === 'Note') {
                    const note = await createCollection.findOne({id: activity.object.id});
    
                    if (note && note.attributedTo === activity.actor) {
                        await createCollection.deleteOne({id: activity.object.id});
                    } else {
                        console.log(`Actor ${activity.actor} tried to delete a note they didn't create`);
                    }
                }
                break;
            case 'Like':
                // Likes seems to be working as intended
                const like = await likesCollection.findOne({id: activity.id});

                if (!like) {
                    await likesCollection.insertOne({
                        id: activity.id,
                        actor: activity.actor,
                        object: activity.object
                    });                    
                    await createCollection.updateOne({id: activity.object}, {$inc: {likes: 1}});
                    await createCollection.updateOne({id: activity.object}, {$inc: {'object.likes': 1}});
    
                } else {
                    console.log(`Like ${activity.id} already exists`);
                }
                break;
            case 'Update':
                if (activity.object.type === 'Note') {
                    const note = await notesCollection.findOne({id: activity.object.id});
    
                    if (note && note.attributedTo === activity.actor) {
                        await notesCollection.updateOne({
                            id: activity.object.id
                        }, {
                            $set: {
                                content: activity.object.content
                            }
                        });
                    } else {
                        console.log(`Actor ${activity.actor} tried to update a note they didn't create or note not found`);
                    }
                }
                break;

            case 'Announce':
                // Announce seems to be working as intended
                const announce = await announcesCollection.findOne({id: activity.id});

                if (!announce) {
                    await announcesCollection.insertOne({
                        id: activity.id,
                        actor: activity.actor,
                        object: activity.object
                    });                    
                    await notesCollection.updateOne({id: activity.object}, {$inc: {shares: 1}});
                    await createCollection.updateOne({id: activity.object}, {$inc: {shares: 1}});
                    await createCollection.updateOne({"object.id": activity.object}, {$inc: {'object.shares': 1}});
                } else {
                    console.log(`Announce ${activity.id} already exists`);
                }
                break;

            case 'Block':
                if (follower) {
                    await followersCollection.updateOne({
                        id: activity.actor
                    }, {
                        $addToSet: {
                            blocked: activity.object.id
                        }
                    });
                } else if (following) {
                    await followsCollection.updateOne({
                        id: activity.actor
                    }, {
                        $addToSet: {
                            blocked: activity.object.id
                        }
                    });
                } else {
                    console.log(`User ${activity.actor} not found`);
                }
                break;
            case 'Accept':
                const follow = await followsCollection.findOne({id: activity.object.id});
    
                if (follow) {
                    const actorProfile = await getActorProfile(follow.object);
                    const followersCollection = client.db(database).collection("following");
                    const followActivitiesCollection = client.db(database).collection("followActivities");
    
                    await followersCollection.insertOne(actorProfile);
                    await followActivitiesCollection.insertOne(follow);
                } else {
                    console.log(`Follow ${activity.object} not found`);
                }
                break;
            default:
                console.log(`Received unknown activity type: ${activity.type}`);
        }
        
        res.status(200).send();
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal server error');
    }
}

exports.get = getInbox;
exports.post = postInbox;