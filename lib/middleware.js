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
            log.warn('Missing actor in activity', null, {
                activityPresent: !!activity,
                activityType: activity ? activity.type : null,
                url: req.url
            });
            return res.status(400).json({
                error: 'Bad Request: Missing actor'
            });
        }

        // Skip database checks for Follow and Accept activities
        if (activity.type === 'Follow' || activity.type === 'Accept') {
            log.debug('Skipping actor validation for activity type', {
                type: activity.type,
                actor: activity.actor
            });
            return next();
        }

        const followers = client.db(database).collection('followers');
        const following = client.db(database).collection('following');

        let actorInFollowers = null;
        let actorInFollowing = null;
        
        try {
            const results = await Promise.all([
                followers.findOne({ id: activity.actor }),
                following.findOne({ id: activity.actor })
            ]);
            actorInFollowers = results[0];
            actorInFollowing = results[1];
            
            log.dbOperation('find', 'followers_and_following', { actor: activity.actor }, results);
        } catch (dbError) {
            log.error('Database error during actor lookup', dbError, {
                actor: activity.actor,
                collections: ['followers', 'following']
            });
            return res.status(500).json({
                error: 'Internal server error during actor lookup'
            });
        }

        if (!actorInFollowers && !actorInFollowing) {
            log.warn('Actor not found in followers or following', null, {
                actor: activity.actor,
                activityType: activity.type,
                activityId: activity.id
            });
            return res.status(404).json({
                error: 'Not Found: Actor not found in followers or following',
                actor: activity.actor
            });
        }

        // Verify actor profile
        const actorProfile = await getActorProfile(activity.actor);

        if (!actorProfile) {
            log.error('Failed to fetch actor profile for validation', null, {
                actor: activity.actor,
                activityType: activity.type
            });
            return res.status(503).json({
                error: 'Service Unavailable: Cannot verify actor profile'
            });
        }

        if (activity.actor !== actorProfile.id) {
            log.warn('Actor profile mismatch detected', null, {
                expected: activity.actor,
                actual: actorProfile.id,
                activityType: activity.type
            });
            return res.status(403).json({
                error: 'Forbidden: Actor profile mismatch'
            });
        }

        log.debug('Actor validation passed', {
            actor: activity.actor,
            activityType: activity.type,
            foundInFollowers: !!actorInFollowers,
            foundInFollowing: !!actorInFollowing
        });

        next();
    } catch (error) {
        log.error('Actor validation error', error, {
            actor: activity ? activity.actor : null,
            activityType: activity ? activity.type : null,
            url: req.url
        });
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
            log.warn('Missing signature parameters', null, {
                keyIdPresent: !!keyId,
                signaturePresent: !!signature,
                algorithmPresent: !!algorithm,
                url: req.url
            });
            return res.status(401).json({
                error: 'Unauthorized: Missing signature parameters'
            });
        }

        // Fetch the actor's public key
        let actorResponse;
        try {
            log.debug('Fetching actor public key', { keyId: keyId });
            
            actorResponse = await fetch(keyId, {
                headers: {
                    'Content-Type': 'application/activity+json',
                    'Accept': 'application/activity+json',
                    'User-Agent': 'Sneaas.no ActivityPub Server'
                },
                timeout: 10000 // 10 second timeout
            });
        } catch (fetchError) {
            log.error('Network error fetching actor key', fetchError, {
                keyId: keyId,
                errorType: fetchError.constructor.name
            });
            return res.status(503).json({
                error: 'Service Unavailable: Cannot fetch actor public key'
            });
        }

        if (!actorResponse.ok) {
            log.warn('Failed to fetch actor key - HTTP error', null, {
                keyId: keyId,
                status: actorResponse.status,
                statusText: actorResponse.statusText
            });
            return res.status(401).json({
                error: 'Unauthorized: Failed to fetch actor public key'
            });
        }

        let actorData;
        try {
            actorData = await actorResponse.json();
        } catch (parseError) {
            log.error('Failed to parse actor data JSON', parseError, {
                keyId: keyId,
                contentType: actorResponse.headers.get('content-type')
            });
            return res.status(401).json({
                error: 'Unauthorized: Invalid actor data format'
            });
        }

        const publicKeyPem = actorData.publicKey && actorData.publicKey.publicKeyPem;

        if (!publicKeyPem) {
            log.warn('No public key found in actor data', null, {
                keyId: keyId,
                actorDataKeys: Object.keys(actorData),
                hasPublicKey: !!actorData.publicKey
            });
            return res.status(401).json({
                error: 'Unauthorized: No public key found'
            });
        }

        // Verify the signature
        let isVerified = false;
        try {
            const verifier = crypto.createVerify('RSA-SHA256');
            verifier.update(signingString);
            isVerified = verifier.verify(publicKeyPem, signature, 'base64');
        } catch (cryptoError) {
            log.error('Cryptographic verification error', cryptoError, {
                keyId: keyId,
                signatureLength: signature ? signature.length : 0,
                algorithm: algorithm
            });
            return res.status(401).json({
                error: 'Unauthorized: Signature verification failed'
            });
        }

        if (!isVerified) {
            log.warn('Signature verification failed', null, {
                keyId: keyId,
                algorithm: algorithm,
                signatureLength: signature.length
            });
            return res.status(401).json({
                error: 'Unauthorized: Signature verification failed'
            });
        }

        log.debug('Signature verification successful', {
            keyId: keyId,
            algorithm: algorithm
        });

        next();
    } catch (error) {
        log.error('Signature verification error', error, {
            keyId: keyId || 'unknown',
            url: req.url,
            method: req.method
        });
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

        log.debug('Actor profile fetched successfully', {
            actorId: actorId,
            profileType: profile.type,
            profileName: profile.name
        });
        
        return profile;
    } catch (error) {
        log.error('Failed to fetch actor profile for ' + actorId, error, {
            actorId: actorId,
            errorType: error.constructor.name
        });
        return null;
    }
}

async function checkAuth(req, res, next) {
    try {
        const password = req.body.password;

        if (!password) {
            log.warn('Missing password in authentication request', null, {
                url: req.url,
                method: req.method,
                userAgent: req.get('User-Agent')
            });
            return res.status(401).json({
                error: 'Unauthorized: Missing password'
            });
        }

        if (!process.env.PASSWORD) {
            log.error('PASSWORD environment variable not configured', null, {
                nodeEnv: process.env.NODE_ENV
            });
            return res.status(500).json({
                error: 'Internal server error: Authentication not configured'
            });
        }

        if (password !== process.env.PASSWORD) {
            log.warn('Invalid password provided for authentication', null, {
                url: req.url,
                method: req.method,
                passwordLength: password.length,
                userAgent: req.get('User-Agent')
            });
            return res.status(401).json({
                error: 'Unauthorized: Invalid password'
            });
        }

        log.info('Authentication successful', {
            url: req.url,
            method: req.method,
            userAgent: req.get('User-Agent')
        });

        next();
    } catch (error) {
        log.error('Authentication error', error, {
            url: req.url,
            method: req.method
        });
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

