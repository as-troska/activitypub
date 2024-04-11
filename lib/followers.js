const client = require('./db');
const database = "activitypub";

async function getFollowers(req, res) {
    try {
        const collection = client.db(database).collection("followers");
        const totalItems = await collection.countDocuments();
        res.json({
            "@context": "https://www.w3.org/ns/activitystreams", 
            "type": "OrderedCollection", 
            "totalItems": totalItems, 
            "first": "https://www.sneaas.no/u/trondss/followers?page=true"
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal server error');
    }
}

exports.get = getFollowers;