const client = require('./db');
const database = 'activitypub';


async function serveActivity (req, res) {
    console.log("Hit")
    console.log("req.params.activityType", req.params.activityType)
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

        res.json(activity);
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};


exports.serve = serveActivity;