const client = require('./db');
const database = "activitypub";
const { v4: uuidv4 } = require('uuid');
const sign = require("./sign");
const { get } = require('./outbox');

const sendSignedRequest = sign.sendSignedRequest;

async function getFollowing(req, res) {
    try {
        const collection = client.db(database).collection("following");
        const totalItems = await collection.countDocuments();
        const following = await collection.find().toArray();
        res.json({
            "@context": "https://www.w3.org/ns/activitystreams",
            "summary": "trondss' following", 
            "id": "https://www.sneaas.no/u/trondss/following",
            "type": "OrderedCollection", 
            "totalItems": totalItems,             
            "orderedItems": following
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal server error');
    }
}

async function getUser(req, res) {
    const user = req.params.user;

    const username = user.split("@")[0];
    const domain = user.split("@")[1];

    const webfingerURL = "http://"+domain+"/.well-known/webfinger?resource=acct:"+username+"@"+domain;
    try {
        const webfinger = await fetch(webfingerURL, {
            headers: {
                'Accept': 'application/jrd+json'
            }
        });

        const webfingerJSON = await webfinger.json()


        const actorURL = webfingerJSON.links[0].href;

        const actor = await fetch(actorURL, {
            headers: {
                'Accept': 'application/json'
            }
        });   

        res.json(await actor.json());           

    } catch (err) {
        console.error(err);
        res.status(500).send('Could not fetch user');
    }     
}

async function sendFollowRequest(req, res) {
    const actor = req.params.actor

    const username = actor.split("@")[0];
    const domain = actor.split("@")[1];

    const webfingerURL = "http://"+domain+"/.well-known/webfinger?resource=acct:"+username+"@"+domain;

    let inboxURL = "";
    let actorObject = "";
    try {
        const webfinger = await fetch(webfingerURL, {
            headers: {
                'Accept': 'application/jrd+json'
            }
        });

        const webfingerJSON = await webfinger.json()


        const actorURL = webfingerJSON.links[0].href;

        const actor = await fetch(actorURL, {
            headers: {
                'Accept': 'application/json'
            }
        });   

        const actorJSON = await actor.json();
        inboxURL = actorJSON.inbox;
        actorObject = actorJSON.id;         

    } catch (err) {
        console.error(err);
        res.status(500).send('Could not fetch user');
    }  

    const request = {
        "@context": "https://www.w3.org/ns/activitystreams",
        "id": "https://www.sneaas.no/u/trondss/follows/" + uuidv4(),
        "type": "Follow",
        "actor": "https://www.sneaas.no/u/trondss",
        "object": actorObject                
    }

    try {
        const collection = client.db(database).collection("follows");
        await collection.insertOne(request);       
        await sendSignedRequest(inboxURL, "https://www.sneaas.no/u/trondss#main-key", request);
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal server error');
    }
}


exports.get = getFollowing;
exports.user = getUser;
exports.follow = sendFollowRequest;
