async function registerApplication(req, res) {
    
    //const server = req.query.user.split("@")[1];

    const server = "mastodon.social"
    const uri = `https://${server}/api/v1/apps`;

    const data = {
        client_name: "Sneaas",
        redirect_uris: "urn:ietf:wg:oauth:2.0:oob",
        scopes: "read write follow",
        website: "https://www.sneaas.no"
    };

    const response = await fetch(uri, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });

    const status = await response.json()

    console.log(status)
}



exports.registrer = registerApplication;