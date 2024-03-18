const express = require('express');
const {MongoClient, ServerApiVersion, ObjectId} = require('mongodb')
const cors = require('cors');
const dotenv = require('dotenv');
const https = require('https');
const fs = require('fs');
const httpSignature = require('http-signature');

dotenv.config();

publicKey = process.env.PUBLICKEY;

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

app.use(express.json());

app.get('/.well-known/webfinger', (req, res) => {
    res.json({
        "subject": "acct:trondss@$sneaas.no",
        "links": [
            {
                "rel": "self",
                "type": "application/activity+json",
                "href": "https://www.sneaas.no/u/trondss"
            }
        ]
    });
});

app.get("/u/trondss", (req, res) => {
    res.json({
        "@context": "https://www.w3.org/ns/activitystreams",
        "type": "Person",
        "id": "https://www.sneaas.no/u/trondss",
        "following": "https://www.sneaas.no/u/trondss/following",
        "followers": "https://www.sneaas.no/u/trondss/followers",
        "inbox": "https://www.sneaas.no/u/trondss/inbox",
        "outbox": "https://www.sneaas.no/u/trondss/outbox",
        "preferredUsername": "trondss",
        "name": "Trond Sneås Skauge",
        "summary": "I am a software developer",
        "icon": {
            "type": "Image",
            "mediaType": "image/jpeg",
            "url": "https://www.sneaas.no/u/trondss/icon"
        },
        "publicKey": {
            "id": "https://www.sneaas.no/u/trondss#main-key",
            "owner": "https://www.sneaas.no/u/trondss",
            "publicKeyPem": publicKey
        }
    });
});

app.use((req, res, next) => {
    if (req.method === 'POST') {
      const contentType = req.get('Content-Type');
      if (!contentType || !contentType.startsWith('application/ld+json')) {
        res.status(415).send('Unsupported Media Type');
        return;
      }
  
      const profile = contentType.split('profile=')[1];
      if (profile !== '"https://www.w3.org/ns/activitystreams"') {
        res.status(415).send('Unsupported Media Type');
        return;
      }
    }
  
    next();
  });

  app.use((req, res, next) => {
    if (req.method === 'POST') {
      const activity = req.body;
  
      if (!activity || !activity.type) {
        res.status(400).send('Bad Request: Missing activity type');
        return;
      }
  
      const validTypes = ['Create', 'Update', 'Delete', 'Follow', 'Accept', 'Reject', 'Add', 'Remove', 'Like', 'Announce', 'Undo', 'Block', 'Flag'];
      if (!validTypes.includes(activity.type)) {
        res.status(400).send('Bad Request: Invalid activity type');
        return;
      }
    }
  
    next();
  });

  app.use(async (req, res, next) => {
    if (req.method === 'POST') {
      const activity = req.body;
  
      if (!activity || !activity.actor) {
        res.status(400).send('Bad Request: Missing actor');
        return;
      }
  
      const actorProfile = await getActorProfile(activity.actor);
      if (!actorProfile) {
        res.status(404).send('Not Found: Actor not found');
        return;
      }
  
      if (activity.actor !== actorProfile.id) {
        res.status(403).send('Forbidden: Actor mismatch');
        return;
      }
    }
  
    next();
  });

app.use((req, res, next) => {
    try {
      const parsed = httpSignature.parseRequest(req);
      if (!httpSignature.verifySignature(parsed, publicKey)) {
        res.status(401).send('Unauthorized');
        return;
      }
      next();
    } catch (err) {
      res.status(500).send('Internal server error');
    }
});

const database = "activitypub";

app.get("/u/trondss/following", async (req, res) => {
    try {
        const collection = client.db(database).collection("following");
        const docs = await collection.find({}).toArray();
        res.json({
            "@context": "https://www.w3.org/ns/activitystreams",
            "type": "OrderedCollection",
            "totalItems": docs.length,
            "first": "https://www.sneaas.no/u/trondss/following?page=true",
            "orderedItems": docs
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal server error');
    }
});

app.get("/u/trondss/followers", (req, res) => {
    app.get("/u/trondss/followers", async (req, res) => {
        try {
            const collection = client.db(database).collection("followers");
            const docs = await collection.find({}).toArray();
            res.json({
                "@context": "https://www.w3.org/ns/activitystreams",
                "type": "OrderedCollection",
                "totalItems": docs.length,
                "first": "https://www.sneaas.no/u/trondss/followers?page=true",
                "orderedItems": docs
            });
        } catch (err) {
            console.error(err);
            res.status(500).send('Internal server error');
        }
    });
});

app.get("/u/trondss/inbox", async (req, res) => {
    try {
        const collection = client.db(database).collection("inbox");
        const docs = await collection.find({}).toArray();
        res.json({
            "@context": "https://www.w3.org/ns/activitystreams",
            "type": "OrderedCollection",
            "totalItems": docs.length,
            "first": "https://www.sneaas.no/u/trondss/inbox?page=true",
            "orderedItems": docs
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal server error');
    }
});

app.get("/u/trondss/outbox", async (req, res) => {
    try {
        const collection = client.db(database).collection("outbox");
        const docs = await collection.find({}).toArray();
        res.json({
            "@context": "https://www.w3.org/ns/activitystreams",
            "type": "OrderedCollection",
            "totalItems": docs.length,
            "first": "https://www.sneaas.no/u/trondss/outbox?page=true",
            "orderedItems": docs
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal server error');
    }
});

app.get("/u/trondss/icon", (req, res) => {
    res.sendFile(__dirname + "/icon.jpg");
});

app.post("/u/trondss/inbox", async (req, res) => {
    try {
        const collection = client.db(database).collection("inbox");
        await collection.insertOne(req.body);
        res.status(200).send();
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal server error');
    }
});

app.post("/u/trondss/outbox", async (req, res) => {
    try {
        const collection = client.db(database).collection("outbox");
        await collection.insertOne(req.body);
        console.log(req.body);
        res.status(200).send();
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal server error');
    }
});

app.post("/u/trondss/follow", async (req, res) => {
	try {
		const followActivity = req.body;
		const collection = client.db(database).collection("followers");

		await collection.insertOne(followActivity);

		const acceptActivity = {
			'@context': 'https://www.w3.org/ns/activitystreams',
			type: 'Accept',
			actor: 'https://example.com/u/trondss',
			object: followActivity.id
		};

		const actorInbox = followActivity.actor + '/inbox';
		const response = await fetch(actorInbox, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(acceptActivity)
		});

		if (!response.ok) {
			throw new Error(`Failed to send Accept activity: ${response.statusText}`);
		}

		res.status(200).send();
	} catch (err) {
		console.error(err);
		res.status(500).send('Internal server error');
	}
});

app.post("/u/trondss/unfollow", async (req, res) => {
    try {
        const undoActivity = req.body;
        const collection = client.db(database).collection("followers");

        if (undoActivity.type === 'Undo' && undoActivity.object.type === 'Follow') {
            await collection.deleteOne({ id: undoActivity.object.id });
            console.log(`Removed follow activity with id: ${undoActivity.object.id}`);
        } else {
            console.log(`Received unknown activity type: ${undoActivity.type}`);
        }

        res.status(200).send();
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal server error');
    }
});

const options = {
    key: fs.readFileSync('server.key'),
    cert: fs.readFileSync('server.cert')
  };

https.createServer(options, app).listen(3000, () => {
    console.log('Server started');
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