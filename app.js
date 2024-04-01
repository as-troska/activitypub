const express = require('express');
const {MongoClient, ServerApiVersion, ObjectId} = require('mongodb')
const cors = require('cors');
const dotenv = require('dotenv');
const https = require('https');
const fs = require('fs');
const httpSignature = require('http-signature');
const crypto = require('crypto');
const morgan = require('morgan');
const path = require('path');

dotenv.config();

const publicKey = fs.readFileSync('public.pem', 'utf8');
const privateKey = fs.readFileSync('private.pem', 'utf8');
const client = new MongoClient(process.env.MONGOURI, {});

client.connect(err => {
    if (err) {
        console.error('Failed to connect to MongoDB', err);
        process.exit(1);
    } else {
        console.log('Connected to MongoDB');
    }
});

const app = express();

app.use(cors());

app.use(express.json({
    type: ['application/json', 'application/activity+json', 'application/ld+json']
}));

const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' })
app.use(morgan('combined', { stream: accessLogStream }))

app.get('/.well-known/webfinger', (req, res) => {
    const resource = req.query.resource;
    const username = resource
        .split(':')[1]
        .split('@')[0];

    if (username === 'trondss') {
        res.set('Content-Type', 'application/jrd+json');
        res.json({
            subject: `acct:${username}@sneaas.no`,
            links: [
                {
                    rel: 'self',
                    type: 'application/activity+json',
                    href: `https://www.sneaas.no/u/${username}`
                }
            ]
        });
    } else {
        res
            .status(404)
            .send('Not Found');
    }
});

app.get('/.well-known/nodeinfo', (req, res) => {
    res.json({
        links: [
            {
                rel: 'http://nodeinfo.diaspora.software/ns/schema/2.0',
                href: 'https://www.sneaas.no/nodeinfo/2.0.json'
            }
        ]
    });
});

app.get('/nodeinfo/2.0.json', (req, res) => {
    res.json({
        version: '2.0',
        software: {
            name: 'sneaas',
            version: '1.0.0'
        },
        protocols: ['activitypub'],
        services: {
            inbound: [],
            outbound: []
        },
        openRegistrations: false,
        usage: {
            users: {
                total: 1
            }
        },
        metadata: {}
    });
});

app.get("/u/trondss", (req, res) => {
    res.statusCode = 200;
    res.setHeader("Content-Type", `application/activity+json`);
    res.json({
        "@context": [
            "https://www.w3.org/ns/activitystreams", {
                "@language": "en- GB"
            }
        ],
        "type": "Person",
        "id": "https://www.sneaas.no/u/trondss",
        "outbox": "https://www.sneaas.no/u/trondss/outbox",
        "following": "https://www.sneaas.no/u/trondss/following",
        "followers": "https://www.sneaas.no/u/trondss/followers",
        "inbox": "https://www.sneaas.no/u/trondss/inbox",
        "preferredUsername": "trondss",
        "name": "T",
        "summary": "I am a person who is on the internet.",
        "icon": ["https://www.katolsk.no/nyheter/2015/06/bildegalleri-nytt-studenthjem-i-bergen/bi" +
                "lde2.jpg/@@images/0c68b938-820c-46ec-93eb-6879c6bdb25c.jpeg"],
        "publicKey": {
            "@context": "https://w3id.org/security/v1",
            "@type": "Key",
            "id": "https://www.sneaas.no/u/trondss#main-key",
            "owner": "https://www.sneaas.no/u/trondss",
            "publicKeyPem": publicKey
        }
    });
});

app.get("/u/trondss/outbox", async(req, res) => {
	try {
		const collection = client.db(database).collection("outbox");

		const page = parseInt(req.query.page) || 1;
		const pageSize = parseInt(req.query.pageSize) || 50;
		const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

		const skip = (page - 1) * pageSize;

		const docs = await collection.find({})
			.sort({ published: sortOrder })
			.skip(skip)
			.limit(pageSize)
			.toArray();

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
});

app.get("/u/trondss/following", async(req, res) => {
    try {
        const collection = client.db(database).collection("following");
        const totalItems = await collection.countDocuments();
        res.json({"@context": "https://www.w3.org/ns/activitystreams", "type": "OrderedCollection", "totalItems": totalItems, "first": "https://www.sneaas.no/u/trondss/following?page=true"});
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal server error');
    }
});

app.get("/u/trondss/followers", async(req, res) => {
    try {
        const collection = client.db(database).collection("followers");
        const totalItems = await collection.countDocuments();
        res.json({"@context": "https://www.w3.org/ns/activitystreams", "type": "OrderedCollection", "totalItems": totalItems, "first": "https://www.sneaas.no/u/trondss/followers?page=true"});
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal server error');
    }
});

app.use((req, res, next) => {
    if (req.method === 'POST') {
        let contentType = req.get('Content-Type');

        if (!contentType) {
            contentType = rec.get('content-type')
        }
        console.log(contentType)

        if (!contentType || (contentType !== 'application/ld+json' && contentType !== "application/activity+json")) {
            res
                .status(415)
                .send('Unsupported Media Type');
            console.log("Failed first middleware: Unsupported content type")
            console.log(req.headers)
            console.log(req.body)
            return;
        }
    }
    console.log("Passed first middleware")

    next();
});

app.use((req, res, next) => {
    if (req.method === 'POST') {
        const activity = req.body;
        //console.log(activity)

        if (!activity || !activity.type) {
            res
                .status(400)
                .send('Bad Request: Missing activity type');
            console.log("Failed second middleware: Bad Request: Missing activity type")
            return;
        }

        const validTypes = [
            'Create',
            'Update',
            'Delete',
            'Follow',
            'Accept',
            'Reject',
            'Add',
            'Remove',
            'Like',
            'Announce',
            'Undo',
            'Block',
            'Flag'
        ];
        if (!validTypes.includes(activity.type)) {
            res
                .status(400)
                .send('Bad Request: Invalid activity type');
            console.log("Failed second middleware: Bad Request: Invalid activity type")
            return;
        }
    }
    console.log("Passed second middleware")
    next();
});

app.use(async(req, res, next) => {
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
				// If it's a Delete activity and the actor doesn't exist, return 200 and stop processing
				res.status(200).send();
				return;
			}
			res.status(404).send('Not Found: Actor not found');
			console.log(req.body)
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
});

app.use(async(req, res, next) => {
    try {
        const parsed = httpSignature.parseRequest(req);

        const signingString = parsed.signingString;
        const signature = parsed.params.signature;
        const algorithm = parsed.params.algorithm;
        const keyUrl = parsed.params.keyId;

        let actorKey = await fetch(keyUrl, {
            headers: {
                "Content-type": 'application/activity+json',
                "Accept": 'application/activity+json'
            }
        });
        actorKey = await actorKey.json();
        actorKey = actorKey.publicKey.publicKeyPem;

        const verifier = crypto.createVerify('RSA-SHA256');
        verifier.update(signingString);
        const isVerified = verifier.verify(actorKey, signature, 'base64');

        if (!isVerified) {
            res.status(401).send('Unauthorized');
            console.log("Failed fourth middleware: Unauthorized")
            console.log(req.headers)
            console.log(req.body)
            return;
        }
        console.log("Passed fourth middleware")
        next();
    } catch (err) {
        console.log("Failed fourth middleware: Unauthorized")
        console.log(err)
        res.status(500).send('Internal server error');
    }
});

const database = "activitypub";



app.get("/u/trondss/inbox", async(req, res) => {
    try {
        const collection = client
            .db(database)
            .collection("inbox");
        const docs = await collection
            .find({})
            .toArray();
        res.json({"@context": "https://www.w3.org/ns/activitystreams", "type": "OrderedCollection", "totalItems": docs.length, "first": "https://www.sneaas.no/u/trondss/inbox?page=true", "orderedItems": docs});
    } catch (err) {
        console.error(err);
        res
            .status(500)
            .send('Internal server error');
    }
});



app.get("/u/trondss/icon", (req, res) => {
    res.sendFile(__dirname + "/icon.jpg");
});

app.post("/u/trondss/inbox", async(req, res) => {
    try {
        const activity = req.body;

        console.log(activity);

        if (activity.type === 'Follow') {
            const collection = client
                .db(database)
                .collection("followers");

            const followerExists = await collection.findOne({actor: activity.actor});
            console.log(followerExists)

            const acceptActivity = {
                '@context': 'https://www.w3.org/ns/activitystreams',
                type: 'Accept',
                actor: 'https://www.sneaas.no/u/trondss',
                object: activity.id
            };

            const actorInbox = activity.actor + '/inbox';
            const response = await sendSignedRequest(actorInbox, 'https://www.sneaas.no/u/trondss#main-key', acceptActivity);

            if (!followerExists) {
                await collection.insertOne(activity);
            }
        } else if (activity.type === 'Undo') {
            if (activity.object.type === 'Follow') {

                const collection = client.db(database).collection("followers");
                await collection.deleteOne({actor: activity.actor});
            }
        } else if (activity.type === 'Create') {
            if (activity.object.type === 'Note') {

                const collection = client.db(database).collection("notes");
                await collection.insertOne(activity.object);
            }
        } else if (activity.type === 'Delete') {
            if (activity.object.type === 'Note') {

                const collection = client.db(database).collection("notes");
                const note = await collection.findOne({id: activity.object.id});

                if (note && note.attributedTo === activity.actor) {
                    await collection.deleteOne({id: activity.object.id});
                } else {
                    console.log(`Actor ${activity.actor} tried to delete a note they didn't create`);
                }
            }
        } else if (activity.type === 'Like') {
            const collection = client.db(database).collection("notes");
            const note = await collection.findOne({id: activity.object.id});

            if (note) {
                await collection.updateOne({
                    id: activity.object.id
                }, {
                    $inc: {
                        likes: 1
                    }
                });
            } else {
                console.log(`Note ${activity.object.id} not found`);
            }
        } else if (activity.type === 'Update') {
            if (activity.object.type === 'Note') {
                const collection = client.db(database).collection("notes");
                const note = await collection.findOne({id: activity.object.id});

                if (note && note.attributedTo === activity.actor) {
                    await collection.updateOne({
                        id: activity.object.id
                    }, {
                        $set: {
                            content: activity.object.content
                        }
                    });
                } else {
                    console.log(`Actor ${activity.actor} tried to update a note they didn't create or note not found`);
                }
            }
        } else if (activity.type === 'Announce') {
            const collection = client.db(database).collection("notes");
            const note = await collection.findOne({id: activity.object.id});

            if (note) {
                await collection.updateOne({
                    id: activity.object.id
                }, {
                    $inc: {
                        shares: 1
                    }
                });
            } else {
                console.log(`Note ${activity.object.id} not found`);
            }
        } else if (activity.type === 'Block') {
            const collection = client.db(database).collection("users");
            const user = await collection.findOne({id: activity.actor});

            if (user) {
                await collection.updateOne({
                    id: activity.actor
                }, {
                    $addToSet: {
                        blocked: activity.object.id
                    }
                });
            } else {
                console.log(`User ${activity.actor} not found`);
            }
        } else {
            console.log(`Received unknown activity type: ${activity.type}`);
        }
        res.status(200).send();
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal server error');
    }
});
app.post("/u/trondss/outbox", async(req, res) => {
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
});

// https.createServer(app).listen(3000, () => {     console.log('Server
// started'); });

app.listen(1814, () => {
    console.log('Server started on port 1814 http://localhost:1814/');
});

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

async function sendSignedRequest(inboxUrl, publicKeyId, body) {
    console.log(`Sending signed request to ${inboxUrl} with public key ID ${publicKeyId}`);

    const url = new URL(inboxUrl);
    const host = url.host;
    const path = url.pathname;

    const date = new Date().toUTCString();

    const bodyDigest = crypto
        .createHash('sha256')
        .update(JSON.stringify(body))
        .digest('base64');
    const digest = `SHA-256=${bodyDigest}`;

    const signingString = `(request-target): post ${path}\nhost: ${host}\ndate: ${date}\ndigest: ${digest}`;
    const sign = crypto.createSign('sha256');
    sign.update(signingString);
    const signature = sign.sign(privateKey, 'base64');

    const signatureHeader = `keyId="${publicKeyId}",headers="(request-target) host date digest",signature="${signature}"`;

    console.log(`Sending request to ${inboxUrl} with headers ${JSON.stringify({
        'Host': host,
        'Date': date,
        'Digest': digest,
        'Signature': signatureHeader,
        'Content-Type': 'application/ld+json',
        'Accept': 'application/activity+json'})} and body ${JSON.stringify(body)}`);

        const response = await fetch(inboxUrl, {
            method: 'POST',
            headers: {
                'Host': host,
                'Date': date,
                'Digest': digest,
                'Signature': signatureHeader,
                'Content-Type': 'application/ld+json',
                'Accept': 'application/activity+json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(`Failed to send request: ${response.statusText}`);
        }

        let responseBody = await response.text();

        if (responseBody) {
            try {
                responseBody = JSON.parse(responseBody);
            } catch (err) {
                console.error(`Failed to parse response body as JSON: ${responseBody}`);
                throw err;
            }
        }

        console.log(`Received response: ${JSON.stringify(responseBody)}`);
        return responseBody;
    }