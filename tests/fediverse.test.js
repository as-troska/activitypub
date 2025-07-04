const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const client = require('../lib/db');
const activityTypes = require('../lib/activityTypes');

let mongoServer;
let app;

beforeAll(async function() {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    process.env.MONGO_URI = mongoUri;
    app = require('../app');
});

afterAll(async function() {
    await client.close();
    await mongoServer.stop();
});

describe('Fediverse Platform Integration', function() {
    
    describe('Activity Type Validation', function() {
        test('should validate all supported object types', function() {
            const validTypes = ['Note', 'Image', 'Video', 'Article', 'Book', 'Review', 'Audio'];
            validTypes.forEach(function(type) {
                expect(activityTypes.isValidObjectType(type)).toBe(true);
            });
        });
        
        test('should validate all supported activity types', function() {
            const validTypes = ['Create', 'Like', 'Follow', 'Read', 'Want', 'Rate', 'Shelve'];
            validTypes.forEach(function(type) {
                expect(activityTypes.isValidActivityType(type)).toBe(true);
            });
        });
        
        test('should reject invalid object types', function() {
            expect(activityTypes.isValidObjectType('InvalidType')).toBe(false);
            expect(activityTypes.isValidObjectType('')).toBe(false);
            expect(activityTypes.isValidObjectType(null)).toBe(false);
        });
        
        test('should detect platforms correctly', function() {
            expect(activityTypes.detectPlatform('Mastodon/1.0', '')).toBe('mastodon');
            expect(activityTypes.detectPlatform('pixelfed/1.0', '')).toBe('pixelfed');
            expect(activityTypes.detectPlatform('', 'bookwyrm.social')).toBe('bookwyrm');
            expect(activityTypes.detectPlatform('', 'unknown.com')).toBe('unknown');
        });
    });
    
    describe('Pixelfed Integration', function() {
        test('should handle Pixelfed Image Create activity', async function() {
            const imageActivity = {
                '@context': 'https://www.w3.org/ns/activitystreams',
                id: 'https://pixelfed.social/p/alice/123',
                type: 'Create',
                actor: 'https://pixelfed.social/users/alice',
                published: '2023-01-01T00:00:00Z',
                object: {
                    id: 'https://pixelfed.social/p/alice/123/object',
                    type: 'Image',
                    name: 'Beautiful sunset',
                    summary: 'A photo of a beautiful sunset over the ocean',
                    url: 'https://pixelfed.social/storage/media/abc123.jpg',
                    mediaType: 'image/jpeg',
                    attributedTo: 'https://pixelfed.social/users/alice'
                }
            };
            
            const response = await request(app)
                .post('/u/trondss/inbox')
                .set('Content-Type', 'application/ld+json')
                .send(imageActivity);
                
            expect(response.status).toBe(200);
            
            // Verify image was stored
            const imagesCollection = client.db('activitypub').collection('images');
            const storedImage = await imagesCollection.findOne({ 
                id: 'https://pixelfed.social/p/alice/123/object' 
            });
            expect(storedImage).toBeTruthy();
            expect(storedImage.mediaUrls).toContain('https://pixelfed.social/storage/media/abc123.jpg');
            expect(storedImage.altText).toBe('Beautiful sunset');
        });
        
        test('should handle Pixelfed Video Create activity', async function() {
            const videoActivity = {
                '@context': 'https://www.w3.org/ns/activitystreams',
                id: 'https://pixelfed.social/p/bob/456',
                type: 'Create',
                actor: 'https://pixelfed.social/users/bob',
                published: '2023-01-01T00:00:00Z',
                object: {
                    id: 'https://pixelfed.social/p/bob/456/object',
                    type: 'Video',
                    name: 'Time lapse video',
                    url: 'https://pixelfed.social/storage/media/video123.mp4',
                    mediaType: 'video/mp4',
                    duration: 'PT30S',
                    attributedTo: 'https://pixelfed.social/users/bob'
                }
            };
            
            const response = await request(app)
                .post('/u/trondss/inbox')
                .set('Content-Type', 'application/ld+json')
                .send(videoActivity);
                
            expect(response.status).toBe(200);
            
            // Verify video was stored
            const videosCollection = client.db('activitypub').collection('videos');
            const storedVideo = await videosCollection.findOne({ 
                id: 'https://pixelfed.social/p/bob/456/object' 
            });
            expect(storedVideo).toBeTruthy();
            expect(storedVideo.duration).toBe('PT30S');
            expect(storedVideo.mediaType).toBe('video/mp4');
        });
    });
    
    describe('Bookwyrm Integration', function() {
        test('should handle Bookwyrm Book Create activity', async function() {
            const bookActivity = {
                '@context': 'https://www.w3.org/ns/activitystreams',
                id: 'https://bookwyrm.social/user/reader/activity/123',
                type: 'Create',
                actor: 'https://bookwyrm.social/user/reader',
                published: '2023-01-01T00:00:00Z',
                object: {
                    id: 'https://bookwyrm.social/book/123',
                    type: 'Book',
                    name: 'The Great Gatsby',
                    summary: 'A classic American novel',
                    isbn: '9780743273565',
                    author: ['F. Scott Fitzgerald'],
                    published: '1925-04-10',
                    attributedTo: 'https://bookwyrm.social/user/reader'
                }
            };
            
            const response = await request(app)
                .post('/u/trondss/inbox')
                .set('Content-Type', 'application/ld+json')
                .send(bookActivity);
                
            expect(response.status).toBe(200);
            
            // Verify book was stored
            const booksCollection = client.db('activitypub').collection('books');
            const storedBook = await booksCollection.findOne({ 
                id: 'https://bookwyrm.social/book/123' 
            });
            expect(storedBook).toBeTruthy();
            expect(storedBook.name).toBe('The Great Gatsby');
            expect(storedBook.isbn).toBe('9780743273565');
            expect(storedBook.authors).toContain('F. Scott Fitzgerald');
        });
        
        test('should handle Bookwyrm Review Create activity', async function() {
            const reviewActivity = {
                '@context': 'https://www.w3.org/ns/activitystreams',
                id: 'https://bookwyrm.social/user/reviewer/activity/456',
                type: 'Create',
                actor: 'https://bookwyrm.social/user/reviewer',
                published: '2023-01-01T00:00:00Z',
                object: {
                    id: 'https://bookwyrm.social/user/reviewer/review/456',
                    type: 'Review',
                    content: 'This is an excellent book with beautiful prose.',
                    inReplyTo: 'https://bookwyrm.social/book/123',
                    rating: 4.5,
                    attributedTo: 'https://bookwyrm.social/user/reviewer'
                }
            };
            
            const response = await request(app)
                .post('/u/trondss/inbox')
                .set('Content-Type', 'application/ld+json')
                .send(reviewActivity);
                
            expect(response.status).toBe(200);
            
            // Verify review was stored
            const reviewsCollection = client.db('activitypub').collection('reviews');
            const storedReview = await reviewsCollection.findOne({ 
                id: 'https://bookwyrm.social/user/reviewer/review/456' 
            });
            expect(storedReview).toBeTruthy();
            expect(storedReview.rating).toBe(4.5);
            expect(storedReview.bookId).toBe('https://bookwyrm.social/book/123');
        });
        
        test('should handle Bookwyrm Read activity', async function() {
            const readActivity = {
                '@context': 'https://www.w3.org/ns/activitystreams',
                id: 'https://bookwyrm.social/user/reader/activity/789',
                type: 'Read',
                actor: 'https://bookwyrm.social/user/reader',
                object: 'https://bookwyrm.social/book/123',
                published: '2023-01-01T00:00:00Z',
                startTime: '2023-01-01T00:00:00Z',
                endTime: '2023-01-15T00:00:00Z'
            };
            
            const response = await request(app)
                .post('/u/trondss/inbox')
                .set('Content-Type', 'application/ld+json')
                .send(readActivity);
                
            expect(response.status).toBe(200);
            
            // Verify reading status was stored
            const readingCollection = client.db('activitypub').collection('reading');
            const storedReading = await readingCollection.findOne({ 
                id: 'https://bookwyrm.social/user/reader/activity/789' 
            });
            expect(storedReading).toBeTruthy();
            expect(storedReading.status).toBe('reading');
            expect(storedReading.book).toBe('https://bookwyrm.social/book/123');
        });
        
        test('should handle Bookwyrm Want activity', async function() {
            const wantActivity = {
                '@context': 'https://www.w3.org/ns/activitystreams',
                id: 'https://bookwyrm.social/user/reader/activity/101',
                type: 'Want',
                actor: 'https://bookwyrm.social/user/reader',
                object: 'https://bookwyrm.social/book/456',
                published: '2023-01-01T00:00:00Z'
            };
            
            const response = await request(app)
                .post('/u/trondss/inbox')
                .set('Content-Type', 'application/ld+json')
                .send(wantActivity);
                
            expect(response.status).toBe(200);
            
            // Verify want-to-read status was stored
            const wantCollection = client.db('activitypub').collection('want_to_read');
            const storedWant = await wantCollection.findOne({ 
                id: 'https://bookwyrm.social/user/reader/activity/101' 
            });
            expect(storedWant).toBeTruthy();
            expect(storedWant.status).toBe('want_to_read');
            expect(storedWant.book).toBe('https://bookwyrm.social/book/456');
        });
        
        test('should handle Bookwyrm Rate activity', async function() {
            const rateActivity = {
                '@context': 'https://www.w3.org/ns/activitystreams',
                id: 'https://bookwyrm.social/user/reader/activity/202',
                type: 'Rate',
                actor: 'https://bookwyrm.social/user/reader',
                object: 'https://bookwyrm.social/book/123',
                rating: 5,
                published: '2023-01-01T00:00:00Z'
            };
            
            const response = await request(app)
                .post('/u/trondss/inbox')
                .set('Content-Type', 'application/ld+json')
                .send(rateActivity);
                
            expect(response.status).toBe(200);
            
            // Verify rating was stored
            const ratingsCollection = client.db('activitypub').collection('ratings');
            const storedRating = await ratingsCollection.findOne({ 
                id: 'https://bookwyrm.social/user/reader/activity/202' 
            });
            expect(storedRating).toBeTruthy();
            expect(storedRating.rating).toBe(5);
            expect(storedRating.book).toBe('https://bookwyrm.social/book/123');
        });
    });
    
    describe('WriteFreely Integration', function() {
        test('should handle WriteFreely Article Create activity', async function() {
            const articleActivity = {
                '@context': 'https://www.w3.org/ns/activitystreams',
                id: 'https://write.as/writer/activity/123',
                type: 'Create',
                actor: 'https://write.as/writer',
                published: '2023-01-01T00:00:00Z',
                object: {
                    id: 'https://write.as/writer/my-article',
                    type: 'Article',
                    name: 'My Thoughts on Technology',
                    content: '<p>Technology has revolutionized our world...</p>',
                    summary: 'An essay about the impact of technology',
                    attributedTo: 'https://write.as/writer'
                }
            };
            
            const response = await request(app)
                .post('/u/trondss/inbox')
                .set('Content-Type', 'application/ld+json')
                .send(articleActivity);
                
            expect(response.status).toBe(200);
            
            // Verify article was stored
            const articlesCollection = client.db('activitypub').collection('articles');
            const storedArticle = await articlesCollection.findOne({ 
                id: 'https://write.as/writer/my-article' 
            });
            expect(storedArticle).toBeTruthy();
            expect(storedArticle.name).toBe('My Thoughts on Technology');
            expect(storedArticle.wordCount).toBeGreaterThan(0);
        });
    });
    
    describe('Outbox Enhancements', function() {
        test('should create Image post through outbox', async function() {
            const imagePost = {
                type: 'Create',
                objectType: 'Image',
                name: 'My vacation photo',
                url: 'https://example.com/photo.jpg',
                mediaType: 'image/jpeg',
                content: 'Had a great time on vacation!'
            };
            
            const response = await request(app)
                .post('/u/trondss/outbox')
                .set('Content-Type', 'application/json')
                .send(imagePost);
                
            expect(response.status).toBe(201);
            expect(response.body.type).toBe('Create');
            
            // Verify it was saved
            const createCollection = client.db('activitypub').collection('create');
            const storedActivity = await createCollection.findOne({ 
                id: response.body.id 
            });
            expect(storedActivity).toBeTruthy();
            expect(storedActivity.object.type).toBe('Image');
            expect(storedActivity.object.url).toBe('https://example.com/photo.jpg');
        });
        
        test('should create Book through outbox', async function() {
            const bookPost = {
                type: 'Create',
                objectType: 'Book',
                title: 'My Novel',
                isbn: '9781234567890',
                authors: ['John Doe'],
                description: 'A thrilling adventure novel'
            };
            
            const response = await request(app)
                .post('/u/trondss/outbox')
                .set('Content-Type', 'application/json')
                .send(bookPost);
                
            expect(response.status).toBe(201);
            
            // Verify it was saved
            const createCollection = client.db('activitypub').collection('create');
            const storedActivity = await createCollection.findOne({ 
                id: response.body.id 
            });
            expect(storedActivity).toBeTruthy();
            expect(storedActivity.object.type).toBe('Book');
            expect(storedActivity.object.isbn).toBe('9781234567890');
        });
        
        test('should create Bookwyrm Read activity through outbox', async function() {
            const readActivity = {
                type: 'Read',
                book: 'https://bookwyrm.social/book/123'
            };
            
            const response = await request(app)
                .post('/u/trondss/outbox')
                .set('Content-Type', 'application/json')
                .send(readActivity);
                
            expect(response.status).toBe(200);
            
            // Verify it was saved
            const readCollection = client.db('activitypub').collection('read');
            const storedActivity = await readCollection.findOne({ 
                id: response.body.id 
            });
            expect(storedActivity).toBeTruthy();
            expect(storedActivity.object).toBe('https://bookwyrm.social/book/123');
        });
    });
    
    describe('Object Validation', function() {
        test('should validate Note objects correctly', function() {
            const validNote = {
                id: 'https://example.com/note/1',
                type: 'Note',
                content: 'Hello world!'
            };
            expect(function() { activityTypes.validateObject(validNote); }).not.toThrow();
            
            const invalidNote = {
                id: 'https://example.com/note/1',
                type: 'Note'
                // missing content
            };
            expect(function() { activityTypes.validateObject(invalidNote); }).toThrow();
        });
        
        test('should validate Image objects correctly', function() {
            const validImage = {
                id: 'https://example.com/image/1',
                type: 'Image',
                url: 'https://example.com/photo.jpg',
                mediaType: 'image/jpeg'
            };
            expect(function() { activityTypes.validateObject(validImage); }).not.toThrow();
            
            const invalidImage = {
                id: 'https://example.com/image/1',
                type: 'Image'
                // missing url
            };
            expect(function() { activityTypes.validateObject(invalidImage); }).toThrow();
        });
        
        test('should validate Book objects correctly', function() {
            const validBook = {
                id: 'https://example.com/book/1',
                type: 'Book',
                name: 'Test Book'
            };
            expect(function() { activityTypes.validateObject(validBook); }).not.toThrow();
            
            const invalidBook = {
                id: 'https://example.com/book/1',
                type: 'Book'
                // missing name
            };
            expect(function() { activityTypes.validateObject(invalidBook); }).toThrow();
        });
        
        test('should validate Review objects correctly', function() {
            const validReview = {
                id: 'https://example.com/review/1',
                type: 'Review',
                content: 'Great book!',
                inReplyTo: 'https://example.com/book/1',
                rating: 4.5
            };
            expect(function() { activityTypes.validateObject(validReview); }).not.toThrow();
            
            const invalidReview = {
                id: 'https://example.com/review/1',
                type: 'Review',
                content: 'Great book!',
                rating: 6 // invalid rating > 5
            };
            expect(function() { activityTypes.validateObject(invalidReview); }).toThrow();
        });
    });
    
    describe('Content Extraction', function() {
        test('should extract text content from various objects', function() {
            const note = { content: 'Note content' };
            expect(activityTypes.extractTextContent(note)).toBe('Note content');
            
            const article = { name: 'Article title', content: 'Article body' };
            expect(activityTypes.extractTextContent(article)).toBe('Article body');
            
            const book = { name: 'Book title' };
            expect(activityTypes.extractTextContent(book)).toBe('Book title');
        });
        
        test('should extract media URLs from objects', function() {
            const image = {
                url: 'https://example.com/image.jpg',
                attachment: [
                    { url: 'https://example.com/thumb.jpg' }
                ]
            };
            const urls = activityTypes.extractMediaUrls(image);
            expect(urls).toContain('https://example.com/image.jpg');
            expect(urls).toContain('https://example.com/thumb.jpg');
        });
    });
});