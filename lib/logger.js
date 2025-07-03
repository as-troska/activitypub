const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.printf(function(info) {
        const timestamp = info.timestamp;
        const level = info.level.toUpperCase();
        const message = info.message;
        const stack = info.stack ? '\n' + info.stack : '';
        
        return timestamp + ' [' + level + '] ' + message + stack;
    })
);

// Create the logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    transports: [
        // Error logs (errors only)
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        
        // Combined logs (all levels)
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        
        // Access logs (info level for HTTP requests)
        new winston.transports.File({
            filename: path.join(logsDir, 'access.log'),
            level: 'info',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ]
});

// Add console logging in development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

// Convenience methods for different log levels
function logError(message, error, context) {
    const logMessage = context ? message + ' [Context: ' + JSON.stringify(context) + ']' : message;
    if (error && error.stack) {
        logger.error(logMessage, { stack: error.stack });
    } else {
        logger.error(logMessage);
    }
}

function logWarn(message, context) {
    const logMessage = context ? message + ' [Context: ' + JSON.stringify(context) + ']' : message;
    logger.warn(logMessage);
}

function logInfo(message, context) {
    const logMessage = context ? message + ' [Context: ' + JSON.stringify(context) + ']' : message;
    logger.info(logMessage);
}

function logDebug(message, context) {
    const logMessage = context ? message + ' [Context: ' + JSON.stringify(context) + ']' : message;
    logger.debug(logMessage);
}

// ActivityPub specific logging helpers
function logActivity(type, actor, activity, direction) {
    const message = direction + ' ' + type + ' activity from/to: ' + actor;
    const context = {
        activityType: type,
        actor: actor,
        activityId: activity.id,
        direction: direction
    };
    logInfo(message, context);
}

function logHTTPRequest(method, url, status, responseTime, userAgent) {
    const message = method + ' ' + url + ' - ' + status + ' (' + responseTime + 'ms)';
    const context = {
        method: method,
        url: url,
        status: status,
        responseTime: responseTime,
        userAgent: userAgent
    };
    logInfo(message, context);
}

function logDatabaseOperation(operation, collection, query, result) {
    const message = 'Database ' + operation + ' on ' + collection;
    const context = {
        operation: operation,
        collection: collection,
        query: query ? JSON.stringify(query) : null,
        resultCount: result && result.length ? result.length : null
    };
    logDebug(message, context);
}

module.exports = {
    logger: logger,
    error: logError,
    warn: logWarn,
    info: logInfo,
    debug: logDebug,
    activity: logActivity,
    httpRequest: logHTTPRequest,
    dbOperation: logDatabaseOperation
};