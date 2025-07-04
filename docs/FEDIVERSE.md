# 🌍 Fediverse Platform Integration

Your ActivityPub server now supports a wide range of platforms across the fediverse! This guide covers all the platforms, object types, and activities your server can handle.

## 🚀 Supported Platforms

### 📱 Mastodon
The flagship microblogging platform of the fediverse.
- **Object Types**: Note, Image, Video, Audio
- **Common Activities**: Create, Like, Announce (boost), Follow
- **What You Get**: Text posts, media attachments, replies, boosts

### 📸 Pixelfed  
The Instagram alternative for the fediverse.
- **Object Types**: Image, Video, Note
- **Special Features**: Image metadata, alt text, captions
- **Media Support**: JPEG, PNG, GIF, MP4, WebM
- **What You Get**: Photo posts, video posts, stories

### 📚 Bookwyrm
The Goodreads alternative for book lovers.
- **Object Types**: Book, Review, Edition, Work, Author
- **Activities**: Read, Want, Rate, Shelve, Quote
- **Special Features**: ISBN tracking, reading progress, custom shelves
- **What You Get**: Book reviews, reading status, book ratings

### 🎥 PeerTube
The YouTube alternative for video content.
- **Object Types**: Video, Note
- **Special Features**: Video duration, thumbnails, chapters
- **What You Get**: Video posts, comments on videos

### ✍️ WriteFreely / Write.as
Long-form writing platforms.
- **Object Types**: Article, Note
- **Special Features**: Rich text content, word counts
- **What You Get**: Blog posts, essays, articles

### 🗨️ Pleroma
Lightweight microblogging platform.
- **Object Types**: Note, Image, Video, Audio
- **What You Get**: Similar to Mastodon with some platform-specific features

### 📰 Lemmy / kbin
Reddit-style link aggregation and discussion.
- **Object Types**: Note, Article
- **What You Get**: Discussion posts, link shares, comments

## 📊 Object Types Reference

### 📝 Note
Basic text posts (Mastodon, Pleroma, etc.)
```json
{
  "type": "Note",
  "content": "<p>Hello fediverse!</p>",
  "inReplyTo": null
}
```

### 🖼️ Image
Photo posts (Pixelfed, Mastodon)
```json
{
  "type": "Image",
  "url": "https://pixelfed.social/storage/photo.jpg",
  "mediaType": "image/jpeg",
  "name": "Alt text description",
  "summary": "Photo caption"
}
```

### 🎬 Video
Video content (Pixelfed, PeerTube)
```json
{
  "type": "Video",
  "url": "https://peertube.tv/video.mp4",
  "mediaType": "video/mp4",
  "duration": "PT2M30S",
  "name": "Video title"
}
```

### 📄 Article
Long-form content (WriteFreely, Plume)
```json
{
  "type": "Article",
  "name": "Article Title",
  "content": "<p>Full article content...</p>",
  "summary": "Article excerpt"
}
```

### 📖 Book
Book information (Bookwyrm)
```json
{
  "type": "Book",
  "name": "The Great Gatsby",
  "isbn": "9780743273565",
  "author": ["F. Scott Fitzgerald"],
  "published": "1925-04-10"
}
```

### ⭐ Review
Book reviews (Bookwyrm)
```json
{
  "type": "Review",
  "content": "Excellent book with beautiful prose!",
  "inReplyTo": "https://bookwyrm.social/book/123",
  "rating": 4.5
}
```

### 🎵 Audio
Audio content (Funkwhale, podcasts)
```json
{
  "type": "Audio",
  "url": "https://funkwhale.audio/track.mp3",
  "mediaType": "audio/mpeg",
  "duration": "PT3M45S"
}
```

## 🎯 Activity Types Reference

### Core Activities
- **Create**: Publishing new content
- **Update**: Modifying existing content  
- **Delete**: Removing content
- **Like**: Favoriting content
- **Announce**: Sharing/boosting content
- **Follow**: Following users
- **Accept/Reject**: Responding to follow requests
- **Undo**: Reversing previous activities

### Bookwyrm-Specific Activities
- **Read**: Currently reading a book
- **Want**: Want to read a book
- **Rate**: Rating a book (0-5 stars)
- **Shelve**: Adding book to a custom shelf
- **Quote**: Quoting from a book

### Social Activities  
- **Add/Remove**: Managing collections
- **Block**: Blocking users
- **Flag**: Reporting content

## 🔧 Creating Content

### Creating an Image Post (Pixelfed-style)
```bash
curl -X POST https://yourserver.com/u/trondss/outbox \
  -H "Content-Type: application/json" \
  -d '{
    "type": "Create",
    "objectType": "Image",
    "name": "Sunset at the beach",
    "url": "https://example.com/sunset.jpg",
    "mediaType": "image/jpeg",
    "content": "Beautiful sunset I captured yesterday!"
  }'
```

### Creating a Book Review (Bookwyrm-style)
```bash
curl -X POST https://yourserver.com/u/trondss/outbox \
  -H "Content-Type: application/json" \
  -d '{
    "type": "Create",
    "objectType": "Review",
    "content": "This book changed my perspective on life.",
    "book": "https://bookwyrm.social/book/123",
    "rating": 5
  }'
```

### Creating a Reading Status
```bash
curl -X POST https://yourserver.com/u/trondss/outbox \
  -H "Content-Type: application/json" \
  -d '{
    "type": "Read",
    "book": "https://bookwyrm.social/book/123"
  }'
```

### Creating a Long-form Article (WriteFreely-style)
```bash
curl -X POST https://yourserver.com/u/trondss/outbox \
  -H "Content-Type: application/json" \
  -d '{
    "type": "Create",
    "objectType": "Article",
    "title": "My Thoughts on the Fediverse",
    "content": "<p>The fediverse represents a new paradigm...</p>",
    "summary": "An exploration of decentralized social media"
  }'
```

## 💾 Database Collections

Your server automatically organizes different content types:

- **notes** - Text posts and replies
- **images** - Photo content from Pixelfed and others
- **videos** - Video content from PeerTube and Pixelfed
- **articles** - Long-form content from WriteFreely
- **books** - Book information from Bookwyrm
- **reviews** - Book reviews and ratings
- **reading** - Reading status activities
- **want_to_read** - Want-to-read lists
- **ratings** - Book ratings
- **audio** - Audio content

## 🔍 Platform Detection

The server automatically detects which platform activities come from:
- User-Agent headers
- Domain names
- Activity patterns
- Object types used

This enables platform-specific handling and optimizations.

## 🛡️ Validation & Security

### Object Validation
Each object type has specific validation rules:
- **Images**: Must have URL and media type
- **Books**: Must have title/name
- **Reviews**: Must have content and valid rating (0-5)
- **All objects**: Must have unique ID

### Activity Validation
- All activities must have actor, type, and ID
- Object validation for Create activities
- Rating validation for Rate activities
- Platform-specific field validation

### Security Features
- HTTP signature verification
- Content sanitization
- Rate limiting ready
- Comprehensive error logging

## 🔧 Configuration

### Environment Variables
The server respects all standard ActivityPub environment variables and adds:
- Platform-specific user agents
- Media type validation
- Custom object validation rules

### Database Configuration
MongoDB collections are created automatically as new object types are received.

## 🚨 Error Handling

The server provides detailed error responses:
```json
{
  "error": "Bad Request: Invalid object type",
  "details": "Unsupported object type: CustomType",
  "validTypes": ["Note", "Image", "Video", "Article", "Book", "Review"]
}
```

## 📈 Monitoring

Check your logs for platform integration insights:
```
[2023-01-01T00:00:00Z] INFO: Image post received and stored {
  "imageId": "https://pixelfed.social/p/alice/123",
  "actor": "https://pixelfed.social/users/alice",
  "mediaType": "image/jpeg",
  "platform": "pixelfed"
}
```

## 🎉 What This Means

Your ActivityPub server is now a **universal fediverse citizen**! You can:

✅ **Receive photos** from Pixelfed users  
✅ **Get book reviews** from Bookwyrm readers  
✅ **Follow video creators** on PeerTube  
✅ **Read articles** from WriteFreely blogs  
✅ **Interact with** any fediverse platform  

The fediverse is your oyster! 🐚

---

*Need help? Check the logs for detailed activity processing information, or review the comprehensive test suite for examples of all supported activities.*