const fs = require('fs');
const client = require('./db');
const database = "activitypub";
const path = require('path');
const httpSignature = require('http-signature');
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkContentType(req, res, next) {
    try {
        if (req.method !== 'POST') {
            return next();
        }

        const contentType = (req.get('Content-Type') || req.get('content-type') || '')
            .split(';')[0]
            .trim()
            .toLowerCase();

        const validTypes = ['application/ld+json', 'application/activity+json'];
        
        if (!contentType || !validTypes.includes(contentType)) {
            console.log('🚨 Invalid content type:', contentType);
            return res.status(415).json({
                error: 'Unsupported Media Type',
                expected: validTypes,
                received: contentType
            });
        }

        next();
    } catch (error) {
        console.error('🚨 Content-Type validation error:', error);
        res.status(500).json({ 
            error: 'Internal server error during content-type validation' 
        });
    }
}

async function checkActivityType(req, res, next) {
    try {
        if (req.method !== 'POST') {
            return next();
        }

        const activity = req.body;

        if (!activity || typeof activity !== 'object') {
            console.log('🚨 Missing or invalid activity body');
            return res.status(400).json({
                error: 'Bad Request: Missing or invalid activity body'
            });
        }

        if (!activity.type) {
            console.log('🚨 Missing activity type');
            return res.status(400).json({
                error: 'Bad Request: Missing activity type'
            });
        }

        const validTypes = [
            'Create', 'Update', 'Delete', 'Follow', 'Accept', 'Reject',
            'Add', 'Remove', 'Like', 'Announce', 'Undo', 'Block', 'Flag'
        ];
        
        if (!validTypes.includes(activity.type)) {
            console.log('🚨 Invalid activity type:', activity.type);
            return res.status(400).json({
                error: 'Bad Request: Invalid activity type',
                type: activity.type,
                validTypes
            });
        }

        next();
    } catch (error) {
        console.error('🚨 Activity type validation error:', error);
        res.status(500).json({ 
            error: 'Internal server error during activity type validation' 
        });
    }
}

async function checkActor(req, res, next) {
    try {
        if (req.method !== 'POST') {
            return next();
        }

        const activity = req.body;

        if (!activity || !activity.actor) {
            console.log('🚨 Missing actor in activity');
            return res.status(400).json({
                error: 'Bad Request: Missing actor'
            });
        }

        // Skip database checks for Follow and Accept activities
        if (activity.type === 'Follow' || activity.type === 'Accept') {
            return next();
        }

        const followers = client.db(database).collection('followers');
        const following = client.db(database).collection('following');

        const [actorInFollowers, actorInFollowing] = await Promise.all([
            followers.findOne({ id: activity.actor }),
            following.findOne({ id: activity.actor })
        ]);

        if (!actorInFollowers && !actorInFollowing) {
            console.log('🚨 Actor not found in followers or following:', activity.actor);
            return res.status(404).json({
                error: 'Not Found: Actor not found in followers or following',
                actor: activity.actor
            });
        }

        const actorProfile = await getActorProfile(activity.actor);

        if (!actorProfile || activity.actor !== actorProfile.id) {
            console.log('🚨 Actor profile mismatch:', {
                expected: activity.actor,
                actual: actorProfile?.id
            });
            return res.status(403).json({
                error: 'Forbidden: Actor profile mismatch'
            });
        }

        next();
    } catch (error) {
        console.error('🚨 Actor validation error:', error);
        res.status(500).json({ 
            error: 'Internal server error during actor validation' 
        });
    }
}

async function checkSignature(req, res, next) {
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
            //console.log("Failed fourth middleware: Unauthorized")
            //console.log(req.headers)
            //console.log(req.body)
            return;
        }
        //console.log("Passed fourth middleware")
        next();
    } catch (err) {
        //console.log("Failed fourth middleware: Unauthorized")
        //console.log(err)
        res.status(500).send('Internal server error');
    }
}

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

async function checkAuth(req, res, next) {
    const password = req.body.password;

    if (!password || password !== process.env.PASSWORD) {
        res.status(401).send('Unauthorized');
        return;
    } else {
        next();
    }
}



exports.checkContentType = checkContentType;
exports.checkActivityType = checkActivityType;
exports.checkActor = checkActor;
exports.getActorProfile = getActorProfile;
exports.checkSignature = checkSignature;
exports.checkAuth = checkAuth;

