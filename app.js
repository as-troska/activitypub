const express = require('express');
const {MongoClient, ServerApiVersion, ObjectId} = require('mongodb')
const cors = require('cors');
const dotenv = require('dotenv');
const https = require('https');
const fs = require('fs');
const httpSignature = require('http-signature');
const crypto = require('crypto');
const morgan = require('morgan');






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

app.use(express.json({type: ['application/json', 'application/activity+json', 'application/ld+json'] }));

app.use(morgan('combined'));


app.get('/.well-known/webfinger', (req, res) => {
	const resource = req.query.resource;
	const username = resource.split(':')[1].split('@')[0];

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
		res.status(404).send('Not Found');
	}
});

app.get("/u/trondss", (req, res) => {
	res.statusCode = 200;
	res.setHeader("Content-Type", `application/activity+json`);
	res.json({
	  "@context": ["https://www.w3.org/ns/activitystreams", { "@language": "en- GB" }],
	  "type": "Person",
	  "id": "https://www.sneaas.no/u/trondss",
	  "outbox": "https://www.sneaas.no/u/trondss/outbox",
	  "following": "https://www.sneaas.no/u/trondss/following",
	  "followers": "https://www.sneaas.no/u/trondss/followers",
	  "inbox": "https://www.sneaas.no/u/trondss/inbox",
	  "preferredUsername": "trondss",
	  "name": "T",
	  "summary": "I am a person who is on the internet.",
	  "icon": [
		"https://www.katolsk.no/nyheter/2015/06/bildegalleri-nytt-studenthjem-i-bergen/bilde2.jpg/@@images/0c68b938-820c-46ec-93eb-6879c6bdb25c.jpeg"
	  ],
	  "publicKey": {
		"@context": "https://w3id.org/security/v1",
		"@type": "Key",
		"id": "https://www.sneaas.no/u/trondss#main-key",
		"owner": "https://www.sneaas.no/u/trondss",
		"publicKeyPem": publicKey
	  }
	});
});

app.use((req, res, next) => {
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
	console.log("Passed first middleware")
  
    next();
  });

  app.use((req, res, next) => {
    if (req.method === 'POST') {
      const activity = req.body;
      //console.log(activity)      
  
      if (!activity || !activity.type) {
        res.status(400).send('Bad Request: Missing activity type');
		console.log("Failed second middleware: Bad Request: Missing activity type")
        return;
      }
  
      const validTypes = ['Create', 'Update', 'Delete', 'Follow', 'Accept', 'Reject', 'Add', 'Remove', 'Like', 'Announce', 'Undo', 'Block', 'Flag'];
      if (!validTypes.includes(activity.type)) {
        res.status(400).send('Bad Request: Invalid activity type');
		console.log("Failed second middleware: Bad Request: Invalid activity type")
        return;
      }
    }
	console.log("Passed second middleware")
    next();
  });

  app.use(async (req, res, next) => {
    if (req.method === 'POST') {
      const activity = req.body;
  
      if (!activity || !activity.actor) {
        res.status(400).send('Bad Request: Missing actor');
		console.log("Failed third middleware: Bad Request: Missing actor")
        return;
      }
  
      const actorProfile = await getActorProfile(activity.actor);
      if (!actorProfile) {
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
	console.log("Passed third middleware")  
    next();
  });

  

  app.use(async (req, res, next) => {
    try {
      const parsed = httpSignature.parseRequest(req);
      
      const signingString = parsed.signingString;
      const signature = parsed.params.signature;
      const algorithm = parsed.params.algorithm;
      const keyUrl = parsed.params.keyId;

      console.log(algorithm)
      console.log(signature)
      console.log(signingString)
      console.log(keyUrl)

      let actorKey = await fetch(keyUrl, {
        headers: {
          "Content-type": 'application/activity+json',
          "Accept": 'application/activity+json'
        }});
      actorKey = await actorKey.json();

      console.log(actorKey)


      

      // Concatenate the headers

    

      // // Verify the signature
      // const verifier = crypto.createVerify('RSA-SHA256');
      // verifier.update(signingString);
      // const isVerified = verifier.verify(publicKey, signatureValue, 'base64');

      // if (!isVerified) {
      //   res.status(401).send('Unauthorized');
      //   console.log("Failed fourth middleware: Unauthorized")
      //   console.log(req.headers)
      //   console.log(req.body)
      //   return;
      // }
      // console.log("Passed fourth middleware")
      // next();
    } catch (err) {
      console.log("Failed fourth middleware: Unauthorized")
      console.log(err)  
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
			actor: 'https://www.sneaas.no/u/trondss',
			object: followActivity.id
		};

		const actorInbox = followActivity.actor + '/inbox';
		const response = await sendSignedRequest(actorInbox, 'https://www.sneaas.no/u/trondss#main-key', acceptActivity);

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

            const acceptActivity = {
                '@context': 'https://www.w3.org/ns/activitystreams',
                type: 'Accept',
                actor: 'https://www.sneaas.no/u/trondss',
                object: undoActivity.id
            };

            const actorInbox = undoActivity.actor + '/inbox';
            const response = await sendSignedRequest(actorInbox, 'https://www.sneaas.no/u/trondss#main-key', acceptActivity);

            if (!response.ok) {
                throw new Error(`Failed to send Accept activity: ${response.statusText}`);
            }
        } else {
            console.log(`Received unknown activity type: ${undoActivity.type}`);
        }

        res.status(200).send();
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal server error');
    }
});

// https.createServer(app).listen(3000, () => {
//     console.log('Server started');
// });

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
    const url = new URL(inboxUrl);
    const host = url.host;
    const path = url.pathname;

    const date = new Date().toUTCString();

    const bodyDigest = crypto.createHash('sha256').update(JSON.stringify(body)).digest('base64');
    const digest = `SHA-256=${bodyDigest}`;

    const signingString = `(request-target): post ${path}\nhost: ${host}\ndate: ${date}\ndigest: ${digest}`;
    const sign = crypto.createSign('sha256');
    sign.update(signingString);
    const signature = sign.sign(privateKey, 'base64');

    const signatureHeader = `keyId="${publicKeyId}",headers="(request-target) host date digest",signature="${signature}"`;

    const response = await fetch(inboxUrl, {
        method: 'POST',
        headers: {
            'Host': host,
            'Date': date,
            'Digest': digest,
            'Signature': signatureHeader,
            'Content-Type': 'application/ld+json'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
}