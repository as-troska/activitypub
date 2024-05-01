# Sneaas.no - ActivityPub implementation for a personal blog

After listening to [Håkon Wium Lie](https://www.wiumlie.no) at [Kode24-dagen v3.0](https://www.kode24-dagen.no)
, I became interested in the [ActivityPub-protocol](https://www.w3.org/TR/activitypub/) and started reading up on the subject. I had recently started developing a personal landing page (still unreleased), and had plans for a blog on this site. I didn't want to use Wordpress, Blogger or any of the other CMSs for this, even though they all have solved the issue of comments and follows in ways I probably never will be able to. I still want those features on my site, so I started to see if there was any ActivityPub solutions to this usecase. And there were a lot. Wordpress even has a plugin for ActivityPub, and there are tailor made blog-systems built around the protocol. Foolishly enough, I didn't go for any of these, but instead started my own implementation of the protocol, which is the repo you are looking at right now.

I don't know if I will be able to finish this project, but at least I have learned a lot so far. [Paul Kinlan](https://paul.kinlan.me/adding-activity-pub-to-your-static-site/) has been a huge inspiration, as well as the [apex-package.](https://www.npmjs.com/package/activitypub-express) I guess Copilot shouldn't be forgotten either...

## Features finished (more or less)
- Webfinger
- Actor-information
- Follower and following collections
- http-signature
- Inbox for the most basic activities
- Logging

## Features being worked on
- Outbox and it's side effects
- Database structure and queries

In other words: You probably shouldn't clone this project if you are not up for some serious work! There are much much much much better implementations out there!
