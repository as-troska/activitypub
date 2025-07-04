const log = require('./logger');

// Supported ActivityPub object types
const OBJECT_TYPES = {
    // Core objects
    NOTE: 'Note',
    ARTICLE: 'Article',
    
    // Media objects (Pixelfed, PeerTube, etc.)
    IMAGE: 'Image',
    VIDEO: 'Video',
    AUDIO: 'Audio',
    DOCUMENT: 'Document',
    
    // Social objects
    PERSON: 'Person',
    GROUP: 'Group',
    ORGANIZATION: 'Organization',
    SERVICE: 'Service',
    
    // Collections
    COLLECTION: 'Collection',
    ORDERED_COLLECTION: 'OrderedCollection',
    
    // Events and places
    EVENT: 'Event',
    PLACE: 'Place',
    
    // Bookwyrm objects
    BOOK: 'Book',
    REVIEW: 'Review',
    EDITION: 'Edition',
    WORK: 'Work',
    AUTHOR: 'Author',
    
    // Custom objects
    TOMBSTONE: 'Tombstone',
    MENTION: 'Mention',
    HASHTAG: 'Hashtag',
    EMOJI: 'Emoji'
};

// Supported ActivityPub activity types
const ACTIVITY_TYPES = {
    // Core activities
    CREATE: 'Create',
    UPDATE: 'Update',
    DELETE: 'Delete',
    
    // Social activities
    FOLLOW: 'Follow',
    ACCEPT: 'Accept',
    REJECT: 'Reject',
    LIKE: 'Like',
    DISLIKE: 'Dislike',
    ANNOUNCE: 'Announce',
    UNDO: 'Undo',
    
    // Moderation activities
    BLOCK: 'Block',
    FLAG: 'Flag',
    IGNORE: 'Ignore',
    
    // Collection activities
    ADD: 'Add',
    REMOVE: 'Remove',
    
    // Communication activities
    ARRIVE: 'Arrive',
    LEAVE: 'Leave',
    INVITE: 'Invite',
    JOIN: 'Join',
    
    // Bookwyrm specific activities
    READ: 'Read',
    WANT: 'Want',
    SHELVE: 'Shelve',
    RATE: 'Rate',
    QUOTE: 'Quote',
    
    // Content activities
    VIEW: 'View',
    LISTEN: 'Listen',
    TRAVEL: 'Travel',
    QUESTION: 'Question'
};

// Platform-specific object type mappings
const PLATFORM_OBJECTS = {
    mastodon: [OBJECT_TYPES.NOTE, OBJECT_TYPES.IMAGE, OBJECT_TYPES.VIDEO, OBJECT_TYPES.AUDIO],
    pixelfed: [OBJECT_TYPES.IMAGE, OBJECT_TYPES.VIDEO, OBJECT_TYPES.NOTE],
    bookwyrm: [OBJECT_TYPES.BOOK, OBJECT_TYPES.REVIEW, OBJECT_TYPES.NOTE, OBJECT_TYPES.EDITION, OBJECT_TYPES.WORK],
    peertube: [OBJECT_TYPES.VIDEO, OBJECT_TYPES.NOTE],
    pleroma: [OBJECT_TYPES.NOTE, OBJECT_TYPES.IMAGE, OBJECT_TYPES.VIDEO, OBJECT_TYPES.AUDIO],
    writefreely: [OBJECT_TYPES.ARTICLE, OBJECT_TYPES.NOTE],
    lemmy: [OBJECT_TYPES.NOTE, OBJECT_TYPES.ARTICLE],
    kbin: [OBJECT_TYPES.NOTE, OBJECT_TYPES.ARTICLE]
};

// Database collection mappings
const COLLECTION_MAPPINGS = {
    [OBJECT_TYPES.NOTE]: 'notes',
    [OBJECT_TYPES.ARTICLE]: 'articles',
    [OBJECT_TYPES.IMAGE]: 'images',
    [OBJECT_TYPES.VIDEO]: 'videos',
    [OBJECT_TYPES.AUDIO]: 'audio',
    [OBJECT_TYPES.BOOK]: 'books',
    [OBJECT_TYPES.REVIEW]: 'reviews',
    [OBJECT_TYPES.EVENT]: 'events',
    [OBJECT_TYPES.DOCUMENT]: 'documents'
};

// Activity to collection mappings
const ACTIVITY_COLLECTIONS = {
    [ACTIVITY_TYPES.CREATE]: 'create',
    [ACTIVITY_TYPES.UPDATE]: 'update',
    [ACTIVITY_TYPES.DELETE]: 'delete',
    [ACTIVITY_TYPES.LIKE]: 'like',
    [ACTIVITY_TYPES.ANNOUNCE]: 'announce',
    [ACTIVITY_TYPES.FOLLOW]: 'follow',
    [ACTIVITY_TYPES.ACCEPT]: 'accept',
    [ACTIVITY_TYPES.REJECT]: 'reject',
    [ACTIVITY_TYPES.UNDO]: 'undo',
    [ACTIVITY_TYPES.BLOCK]: 'block',
    [ACTIVITY_TYPES.READ]: 'reading',
    [ACTIVITY_TYPES.WANT]: 'want_to_read',
    [ACTIVITY_TYPES.RATE]: 'ratings'
};

// Validation functions
function isValidObjectType(type) {
    return Object.values(OBJECT_TYPES).includes(type);
}

function isValidActivityType(type) {
    return Object.values(ACTIVITY_TYPES).includes(type);
}

function getCollectionForObject(objectType) {
    return COLLECTION_MAPPINGS[objectType] || 'unknown_objects';
}

function getCollectionForActivity(activityType) {
    return ACTIVITY_COLLECTIONS[activityType] || activityType.toLowerCase();
}

// Platform detection from User-Agent or server domain
function detectPlatform(userAgent, domain) {
    if (!userAgent && !domain) return 'unknown';
    
    const ua = (userAgent || '').toLowerCase();
    const domainLower = (domain || '').toLowerCase();
    
    if (ua.includes('mastodon') || domainLower.includes('mastodon')) return 'mastodon';
    if (ua.includes('pixelfed') || domainLower.includes('pixelfed')) return 'pixelfed';
    if (ua.includes('bookwyrm') || domainLower.includes('bookwyrm')) return 'bookwyrm';
    if (ua.includes('peertube') || domainLower.includes('peertube')) return 'peertube';
    if (ua.includes('pleroma') || domainLower.includes('pleroma')) return 'pleroma';
    if (ua.includes('writefreely') || domainLower.includes('write.as')) return 'writefreely';
    if (ua.includes('lemmy') || domainLower.includes('lemmy')) return 'lemmy';
    if (ua.includes('kbin') || domainLower.includes('kbin')) return 'kbin';
    
    return 'unknown';
}

// Object validation functions
function validateNoteObject(object) {
    const required = ['id', 'type', 'content'];
    for (const field of required) {
        if (!object[field]) {
            throw new Error('Missing required field for Note: ' + field);
        }
    }
    return true;
}

function validateImageObject(object) {
    const required = ['id', 'type', 'url'];
    for (const field of required) {
        if (!object[field]) {
            throw new Error('Missing required field for Image: ' + field);
        }
    }
    
    // Validate image URL and media type
    if (!object.mediaType || !object.mediaType.startsWith('image/')) {
        log.warn('Image object missing or invalid mediaType', null, {
            objectId: object.id,
            mediaType: object.mediaType
        });
    }
    
    return true;
}

function validateVideoObject(object) {
    const required = ['id', 'type', 'url'];
    for (const field of required) {
        if (!object[field]) {
            throw new Error('Missing required field for Video: ' + field);
        }
    }
    
    // Validate video URL and media type
    if (!object.mediaType || !object.mediaType.startsWith('video/')) {
        log.warn('Video object missing or invalid mediaType', null, {
            objectId: object.id,
            mediaType: object.mediaType
        });
    }
    
    return true;
}

function validateBookObject(object) {
    const required = ['id', 'type', 'name'];
    for (const field of required) {
        if (!object[field]) {
            throw new Error('Missing required field for Book: ' + field);
        }
    }
    
    // Bookwyrm-specific fields
    if (object.isbn && !/^[\d-X]+$/.test(object.isbn)) {
        log.warn('Invalid ISBN format', null, {
            objectId: object.id,
            isbn: object.isbn
        });
    }
    
    return true;
}

function validateReviewObject(object) {
    const required = ['id', 'type', 'content', 'inReplyTo'];
    for (const field of required) {
        if (!object[field]) {
            throw new Error('Missing required field for Review: ' + field);
        }
    }
    
    // Validate rating if present
    if (object.rating !== undefined) {
        const rating = parseFloat(object.rating);
        if (isNaN(rating) || rating < 0 || rating > 5) {
            throw new Error('Invalid rating value, must be between 0 and 5');
        }
    }
    
    return true;
}

function validateArticleObject(object) {
    const required = ['id', 'type', 'name', 'content'];
    for (const field of required) {
        if (!object[field]) {
            throw new Error('Missing required field for Article: ' + field);
        }
    }
    return true;
}

// Main object validation function
function validateObject(object) {
    if (!object || !object.type) {
        throw new Error('Object missing or no type specified');
    }
    
    if (!isValidObjectType(object.type)) {
        throw new Error('Unsupported object type: ' + object.type);
    }
    
    // Common fields validation
    if (!object.id) {
        throw new Error('Object missing required id field');
    }
    
    // Type-specific validation
    switch (object.type) {
        case OBJECT_TYPES.NOTE:
            return validateNoteObject(object);
        case OBJECT_TYPES.IMAGE:
            return validateImageObject(object);
        case OBJECT_TYPES.VIDEO:
            return validateVideoObject(object);
        case OBJECT_TYPES.BOOK:
            return validateBookObject(object);
        case OBJECT_TYPES.REVIEW:
            return validateReviewObject(object);
        case OBJECT_TYPES.ARTICLE:
            return validateArticleObject(object);
        default:
            // For other types, just ensure basic required fields
            log.debug('Using basic validation for object type', {
                objectType: object.type,
                objectId: object.id
            });
            return true;
    }
}

// Activity validation
function validateActivity(activity) {
    if (!activity || !activity.type) {
        throw new Error('Activity missing or no type specified');
    }
    
    if (!isValidActivityType(activity.type)) {
        throw new Error('Unsupported activity type: ' + activity.type);
    }
    
    // Common activity fields
    const required = ['id', 'type', 'actor'];
    for (const field of required) {
        if (!activity[field]) {
            throw new Error('Activity missing required field: ' + field);
        }
    }
    
    // Object validation for activities that have objects
    if (activity.object && typeof activity.object === 'object') {
        validateObject(activity.object);
    }
    
    return true;
}

// Content extraction helpers
function extractTextContent(object) {
    if (object.content) return object.content;
    if (object.summary) return object.summary;
    if (object.name) return object.name;
    return '';
}

function extractMediaUrls(object) {
    const urls = [];
    
    if (object.url) {
        if (Array.isArray(object.url)) {
            urls.push(...object.url);
        } else {
            urls.push(object.url);
        }
    }
    
    if (object.attachment) {
        const attachments = Array.isArray(object.attachment) ? object.attachment : [object.attachment];
        attachments.forEach(function(att) {
            if (att.url) urls.push(att.url);
        });
    }
    
    return urls;
}

// Generate platform-specific responses
function generateCreateResponse(objectType, success = true) {
    const responses = {
        [OBJECT_TYPES.NOTE]: {
            success: 'Note created and federated successfully',
            error: 'Failed to create note'
        },
        [OBJECT_TYPES.IMAGE]: {
            success: 'Image post created and federated successfully',
            error: 'Failed to create image post'
        },
        [OBJECT_TYPES.VIDEO]: {
            success: 'Video post created and federated successfully',
            error: 'Failed to create video post'
        },
        [OBJECT_TYPES.BOOK]: {
            success: 'Book added to library successfully',
            error: 'Failed to add book to library'
        },
        [OBJECT_TYPES.REVIEW]: {
            success: 'Review published successfully',
            error: 'Failed to publish review'
        },
        [OBJECT_TYPES.ARTICLE]: {
            success: 'Article published successfully',
            error: 'Failed to publish article'
        }
    };
    
    const response = responses[objectType] || {
        success: 'Content created successfully',
        error: 'Failed to create content'
    };
    
    return success ? response.success : response.error;
}

module.exports = {
    OBJECT_TYPES,
    ACTIVITY_TYPES,
    PLATFORM_OBJECTS,
    COLLECTION_MAPPINGS,
    ACTIVITY_COLLECTIONS,
    isValidObjectType,
    isValidActivityType,
    getCollectionForObject,
    getCollectionForActivity,
    detectPlatform,
    validateObject,
    validateActivity,
    extractTextContent,
    extractMediaUrls,
    generateCreateResponse
};