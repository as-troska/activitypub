const client = require('./db');
const sign = require('./sign');
const { v4: uuidv4 } = require('uuid');
const database = "activitypub";

const sendSignedRequest = sign.sendSignedRequest;

async function getOutbox(req, res) {
	try {
		const collection = client.db(database).collection("outbox");

		const page = parseInt(req.query.page) || 1;
		const pageSize = parseInt(req.query.pageSize) || 50;
		const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

		const skip = (page - 1) * pageSize;

		const docs = await collection.find({}).sort({ published: sortOrder }).skip(skip).limit(pageSize).toArray();
        const totalItems = await collection.countDocuments({});


		res.json({
			"@context": "https://www.w3.org/ns/activitystreams",
			"type": "OrderedCollectionPage",
			"totalItems": totalItems,
			"first": "https://www.sneaas.no/u/trondss/outbox?page=1",
			"next": `https://www.sneaas.no/u/trondss/outbox?page=${page + 1}`,
			"orderedItems": docs
		});

	} catch (err) {
		console.error(err);
		res.status(500).send('Internal server error');
	}
}

async function postOutbox(req, res) {
    try {
        const activityType = req.body.type;
        const uuid = uuidv4();

        let activity;

        const activityId = `https://www.sneaas.no/u/trondss/${activityType.toLowerCase()}/${uuid}`;

        switch (activityType) {
            case 'Create':
                const noteContent = req.body.content;
                activity = {
                    "@context": "https://www.w3.org/ns/activitystreams",
                    "id": activityId,
                    "type": "Create",
                    "actor": "https://www.sneaas.no/u/trondss",
                    "to": "https://www.w3.org/ns/activitystreams#Public",
                    "object": {
                        "@context": "https://www.w3.org/ns/activitystreams",
                        "id": activityId,
                        "published:": new Date().toISOString(),
                        "type": "Note",
                        "content": `<p>${noteContent}</p>`
                    }
                };
                break;
            case 'Like':
                const likedObjectId = req.body.object;
                activity = {
                    "@context": "https://www.w3.org/ns/activitystreams",
                    "id": activityId,
                    "type": "Like",
                    "actor": "https://www.sneaas.no/u/trondss",
                    "published": new Date().toISOString(),
                    "object": likedObjectId
                };
                break;
            case 'Announce':
                const announcedObjectId = req.body.object;
                activity = {
                    "@context": "https://www.w3.org/ns/activitystreams",
                    "id": activityId,
                    "type": "Announce",
                    "actor": "https://www.sneaas.no/u/trondss",
                    "published": new Date().toISOString(),
                    "object": announcedObjectId
                };
                break;
            default:
                throw new Error('Invalid activity type');
        }

        const followersCollection = client.db(database).collection("followers");
        const followers = await followersCollection.find().toArray();

        const followersBySharedInbox = followers.reduce((groups, follower) => {
            const sharedInbox = follower.endpoints.sharedInbox;
            if (!groups[sharedInbox]) {
                groups[sharedInbox] = [];
            }
            groups[sharedInbox].push(follower);
            return groups;
        }, {});
        
        for (const sharedInbox in followersBySharedInbox) {
            const followers = followersBySharedInbox[sharedInbox];
        
            let inbox;
            if (followers.length === 1) {
                inbox = followers[0].inbox;
            } else {
                inbox = sharedInbox;
                activity.cc = followers.map(follower => follower.inbox);
            }
        
            await sendSignedRequest(inbox, 'https://www.sneaas.no/u/trondss#main-key', activity);
        }

        const collectionName = activity.type.toLowerCase();
        const collection = client.db(database).collection(collectionName);
        await collection.insertOne(activity);

        if (activity.type === 'Create') {
            res.status(201).send('Activity posted successfully');
        } else {
            res.status(200).send('Activity posted successfully');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal server error');
    }
}



exports.get = getOutbox;
exports.post = postOutbox;
