const fs = require('fs');

const publicKey = fs.readFileSync('public.pem', 'utf8');
const privateKey = fs.readFileSync('private.pem', 'utf8');

async function sendSignedRequest(inboxUrl, publicKeyId, body) {
    console.log(`Sending signed request to ${inboxUrl} with public key ID ${publicKeyId}`);

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

    exports.sign = sendSignedRequest;