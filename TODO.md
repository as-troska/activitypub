# Sneaas.no - ActivityPub implementation for a personal blog


### To do
- [ ] Add authentication
- [ ] Add route to /favicon.ico
- [ ] Consider adding "/api/v1/timelines/public?limit=100", "/api/v1/streaming/public" and "/api/v1/instance/peers"
- [ ] Add route to /robots.txt
- [ ] Check what happens when webfinger is hit with @www.sneaas.no instead of @sneaas.no
- [ ] Consider supporting public inbox
- [ ] Make the server multi-user
- [ ] Add collection of likes, comments and announces to each activity.
- [ ] Figure out what to do with mentions.

### Finished
- [X] Write logic for fetching objects from database.
- [X] Create route to give all activities and objects their own id
- [X] Implement id in activites objects
- [X] Check if the unique urls to activites are correct. Perhaps skip the collection part and go for activites?
- [X] Implement shared inbox delivery
- [X] Add timestamps to all activities
- [X] Fixed counters for likes and announces, as well as undos for these. 
- [X] Fixed working url for notes.
- [X] Handled incoming notes from followed users.
 