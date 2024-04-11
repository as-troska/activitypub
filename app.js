const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const https = require('https');
const fs = require('fs');
const httpSignature = require('http-signature');
const crypto = require('crypto');
const morgan = require('morgan');
const path = require('path');
const wellKnown = require('./lib/wellKnown');
const user = require('./lib/user');
const middleware = require("./lib/middleware")
const client = require("./lib/db")
const outbox = require("./lib/outbox")
const inbox = require("./lib/inbox")
const followers = require("./lib/followers")
const following = require("./lib/following")

// Middleware
const checkContentType = middleware.checkContentType;
const checkActivityType = middleware.checkActivityType;
const checkActor = middleware.checkActor;
const checkSignature = middleware.checkSignature;

// Setup
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json({
    type: ['application/json', 'application/activity+json', 'application/ld+json']
}));

// Logging
const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' })
app.use(morgan('combined', { stream: accessLogStream }))

//Routes
app.get('/.well-known/webfinger', wellKnown.webfinger);
app.get('/.well-known/nodeinfo', wellKnown.nodeinfo);
app.get('/nodeinfo/2.0.json', wellKnown.nodeinfo2);
app.get("/u/trondss", user.trondss);
app.get("/u/trondss/icon", user.icon);
app.get("/u/trondss/outbox", outbox.get);
app.get("/u/trondss/following", following.get);
app.get("/u/trondss/followers", followers.get);
app.get("/u/trondss/inbox", inbox.get);

app.post("/u/trondss/inbox", checkContentType, checkActivityType, checkActor, checkSignature, inbox.post);
app.post("/u/trondss/outbox", checkContentType, checkActivityType, checkActor, checkSignature, outbox.post);

app.listen(1814, () => {
    console.log('Server started on port 1814 http://localhost:1814/');
});