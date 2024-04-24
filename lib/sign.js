const fs = require('fs');
const crypto = require('crypto');

const publicKey = fs.readFileSync('public.pem', 'utf8');
const privateKey = fs.readFileSync('private.pem', 'utf8');

async function sendSignedRequest(inboxUrl, publicKeyId, body) {
    const url = new URL(inboxUrl);
    const host = url.host;
    const path = url.pathname;

    const date = new Date().toUTCString();

    const bodyDigest = crypto.createHash('sha256').update(JSON.stringify(body)).digest('base64');
    const digest = `SHA-256=${bodyDigest}`;

    const signingString = `(request-target): post ${path}\nhost: ${host}\ndate: ${date}\ndigest: ${digest}\ncontent-type: application/activity+json`;
    const sign = crypto.createSign('sha256');
    sign.update(signingString);
    const signature = sign.sign(privateKey, 'base64');

    const signatureHeader = `keyId="${publicKeyId}",algorithm="rsa-sha256",headers="(request-target) host date digest content-type",signature="${signature}"`;

    const headers = {
        'Host': host,
        'Date': date,
        'Digest': digest,
        'Signature': signatureHeader,
        'Content-Type': 'application/activity+json',
        'Accept': 'application/activity+json'
    };

    const options = {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
        redirect: "follow"
    };

    const logData = `Sending request to ${inboxUrl} with headers ${JSON.stringify(headers)} and body ${JSON.stringify(body)}\n`;

    fs.appendFile('outgoingPosts.log', logData, (err) => {
        if (err) {
            console.error(`Failed to log outgoing post: ${err}`);
        }
    });

    const response = await fetch(inboxUrl, options);

    if (!response.ok) {
        throw new Error(`Failed to send request: ${response.statusText}`);
    }
    // console.log(response.status)
    // let responseBody = await response.text();

    // if (responseBody) {
    //     try {
    //         responseBody = JSON.parse(responseBody);
    //     } catch (err) {
    //         //console.error(`Failed to parse response body as JSON. Response body: ${responseBody}`);
    //         //console.error("Failed to parse response body as JSON")
    //         throw err;
    //     }
    // }

    return //responseBody;
}

exports.sendSignedRequest = sendSignedRequest;