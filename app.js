const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const https = require('https');
const fs = require('fs');
const httpSignature = require('http-signature');
const crypto = require('crypto');
const morgan = require('morgan');
const winston = require('winston');
const cron = require('node-cron');
const path = require('path')

const wellKnown = require('./lib/wellKnown');
const user = require('./lib/user');
const client = require("./lib/db")
const outbox = require("./lib/outbox")
const inbox = require("./lib/inbox")
const followers = require("./lib/followers")
const following = require("./lib/following")
const activities = require("./lib/activities")
const { checkContentType, checkActivityType, checkActor, checkSignature, checkAuth } = require("./lib/middleware")

// Setup
dotenv.config();
const app = express();
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json({
    type: ['application/json', 'application/activity+json', 'application/ld+json']
}));

// Logging
const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' })

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.printf(info => {        
        const message = JSON.parse(info.message);
        return `${info.level}: ${JSON.stringify(message, null, 2)}`;
    }),
    transports: [
        new winston.transports.File({ filename: 'access.log' })
    ]
});



const morganMiddleware = morgan(function (tokens, req, res) {
    return JSON.stringify({
        method: tokens.method(req, res),
        url: tokens.url(req, res),
        status: tokens.status(req, res),
        contentLength: tokens.res(req, res, 'content-length'),
        responseTime: `${tokens['response-time'](req, res)} ms`,
        headers: req.headers,
        body: req.body
    });
}, { stream: { write: message => logger.info(message.trim()) } });

app.use(morganMiddleware)

//Routes
app.get('/.well-known/webfinger', wellKnown.webfinger);
app.get('/.well-known/nodeinfo', wellKnown.nodeinfo);
app.get('/nodeinfo/2.0.json', wellKnown.nodeinfo2);
app.get("/u/trondss", user.trondss);
app.get("/u/trondss/icon", user.icon);
app.get("/u/trondss/header", user.header);
app.get("/u/trondss/outbox", outbox.get);
app.get("/u/trondss/following", following.get);
app.get("/u/trondss/followers", followers.get);
app.get("/u/trondss/inbox", inbox.get);
app.get("/u/trondss/:activityType/:uuid", activities.serve);

app.get("/findUser/:user", checkAuth, following.user);
app.post("/follow/:actor", checkAuth, following.follow);


app.get("/createNote", (req, res) => {
    res.sendFile(__dirname + "/www/createNote.html")
});
app.get("/lookupUser", (req, res) => {
    res.sendFile(__dirname + "/www/userLookup.html")
})

app.post("/u/trondss/inbox", checkContentType, checkActivityType, checkActor, checkSignature, inbox.post);
app.post("/u/trondss/outbox", checkAuth, outbox.post);

cron.schedule('0 * * * *', followers.refresh);

app.listen(1814, () => {
    console.log('Server started on port 1814 http://localhost:1814/');
});