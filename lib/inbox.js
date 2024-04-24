const client = require('./db');
const crypto = require('crypto');

const database = "activitypub";

const { sendSignedRequest } = require('./sign');

async function getInbox(req, res) {
    try {
        const collection = client.db(database).collection("inbox");
        const docs = await collection.find({}).toArray();
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

        if (activity.type === 'Follow') {
            const followersCollection = client.db(database).collection("followers");
            const followActivitiesCollection = client.db(database).collection("followActivities");

            const followerExists = await followersCollection.findOne({id: activity.actor});
            
            const acceptActivity = {
                '@context': 'https://www.w3.org/ns/activitystreams',
                type: 'Accept',
                actor: 'https://www.sneaas.no/u/trondss',
                object: activity.id
            };

            const actorInbox = activity.actor + '/inbox';
            const response = await sendSignedRequest(actorInbox, 'https://www.sneaas.no/u/trondss#main-key', acceptActivity);

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
        } else if (activity.type === 'Undo') {
            if (activity.object.type === 'Follow') {
                const followersCollection = client.db(database).collection("followers");
                const followActivitiesCollection = client.db(database).collection("followActivities");

                await followersCollection.deleteOne({actor: activity.actor});
                await followActivitiesCollection.deleteOne({id: activity.object.id}); // Delete the Follow activity
            }
        } else if (activity.type === 'Create') {
            if (activity.object.type === 'Note') {
                const collection = client.db(database).collection("notes");
                await collection.insertOne(activity.object);
            }
        } else if (activity.type === 'Delete') {
            if (activity.object.type === 'Note') {
                const collection = client.db(database).collection("notes");
                const note = await collection.findOne({id: activity.object.id});

                if (note && note.attributedTo === activity.actor) {
                    await collection.deleteOne({id: activity.object.id});
                } else {
                    console.log(`Actor ${activity.actor} tried to delete a note they didn't create`);
                }
            }
        } else if (activity.type === 'Like') {
            const collection = client.db(database).collection("notes");
            const note = await collection.findOne({id: activity.object.id});

            if (note) {
                await collection.updateOne({
                    id: activity.object.id
                }, {
                    $inc: {
                        likes: 1
                    }
                });
            } else {
                console.log(`Note ${activity.object.id} not found`);
            }
        } else if (activity.type === 'Update') {
            if (activity.object.type === 'Note') {
                const collection = client.db(database).collection("notes");
                const note = await collection.findOne({id: activity.object.id});

                if (note && note.attributedTo === activity.actor) {
                    await collection.updateOne({
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
        } else if (activity.type === 'Announce') {
            const collection = client.db(database).collection("notes");
            const note = await collection.findOne({id: activity.object.id});

            if (note) {
                await collection.updateOne({
                    id: activity.object.id
                }, {
                    $inc: {
                        shares: 1
                    }
                });
            } else {
                console.log(`Note ${activity.object.id} not found`);
            }
        } else if (activity.type === 'Block') {
            const collection = client.db(database).collection("users");
            const user = await collection.findOne({id: activity.actor});

            if (user) {
                await collection.updateOne({
                    id: activity.actor
                }, {
                    $addToSet: {
                        blocked: activity.object.id
                    }
                });
            } else {
                console.log(`User ${activity.actor} not found`);
            }
        } else {
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