const client = require('./db');
const database = 'activitypub';


async function serveActivity (req, res) {
    try {
        const activityType = req.params.activityType;
        const uuid = req.params.uuid;

        const activitiesCollection = client.db(database).collection(activityType);
        const activity = await activitiesCollection.findOne({ 'id': `https://www.sneaas.no/u/trondss/${activityType}/${uuid}` });

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