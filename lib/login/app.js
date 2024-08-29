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


    currentApp.vapid = response.vapid_key;
    currentApp.clientId = response.client_id;
    currentApp.clientSecret = response.client_secret;
    currentApp.server = "https://" + server;

    res.redirect("https://" + server + "/oauth/authorize?client_id=" + currentApp.clientId + "&response_type=code&redirect_uri=http://5.9.118.49:1890/oauth&scope=read%20write%20follow");
});

app.get("/oauth", async (req, res) => {
    const code = req.query.code;

    const token = req.query.token;

    console.log(code, token)

    let uri = currentApp.server + "/oauth/token";
    console.log(uri)

    const data = {
        grant_type: "authorization_code",
        client_id: currentApp.clientId,
        client_secret: currentApp.clientSecret,
        code: code,
        scope: "read write follow",
        redirect_uri: "http://5.9.118.49:1890/oauth"
    }

    console.log(data)

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



            // Once authenticated:
            // Get info of trondss@sneaas.no from users instance:  
            // Grab id from that info (.id)
            // Get statuses of that user: /api/v1/accounts/:id/statuses
            // Find status to reply to
            // Post reply to that status: /api/v1/statuses

            const userURI = currentApp.server + "/api/v1/accounts/lookup?acct=trondss@sneaas.no";

            console.log(userURI)

            const user = await fetch(userURI)
            const userData = await user.json();

            let userID = ""
            try {
                userID = userData.id;
                console.log(userData)
            } catch {
                res.send(userData);
                return;
            }

            const statuses = await fetch(currentApp.server + "/api/v1/accounts/" + userID + "/statuses");
            const statusesData = await statuses.json();

            let currentPost = "";
            let lookupUrl = "https://www.sneaas.no/u/trondss/notes/1a9ad038-e820-408f-a7d1-20692eca2ceb";
            
            for (let status of statusesData) {
                if (status.url === lookupUrl) {
                    currentPost = status.id;
                    break;
                }
            }

            


            
            const formData = new FormData();
            formData.append("status", "Testing replies");
            formData.append("in_reply_to_id", currentPost);
            formData.append("visibility", "public");

            const post = await fetch("https://mastodon.social/api/v1/statuses", {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + authData.access_token,
                    // "Content-Type": "multipart/form-data" is not needed, as the browser will set it along with the boundary parameter
                },
                body: formData
            });

            const postData = await post.json();


            res.send(postData);

            return;
        }



})

app.listen(1890, () => {
    console.log("Server is running on port 1890");
});