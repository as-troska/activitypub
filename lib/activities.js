const client = require('./db');
const database = 'activitypub';


async function serveActivity (req, res) {
    
    try {
        let activityType = req.params.activityType;
        let collection = req.params.activityType;

        // Since notes are saved in create, and not notes, this needs updating.
        if (activityType === 'notes') {
            collection = 'create';
        }        

        const uuid = req.params.uuid;

        const id = `https://www.sneaas.no/u/trondss/${activityType}/${uuid}`;

        const activitiesCollection = client.db(database).collection(collection);
        
        const activity = await activitiesCollection.findOne({ 'id': `${id}` });

        if (!activity) {
            res.status(404).send('Activity not found');
            return;
        }

        // Find all replies, shares and likes for this activity
        const repliesCollection = client.db(database).collection('comment');
        const sharesCollection = client.db(database).collection('announce');
        const likesCollection = client.db(database).collection('like');

        const replies = await repliesCollection.find({ 'inReplyTo': `${id}` }).toArray();
        const shares = await sharesCollection.find({ 'object': `${id}` }).toArray();
        const likes = await likesCollection.find({ 'object': `${id}` }).toArray();

        const repliesOrderedCollection = {
            type: 'OrderedCollection',
            totalItems: replies.length,
            orderedItems: replies            
        }

        const sharesOrderedCollection = {
            type: 'OrderedCollection',
            totalItems: shares.length,
            orderedItems: shares
        }

        const likesOrderedCollection = {
            type: 'OrderedCollection',
            totalItems: likes.length,
            orderedItems: likes
        }

        activity.replies = repliesOrderedCollection;
        activity.shares = sharesOrderedCollection;
        activity.likes = likesOrderedCollection

        res.json(activity);
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};


exports.serve = serveActivity;