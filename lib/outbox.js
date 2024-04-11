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

		res.json({
			"@context": "https://www.w3.org/ns/activitystreams",
			"type": "OrderedCollectionPage",
			"totalItems": docs.length,
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
        const activity = req.body;
        
        if (!activity.type || !activity.actor || !activity.object) {
            res.status(400).send('Invalid activity');
            return;
        }

        if (activity.type === 'Create' || activity.type === 'Update' || activity.type === 'Delete') {
            const followersCollection = client.db(database).collection("followers");
            const followers = await followersCollection.find({following: activity.actor}).toArray();

            for (const follower of followers) {
                const followerInbox = follower.actor + '/inbox';
                await sendSignedRequest(followerInbox, 'https://www.sneaas.no/u/trondss#main-key', activity);
            }
        }
        
        const outboxCollection = client.db(database).collection("outbox");
        await outboxCollection.insertOne(activity);        

        console.log(activity);
        res.status(200).send();
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal server error');
    }
}

exports.get = getOutbox;
exports.post = postOutbox;
