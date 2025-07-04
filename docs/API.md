# 🌐 API Documentation

This document provides comprehensive information about all available API endpoints in the Sneaas.no ActivityPub server.

## 📋 Table of Contents

- [Authentication](#authentication)
- [ActivityPub Endpoints](#activitypub-endpoints)
- [Administrative Endpoints](#administrative-endpoints)
- [Response Formats](#response-formats)
- [Error Handling](#error-handling)
- [Examples](#examples)

## 🔐 Authentication

### Password Authentication

Some endpoints require password authentication. Include the password in the request body:

```json
{
  "password": "your-configured-password"
}
```

### HTTP Signatures

ActivityPub endpoints use HTTP signature verification for incoming requests. All POST requests to the inbox must include proper HTTP signatures.

## 🎭 ActivityPub Endpoints

### WebFinger Discovery

**GET** `/.well-known/webfinger`

Discovers user information via the WebFinger protocol.

#### Parameters
- `resource` (required): The resource identifier in format `acct:username@domain`

#### Example Request
```
GET /.well-known/webfinger?resource=acct:trondss@sneaas.no
```

#### Example Response
```json
{
  "subject": "acct:trondss@sneaas.no",
  "links": [
    {
      "rel": "self",
      "type": "application/activity+json",
      "href": "https://www.sneaas.no/u/trondss"
    }
  ]
}
```

### NodeInfo Discovery

**GET** `/.well-known/nodeinfo`

Provides NodeInfo discovery information.

#### Example Response
```json
{
  "links": [
    {
      "rel": "http://nodeinfo.diaspora.software/ns/schema/2.0",
      "href": "https://www.sneaas.no/nodeinfo/2.0.json"
    }
  ]
}
```

### NodeInfo Data

**GET** `/nodeinfo/2.0.json`

Returns detailed server information in NodeInfo 2.0 format.

#### Example Response
```json
{
  "version": "2.0",
  "software": {
    "name": "sneaas",
    "version": "1.5.0"
  },
  "protocols": ["activitypub"],
  "services": {
    "inbound": [],
    "outbound": []
  },
  "openRegistrations": false,
  "usage": {
    "users": {
      "total": 1
    }
  },
  "metadata": {
    "nodeName": "Sneaas.no",
    "nodeDescription": "ActivityPub implementation for a personal blog."
  }
}
```

### User Actor Profile

**GET** `/u/trondss`

Returns the ActivityPub actor profile for the user.

#### Headers
- `Accept: application/activity+json` (recommended)

#### Example Response
```json
{
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://w3id.org/security/v1"
  ],
  "id": "https://www.sneaas.no/u/trondss",
  "type": "Person",
  "preferredUsername": "trondss",
  "name": "Trond Sneås Skauge",
  "summary": "Developer and ActivityPub enthusiast",
  "inbox": "https://www.sneaas.no/u/trondss/inbox",
  "outbox": "https://www.sneaas.no/u/trondss/outbox",
  "followers": "https://www.sneaas.no/u/trondss/followers",
  "following": "https://www.sneaas.no/u/trondss/following",
  "publicKey": {
    "id": "https://www.sneaas.no/u/trondss#main-key",
    "owner": "https://www.sneaas.no/u/trondss",
    "publicKeyPem": "-----BEGIN PUBLIC KEY-----..."
  }
}
```

### User Outbox

**GET** `/u/trondss/outbox`

Returns the user's outbox collection with pagination support.

#### Parameters
- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Items per page (default: 50, max: 100)
- `sortOrder` (optional): Sort order (`asc` or `desc`, default: `desc`)

#### Example Response
```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "OrderedCollection",
  "id": "https://www.sneaas.no/u/trondss/outbox",
  "totalItems": 42,
  "first": "https://www.sneaas.no/u/trondss/outbox?page=true",
  "orderedItems": [
    {
      "@context": "https://www.w3.org/ns/activitystreams",
      "id": "https://www.sneaas.no/u/trondss/create/123",
      "type": "Create",
      "actor": "https://www.sneaas.no/u/trondss",
      "published": "2024-01-15T10:30:00Z",
      "object": {
        "id": "https://www.sneaas.no/u/trondss/note/123",
        "type": "Note",
        "content": "<p>Hello, fediverse!</p>"
      }
    }
  ]
}
```

### User Followers

**GET** `/u/trondss/followers`

Returns the user's followers collection.

#### Example Response
```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "summary": "trondss' followers",
  "id": "https://www.sneaas.no/u/trondss/followers",
  "type": "OrderedCollection",
  "totalItems": 15,
  "first": "https://www.sneaas.no/u/trondss/followers?page=true",
  "orderedItems": [
    {
      "id": "https://mastodon.social/@example",
      "type": "Person",
      "preferredUsername": "example",
      "name": "Example User"
    }
  ]
}
```

### User Inbox (GET)

**GET** `/u/trondss/inbox`

Returns public activities from the user's inbox.

#### Example Response
```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "OrderedCollection",
  "totalItems": 5,
  "first": "https://www.sneaas.no/u/trondss/inbox?page=true",
  "orderedItems": [
    {
      "id": "https://example.com/activities/1",
      "type": "Like",
      "actor": "https://mastodon.social/@user",
      "object": "https://www.sneaas.no/u/trondss/note/123"
    }
  ]
}
```

### User Inbox (POST)

**POST** `/u/trondss/inbox`

Receives ActivityPub activities from other servers.

#### Headers
- `Content-Type: application/activity+json`
- `Signature: ...` (HTTP signature required)

#### Request Body
ActivityPub activity object. Supported activity types:
- `Follow`
- `Undo` 
- `Create`
- `Delete`
- `Like`
- `Update`
- `Announce`
- `Block`
- `Accept`

#### Example Request (Follow)
```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "id": "https://mastodon.social/activities/follow-123",
  "type": "Follow",
  "actor": "https://mastodon.social/@user",
  "object": "https://www.sneaas.no/u/trondss"
}
```

#### Example Response
```json
{
  "message": "Activity processed successfully"
}
```

### User Outbox (POST)

**POST** `/u/trondss/outbox`

Creates and publishes ActivityPub activities.

#### Authentication
Requires password authentication.

#### Request Body
Activity object with password field. Supported activity types:
- `Create`
- `Like`
- `Announce`
- `Follow`
- `Undo`

#### Example Request (Create Note)
```json
{
  "type": "Create",
  "content": "Hello, fediverse!",
  "password": "your-password"
}
```

#### Example Response
```json
{
  "message": "Activity posted successfully",
  "id": "https://www.sneaas.no/u/trondss/create/456",
  "type": "Create"
}
```

### Activity Objects

**GET** `/u/trondss/:activityType/:uuid`

Retrieves individual activity objects.

#### Parameters
- `activityType`: Type of activity (`create`, `like`, `announce`, etc.)
- `uuid`: Unique identifier for the activity

#### Example Response
```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "id": "https://www.sneaas.no/u/trondss/create/123",
  "type": "Create",
  "actor": "https://www.sneaas.no/u/trondss",
  "published": "2024-01-15T10:30:00Z",
  "object": {
    "id": "https://www.sneaas.no/u/trondss/note/123",
    "type": "Note",
    "content": "<p>Hello, fediverse!</p>",
    "attributedTo": "https://www.sneaas.no/u/trondss",
    "published": "2024-01-15T10:30:00Z"
  }
}
```

## ⚙️ Administrative Endpoints

### User Registration

**GET** `/registrer`

Returns the user registration page.

### Follow User

**POST** `/follow/:actor`

Follows a remote ActivityPub actor.

#### Authentication
Requires password authentication.

#### Parameters
- `actor`: The ActivityPub actor ID to follow

#### Request Body
```json
{
  "password": "your-password"
}
```

### Find User

**GET** `/findUser/:user`

Looks up information about a user.

#### Authentication
Requires password authentication.

#### Parameters
- `user`: Username to look up

### Create Note Interface

**GET** `/createNote`

Returns the note creation web interface.

### User Lookup Interface

**GET** `/lookupUser`

Returns the user lookup web interface.

## 📋 Response Formats

### Success Responses

All successful API responses return appropriate HTTP status codes:
- `200 OK`: Successful GET requests
- `201 Created`: Successful POST requests for creating resources
- `202 Accepted`: Successful POST requests for processing activities

### ActivityPub Objects

All ActivityPub objects follow the W3C ActivityStreams specification and include:
- `@context`: Always includes the ActivityStreams context
- `id`: Unique identifier for the object
- `type`: Object type (Person, Note, Create, etc.)
- Additional properties specific to the object type

## ❌ Error Handling

### Error Response Format

All error responses follow this format:

```json
{
  "error": "Error type",
  "message": "Human-readable error description"
}
```

### Common HTTP Status Codes

- `400 Bad Request`: Invalid request format or missing required fields
- `401 Unauthorized`: Authentication failed or missing
- `403 Forbidden`: Access denied
- `404 Not Found`: Resource not found
- `415 Unsupported Media Type`: Invalid Content-Type header
- `500 Internal Server Error`: Server-side error
- `503 Service Unavailable`: Temporary service issue

### Common Error Examples

#### Missing Resource Parameter
```json
{
  "error": "Missing required parameter: resource"
}
```

#### Invalid Content Type
```json
{
  "error": "Unsupported Media Type",
  "expected": ["application/ld+json", "application/activity+json"],
  "received": "application/json"
}
```

#### Authentication Failed
```json
{
  "error": "Unauthorized: Invalid password"
}
```

#### Activity Processing Error
```json
{
  "error": "Bad Request: Invalid activity type",
  "type": "InvalidType",
  "validTypes": ["Create", "Update", "Delete", "Follow", "Accept", "Reject", "Like", "Announce", "Undo", "Block", "Flag"]
}
```

## 📝 Examples

### Following a User

1. **Find the user's actor ID via WebFinger:**
```bash
curl "https://mastodon.social/.well-known/webfinger?resource=acct:user@mastodon.social"
```

2. **Follow the user:**
```bash
curl -X POST "https://www.sneaas.no/follow/https://mastodon.social/users/example" \
  -H "Content-Type: application/json" \
  -d '{"password": "your-password"}'
```

### Creating a Note

```bash
curl -X POST "https://www.sneaas.no/u/trondss/outbox" \
  -H "Content-Type: application/activity+json" \
  -d '{
    "type": "Create",
    "content": "Hello, fediverse! This is my first post.",
    "password": "your-password"
  }'
```

### Liking a Remote Post

```bash
curl -X POST "https://www.sneaas.no/u/trondss/outbox" \
  -H "Content-Type: application/activity+json" \
  -d '{
    "type": "Like",
    "object": "https://mastodon.social/@user/12345",
    "password": "your-password"
  }'
```

### Checking Server Info

```bash
# Get NodeInfo discovery
curl "https://www.sneaas.no/.well-known/nodeinfo"

# Get detailed server information
curl "https://www.sneaas.no/nodeinfo/2.0.json"

# Get user profile
curl -H "Accept: application/activity+json" "https://www.sneaas.no/u/trondss"
```

## 🔧 Rate Limiting

Currently, there are no explicit rate limits implemented, but the server includes built-in protections:

- HTTP signature verification for all incoming activities
- Input validation on all endpoints
- Database connection pooling to handle concurrent requests
- Graceful error handling to prevent crashes

## 🎯 Best Practices

### For Client Developers

1. **Always include proper Accept headers** for ActivityPub content
2. **Implement proper HTTP signature signing** for POST requests
3. **Handle errors gracefully** and respect error response codes
4. **Use pagination** for large collections
5. **Cache actor profiles** but respect refresh intervals

### For Server Operators

1. **Use HTTPS in production** (required for ActivityPub)
2. **Set strong passwords** for administrative functions
3. **Monitor logs** for suspicious activity
4. **Keep dependencies updated** for security
5. **Backup your database regularly**

## 📚 Additional Resources

- [ActivityPub Specification](https://www.w3.org/TR/activitypub/)
- [ActivityStreams 2.0](https://www.w3.org/TR/activitystreams-core/)
- [NodeInfo Specification](http://nodeinfo.diaspora.software/)
- [WebFinger Specification](https://tools.ietf.org/html/rfc7033)
- [HTTP Signatures](https://tools.ietf.org/html/draft-cavage-http-signatures-12)