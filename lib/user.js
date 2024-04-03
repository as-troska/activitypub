function trondss(req, res) {
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
}

exports.trondss = trondss;