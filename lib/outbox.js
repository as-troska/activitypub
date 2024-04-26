const client = require('./db');
const sign = require('./sign');
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
        const noteContent = req.body.content;

        // Build the activity object
        const activity = {
            "@context": "https://www.w3.org/ns/activitystreams",
            "type": "Create",
            "actor": "https://www.sneaas.no/u/trondss",
            "to": "https://www.w3.org/ns/activitystreams#Public",
            "object": {
                "type": "Note",
                "content": `<p>${noteContent}</p>`
            }
        };

        // Send the activity to your followers
        const followersCollection = client.db(database).collection("followers");
        const followers = await followersCollection.find().toArray();

        for (const follower of followers) {
            console.log(follower)
        //     const followerInbox = follower.actor + '/inbox';
        //     await sendSignedRequest(followerInbox, 'https://www.sneaas.no/u/trondss#main-key', activity);
        }

        // Add the activity to your outbox
        const outboxCollection = client.db(database).collection("outbox");
        await outboxCollection.insertOne(activity);

        res.status(201).send('Activity posted successfully');
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal server error');
    }
}

exports.get = getOutbox;
exports.post = postOutbox;
