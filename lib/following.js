const client = require('./db');
const database = "activitypub";

async function getFollowing(req, res) {
    try {
        const collection = client.db(database).collection("following");
        const totalItems = await collection.countDocuments();
        res.json({
            "@context": "https://www.w3.org/ns/activitystreams", 
            "type": "OrderedCollection", 
            "totalItems": totalItems, 
            "first": "https://www.sneaas.no/u/trondss/following?page=true"
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal server error');
    }
};


exports.get = getFollowing;

