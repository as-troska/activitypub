const fs = require('fs');

const publicKey = fs.readFileSync('public.pem', 'utf8');
const privateKey = fs.readFileSync('private.pem', 'utf8');

function trondss(req, res) {
    res.statusCode = 200;
    res.setHeader("Content-Type", `application/activity+json`);
    res.json({
        "@context": [
            "https://www.w3.org/ns/activitystreams",
            "https://w3id.org/security/v1"
        ],
        "manuallyApprovesFollowers": false,
        "memorial": false,
        "hideFollows": false,
        "hideFollowers": false,
        "featured": [],
        "type": "Person",
        "id": "https://www.sneaas.no/u/trondss",
        "outbox": "https://www.sneaas.no/u/trondss/outbox",
        "following": "https://www.sneaas.no/u/trondss/following",
        "followers": "https://www.sneaas.no/u/trondss/followers",
        "inbox": "https://www.sneaas.no/u/trondss/inbox",
        "preferredUsername": "trondss",
        "name": "T",
        "summary": "I am a person who is on the internet.",
        "icon": {
            "type": "Image",
            "mediaType": "image/png",
            "url": "https://www.sneaas.no/u/trondss/icon"
        },
        "header": {
            "type": "Image",
            "mediaType": "image/jpeg",
            "url": "https://www.sneaas.no/u/trondss/header"
        },
        "alsoKnownAs": [
            "https://www.github.com/as-troska",
        ],
        "urls": [
            {"type": "Link", "href": "https://github.com/as-troska", "name": "GitHub"},
            {"type": "Link", "href": "https://www.sneås.no", "name": "Website"},
            {"type": "Link", "href": "https://www.goodreads.com/user/show/10008902-trond-skauge", "name": "Goodreads"},
            {"type": "Link", "href": "https://steamcommunity.com/profiles/76561198061168291/", "name": "Steam"}
        ],
        "publicKey": {
            "@context": "https://w3id.org/security/v1",
            "@type": "Key",
            "id": "https://www.sneaas.no/u/trondss#main-key",
            "owner": "https://www.sneaas.no/u/trondss",
            "publicKeyPem": publicKey
        }
    });
}

async function icon(req, res) {
    res.sendFile(__dirname + "/ap.png");
}

async function header(req, res) {
    res.sendFile(__dirname + "/header.jpg");
}


exports.trondss = trondss;
exports.icon = icon;
exports.header = header;