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

async function refreshFollowers() {
    try {
        const collection = client.db(database).collection("followers");
        const followers = await collection.find().toArray();

        for (const follower of followers) {
            try {
                const response = await fetch(follower.id, {
                    headers: {
                        'Accept': 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
                    }
                });
                const actorProfile = await response.json();
               

                collection.updateOne({id: follower.id}, { $set: actorProfile });
            } catch (err) {
                console.error("Error refreshing follower", follower, err);
            }
        }
        console.log("Followers refreshed")
    } catch (err) {
        console.error(err);
    }
}





exports.get = getFollowers;
exports.refresh = refreshFollowers;