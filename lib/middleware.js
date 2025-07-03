const fs = require('fs');
const client = require('./db');
const log = require('./logger');
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
            log.warn('Invalid content type received', null, {
                received: contentType,
                expected: validTypes,
                userAgent: req.get('User-Agent'),
                url: req.url
            });
            return res.status(415).json({
                error: 'Unsupported Media Type',
                expected: validTypes,
                received: contentType
            });
        }

        next();
    } catch (error) {
        log.error('Content-Type validation error', error, {
            url: req.url,
            method: req.method,
            headers: req.headers
        });
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
            log.warn('Missing or invalid activity body', null, {
                bodyType: typeof req.body,
                bodyPresent: !!req.body,
                url: req.url
            });
            return res.status(400).json({
                error: 'Bad Request: Missing or invalid activity body'
            });
        }

        if (!activity.type) {
            log.warn('Missing activity type in request', null, {
                activityKeys: Object.keys(activity),
                actor: activity.actor,
                url: req.url
            });
            return res.status(400).json({
                error: 'Bad Request: Missing activity type'
            });
        }

        const validTypes = [
            'Create', 'Update', 'Delete', 'Follow', 'Accept', 'Reject',
            'Add', 'Remove', 'Like', 'Announce', 'Undo', 'Block', 'Flag'
        ];
        
        if (!validTypes.includes(activity.type)) {
            log.warn('Invalid activity type received', null, {
                receivedType: activity.type,
                validTypes: validTypes,
                actor: activity.actor,
                activityId: activity.id
            });
            return res.status(400).json({
                error: 'Bad Request: Invalid activity type',
                type: activity.type,
                validTypes
            });
        }

        log.debug('Activity type validation passed', {
            type: activity.type,
            actor: activity.actor,
            activityId: activity.id
        });
        
        next();
    } catch (error) {
        log.error('Activity type validation error', error, {
            url: req.url,
            method: req.method,
            bodyPresent: !!req.body
        });
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
        const params = parsed.params;
        const signature = params.signature;
        const algorithm = params.algorithm;
        const keyId = params.keyId;

        if (!keyId || !signature || !algorithm) {
            console.log('🚨 Missing signature parameters');
            return res.status(401).json({
                error: 'Unauthorized: Missing signature parameters'
            });
        }

        // Fetch the actor's public key
        const actorResponse = await fetch(keyId, {
            headers: {
                'Content-Type': 'application/activity+json',
                'Accept': 'application/activity+json',
                'User-Agent': 'Sneaas.no ActivityPub Server'
            },
            timeout: 10000 // 10 second timeout
        });

        if (!actorResponse.ok) {
            console.log('🚨 Failed to fetch actor key:', actorResponse.status);
            return res.status(401).json({
                error: 'Unauthorized: Failed to fetch actor public key'
            });
        }

        const actorData = await actorResponse.json();
        const publicKeyPem = actorData.publicKey?.publicKeyPem;

        if (!publicKeyPem) {
            console.log('🚨 No public key found in actor data');
            return res.status(401).json({
                error: 'Unauthorized: No public key found'
            });
        }

        // Verify the signature
        const verifier = crypto.createVerify('RSA-SHA256');
        verifier.update(signingString);
        const isVerified = verifier.verify(publicKeyPem, signature, 'base64');

        if (!isVerified) {
            console.log('🚨 Signature verification failed');
            return res.status(401).json({
                error: 'Unauthorized: Signature verification failed'
            });
        }

        next();
    } catch (error) {
        console.error('🚨 Signature verification error:', error);
        res.status(500).json({ 
            error: 'Internal server error during signature verification' 
        });
    }
}

async function getActorProfile(actorId) {
    try {
        if (!actorId || typeof actorId !== 'string') {
            throw new Error('Invalid actor ID provided');
        }

        const response = await fetch(actorId, {
            headers: {
                'Accept': 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
                'User-Agent': 'Sneaas.no ActivityPub Server'
            },
            timeout: 10000 // 10 second timeout
        });

        if (!response.ok) {
            throw new Error('HTTP ' + response.status + ': ' + response.statusText);
        }

        const profile = await response.json();
        
        if (!profile || !profile.id) {
            throw new Error('Invalid actor profile: missing id');
        }

        return profile;
    } catch (error) {
        console.error('🚨 Failed to fetch actor profile for ' + actorId + ':', error.message);
        return null;
    }
}

async function checkAuth(req, res, next) {
    try {
        const password = req.body.password;

        if (!password) {
            console.log('🚨 Missing password in request');
            return res.status(401).json({
                error: 'Unauthorized: Missing password'
            });
        }

        if (password !== process.env.PASSWORD) {
            console.log('🚨 Invalid password provided');
            return res.status(401).json({
                error: 'Unauthorized: Invalid password'
            });
        }

        next();
    } catch (error) {
        console.error('🚨 Authentication error:', error);
        res.status(500).json({ 
            error: 'Internal server error during authentication' 
        });
    }
}



exports.checkContentType = checkContentType;
exports.checkActivityType = checkActivityType;
exports.checkActor = checkActor;
exports.getActorProfile = getActorProfile;
exports.checkSignature = checkSignature;
exports.checkAuth = checkAuth;

