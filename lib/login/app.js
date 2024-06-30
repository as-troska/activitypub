const express = require("express");
const path = require("path");



const app = express();

const currentApp = {};


app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({extended: true}))


app.post("/authorizeApp", async (req, res) => {
    const login = req.body.loginHandle;

    const server = login.split("@")[1];

    const uri = `https://${server}/api/v1/apps`;

    const data = {
        client_name: "Sneaas",
        redirect_uris: "http://5.9.118.49:1890/oauth",
        scopes: "read write follow",
        website: "https://www.sneaas.no"
    };

    let response = await fetch(uri, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });

    response = await response.json();

    console.log(response)


    currentApp.vapid = response.vapid_key;
    currentApp.clientId = response.client_id;
    currentApp.clientSecret = response.client_secret;
    currentApp.server = "https://" + server;

    res.redirect("https://" + server + "/oauth/authorize?client_id=" + currentApp.clientId + "&response_type=code&redirect_uri=http://5.9.118.49:1890/oauth&scope=read%20write%20follow");
});

app.get("/oauth", async (req, res) => {
    const code = req.query.code;

    const token = req.query.token;

    let uri = currentApp.server + "/oauth/token";

    const data = {
        grant_type: "authorization_code",
        client_id: currentApp.clientId,
        client_secret: currentApp.clientSecret,
        code: code,
        scope: "read write follow",
        redirect_uri: "http://5.9.118.49:1890/oauth"
    }

        if (token) {
            res.send(token);
            return;
        } else if (code) {
            const response = await fetch(uri, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data)


            });
            const authData = await response.json();

            console.log(authData)

            const test = {
                content: "<p>Testing replies</p>",
                in_reply_to_id: "112370894701883621",
                visibility: "public"
            }
    
            const post = await fetch("https://mastodon.social/api/v1/statuses", {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + authData.access_token,
                    "Idempotency-Key": "123456789",
                },
                body: JSON.stringify(test)
            })

            const postData = await post.json();


            res.send(postData);

            return;
        }



})

app.listen(1890, () => {
    console.log("Server is running on port 1890");
});