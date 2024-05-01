# Sneaas.no - ActivityPub implementation for a personal blog


### To do
- [ ] Write logic for fetching objects from database.
- [ ] Add timestamps to all activities
- [ ] Add authentication
- [ ] Add route to /favicon.ico
- [ ] Consider adding "/api/v1/timelines/public?limit=100", "/api/v1/streaming/public" and "/api/v1/instance/peers"
- [ ] Add route to /robots.txt
- [ ] Check what happens when webfinger is hit with @www.sneaas.no instead of @sneaas.no
- [ ] Check if the unique urls to activites are correct. Perhaps skip the collection?

### Finished
- [X] Create route to give all activities and objects their own id
- [X] Implement id in activites objects
