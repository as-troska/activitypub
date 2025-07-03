const client = require('./db');

const DATABASE = 'activitypub';
const FOLLOWERS_COLLECTION = 'followers';

async function getFollowers(req, res) {
    try {
        const collection = client.db(DATABASE).collection(FOLLOWERS_COLLECTION);
        
        const [totalItems, followers] = await Promise.all([
            collection.countDocuments(),
            collection.find().toArray()
        ]);

        const followersCollection = {
            '@context': 'https://www.w3.org/ns/activitystreams',
            summary: "trondss' followers",
            id: 'https://www.sneaas.no/u/trondss/followers',
            type: 'OrderedCollection',
            totalItems: totalItems,
            first: 'https://www.sneaas.no/u/trondss/followers?page=true',
            orderedItems: followers
        };

        res.json(followersCollection);
    } catch (error) {
        console.error('🚨 Error fetching followers:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to fetch followers'
        });
    }
}

async function refreshFollowers() {
    try {
        const collection = client.db(DATABASE).collection(FOLLOWERS_COLLECTION);
        const followers = await collection.find().toArray();

        console.log(`🔄 Refreshing ${followers.length} followers...`);

        const refreshPromises = followers.map(async (follower) => {
            try {
                const response = await fetch(follower.id, {
                    headers: {
                        'Accept': 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
                        'User-Agent': 'Sneaas.no ActivityPub Server'
                    },
                    timeout: 10000
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const actorProfile = await response.json();

                if (!actorProfile.id) {
                    throw new Error('Invalid actor profile: missing id');
                }

                await collection.updateOne(
                    { id: follower.id }, 
                    { $set: actorProfile }
                );

                console.log(`✅ Refreshed follower: ${follower.id}`);
            } catch (error) {
                console.error(`🚨 Error refreshing follower ${follower.id}:`, error.message);
            }
        });

        await Promise.allSettled(refreshPromises);
        console.log('🎉 Followers refresh completed');
    } catch (error) {
        console.error('🚨 Error during followers refresh:', error);
    }
}





exports.get = getFollowers;
exports.refresh = refreshFollowers;