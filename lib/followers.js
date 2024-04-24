const client = require('./db');
const database = "activitypub";

async function getFollowers(req, res) {
    try {
        const collection = client.db(database).collection("followers");
        const totalItems = await collection.countDocuments();
        const followers = await collection.find().toArray();
        res.json({
            "@context": "https://www.w3.org/ns/activitystreams",
            "summary": "trondss' followers", 
            "id": "https://www.sneaas.no/u/trondss/followers",
            "type": "OrderedCollection", 
            "totalItems": totalItems,             
            "orderedItems": followers
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal server error');
    }
}

exports.get = getFollowers;