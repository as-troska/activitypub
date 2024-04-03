async function checkContentType(req, res, next) {
    if (req.method === 'POST') {
        let contentType = req.get('Content-Type');

        if (!contentType) {
            contentType = rec.get('content-type')
        }
        console.log(contentType)

        if (!contentType || (contentType !== 'application/ld+json' && contentType !== "application/activity+json")) {
            res.status(415).send('Unsupported Media Type');
            console.log("Failed first middleware: Unsupported content type")
            console.log(req.headers)
            console.log(req.body)
            return;
        }
    }
    //console.log("Passed first middleware")

    next();
};

async function checkActivityType(req, res, next) {
    if (req.method === 'POST') {
        const activity = req.body;

        if (!activity || !activity.type) {
            res.status(400).send('Bad Request: Missing activity type');
            console.log("Failed second middleware: Bad Request: Missing activity type")
            return;
        }

        const validTypes = ['Create','Update','Delete','Follow','Accept','Reject','Add','Remove','Like','Announce','Undo','Block','Flag'];
        if (!validTypes.includes(activity.type)) {
            res.status(400).send('Bad Request: Invalid activity type');
            console.log("Failed second middleware: Bad Request: Invalid activity type")
            return;
        }
    }
    //console.log("Passed second middleware")
    next();
};

async function checkActor(req, res, next) {
	if (req.method === 'POST') {
		const activity = req.body;

		if (!activity || !activity.actor) {
			res.status(400).send('Bad Request: Missing actor');
			console.log("Failed third middleware: Bad Request: Missing actor")
			return;
		}

		const actorProfile = await getActorProfile(activity.actor);
		if (!actorProfile) {
			if (activity.type === 'Delete') {
				res.status(200).send();
				return;
			}
			res.status(404).send('Not Found: Actor not found');
			console.log("Failed third middleware: Not Found: Actor not found")
			return;
		}

		if (activity.actor !== actorProfile.id) {
			res.status(403).send('Forbidden: Actor mismatch');
			console.log("Failed third middleware: Forbidden: Actor mismatch")
			return;
		}
	}

	next();
};

async function getActorProfile(actorId) {
    try {
        const response = await fetch(actorId, {
            headers: {
                'Accept': 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (err) {
        console.error(`Failed to fetch actor profile: ${err.message}`);
        return null;
    }
}

module.exports = {
    checkContentType,
    checkActivityType,
    checkActor
};
