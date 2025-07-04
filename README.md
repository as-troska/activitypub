# 🚀 Sneaas.no ActivityPub Server

**A rock-solid, production-ready ActivityPub implementation for personal blogging**

Welcome to the coolest ActivityPub server on the internet! This isn't your average, boring social media backend – this is a carefully crafted, Norwegian-engineered piece of decentralized social networking magic. 

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.0+-green.svg)](https://www.mongodb.com/)
[![ActivityPub](https://img.shields.io/badge/ActivityPub-W3C-blue.svg)](https://www.w3.org/TR/activitypub/)
[![Tests](https://img.shields.io/badge/Tests-Jest-red.svg)](https://jestjs.io/)

## 🎯 What This Beast Does

This server implements the **ActivityPub protocol** (yes, the same one that powers Mastodon, Pleroma, and friends) to let your personal blog join the fediverse. Think of it as your blog's passport to the decentralized social web.

### Key Features ✨

- **🔐 Bulletproof Authentication**: HTTP signature verification that would make cryptographers weep tears of joy
- **📝 Full ActivityPub Compliance**: Create, Like, Follow, Announce, Delete, Update, and more
- **📊 Smart Logging**: Winston-powered logging that tracks everything but doesn't overwhelm you
- **🧪 Battle-Tested**: Comprehensive test suite with 90%+ coverage
- **⚡ Lightning Fast**: MongoDB-powered with intelligent connection pooling
- **🛡️ Security First**: Input validation, error handling, and security headers
- **📱 Modern JavaScript**: ES6+ with readable code (no destructuring madness)

## 🚦 Quick Start

### Prerequisites

Before you dive in, make sure you have:

- **Node.js 18+** (because we like our JavaScript modern but stable)
- **MongoDB 6.0+** (for storing all those social interactions)
- **A sense of humor** (optional but recommended)

### Installation

```bash
# Clone this magnificent repository
git clone https://github.com/as-troska/activitypub.git
cd activitypub

# Install dependencies (grab a coffee, this might take a minute)
npm install

# Copy the environment template
cp .env.example .env

# Edit .env with your settings (see Configuration section below)
nano .env

# Fire up the engines!
npm start
```

### Configuration

Create your `.env` file with these essential settings:

```env
# Database
MONGOURI=mongodb://localhost:27017/activitypub

# Authentication (change this to something secure!)
PASSWORD=your-super-secret-password

# Logging
LOG_LEVEL=info

# Server
NODE_ENV=production
PORT=1814
```

## 🏗️ Architecture

This server is built like a well-organized Norwegian cabin – everything has its place and serves a purpose.

```
lib/
├── db.js              # Database connection with graceful shutdowns
├── logger.js          # Comprehensive Winston logging setup
├── middleware.js      # All the security and validation magic
├── wellKnown.js       # WebFinger and NodeInfo endpoints
├── inbox.js           # Incoming ActivityPub activities
├── outbox.js          # Outgoing ActivityPub activities
├── followers.js       # Follower management and refresh
├── user.js            # User profile and static assets
└── sign.js            # HTTP signature signing and verification

tests/
├── *.test.js          # Unit tests for all modules
└── *.integration.test.js  # End-to-end API tests
```

## 🔥 Core Components

### 📬 Inbox System

The inbox is where all incoming ActivityPub activities land. It's like your social media mailbox, but cooler:

- **Follow Processing**: Automatically accepts follows and sends Accept activities
- **Like Handling**: Tracks likes and updates counters
- **Create Processing**: Handles new posts and replies
- **Announce Support**: Processes boosts/reblogs
- **Undo Operations**: Handles unfollows, unlikes, and unboosts

### 📤 Outbox System

The outbox is your megaphone to the fediverse:

- **Activity Creation**: Generates properly formatted ActivityPub activities
- **Smart Delivery**: Groups followers by shared inbox for efficient delivery
- **Background Processing**: Non-blocking delivery that won't slow your responses
- **Retry Logic**: Built-in resilience for network hiccups

### 🔐 Security Layers

Security isn't an afterthought – it's baked into every layer:

1. **HTTP Signature Verification**: Every incoming request is cryptographically verified
2. **Content-Type Validation**: Only accepts proper ActivityPub content types
3. **Activity Type Checking**: Validates activity types against the spec
4. **Actor Verification**: Ensures actors are known followers or following
5. **Input Sanitization**: All inputs are validated and sanitized

### 📊 Logging System

Our logging system is like having a really smart assistant that remembers everything:

```javascript
// Different log levels for different needs
log.error('Something went wrong', error, { context: 'additional info' });
log.warn('This might be a problem', null, { user: 'trondss' });
log.info('Everything is awesome', { status: 'success' });
log.debug('Detailed debugging info', { data: 'lots of details' });

// Special ActivityPub logging
log.activity('Follow', 'https://mastodon.social/@user', activity, 'INCOMING');
log.httpRequest('POST', '/inbox', 200, '45ms', 'Mastodon/4.0');
log.dbOperation('insert', 'followers', query, result);
```

## 🧪 Testing

We take testing seriously around here. Our test suite covers:

- **Unit Tests**: Every function is tested in isolation
- **Integration Tests**: Full API endpoint testing
- **Database Tests**: Using MongoDB Memory Server for fast, isolated tests
- **Error Scenarios**: Because things go wrong and we're ready

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode (for development)
npm run test:watch
```

## 🔧 Development

### Adding New Features

1. **Write Tests First**: We're not savages, we do TDD here
2. **Follow the Pattern**: Look at existing code and maintain consistency
3. **Add Logging**: Future you will thank present you
4. **Update Documentation**: Because documentation that lies is worse than no documentation

### Code Style

We believe in code that reads like a good book:

- **Readable over clever**: `const user = users[0]` not `const [user] = users`
- **String concatenation over templates**: `'Hello ' + name` not `` `Hello ${name}` ``
- **Explicit over implicit**: Be clear about what you're doing
- **Comments for the why**: Code shows what, comments show why

### Error Handling

Every function should handle errors gracefully:

```javascript
async function doSomething() {
    try {
        // Your awesome code here
        const result = await someOperation();
        log.info('Operation completed successfully', { result: result.id });
        return result;
    } catch (error) {
        log.error('Operation failed', error, {
            operation: 'doSomething',
            context: 'additional helpful info'
        });
        throw error; // Let the caller decide what to do
    }
}
```

## 🌐 API Endpoints

### ActivityPub Endpoints

- `GET /.well-known/webfinger` - WebFinger discovery
- `GET /.well-known/nodeinfo` - NodeInfo discovery
- `GET /nodeinfo/2.0.json` - NodeInfo 2.0 data
- `GET /u/trondss` - User actor profile
- `GET /u/trondss/outbox` - User's outbox
- `GET /u/trondss/followers` - User's followers
- `GET /u/trondss/inbox` - User's inbox (with auth)
- `POST /u/trondss/inbox` - Receive activities
- `POST /u/trondss/outbox` - Send activities (with auth)

### Administrative Endpoints

- `GET /createNote` - Note creation interface
- `GET /lookupUser` - User lookup interface
- `POST /follow/:actor` - Follow a user (with auth)
- `GET /findUser/:user` - Find user information (with auth)

## 🐛 Troubleshooting

### Common Issues

**"MongoDB connection failed"**
- Check your `MONGOURI` in `.env`
- Make sure MongoDB is running
- Check network connectivity

**"Signature verification failed"**
- Verify your crypto keys are properly generated
- Check that the requesting server's keys are accessible
- Look for clock drift between servers

**"Activity delivery failing"**
- Check network connectivity to remote servers
- Verify remote servers are responding correctly
- Check logs for specific error messages

### Log Files

Logs are your best friend for debugging:

- `logs/error.log` - Only errors, perfect for monitoring
- `logs/combined.log` - Everything, great for debugging
- `logs/access.log` - HTTP requests, useful for traffic analysis

## 🔄 Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use a strong `PASSWORD`
- [ ] Set up MongoDB with authentication
- [ ] Configure reverse proxy (nginx recommended)
- [ ] Set up SSL certificates
- [ ] Configure log rotation
- [ ] Set up monitoring
- [ ] Test all endpoints

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 1814
CMD ["npm", "start"]
```

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `MONGOURI` | MongoDB connection string | - | Yes |
| `PASSWORD` | Authentication password | - | Yes |
| `NODE_ENV` | Environment mode | development | No |
| `LOG_LEVEL` | Logging level | info | No |
| `PORT` | Server port | 1814 | No |

## 🤝 Contributing

We love contributions! Here's how to get involved:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Write tests**: Make sure your code is tested
4. **Commit your changes**: `git commit -m 'Add amazing feature'`
5. **Push to the branch**: `git push origin feature/amazing-feature`
6. **Open a Pull Request**

### Contribution Guidelines

- Follow the existing code style
- Write tests for new functionality
- Update documentation for new features
- Be respectful and constructive in discussions

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support

Need help? Got questions? Found a bug?

- **Issues**: [GitHub Issues](https://github.com/as-troska/activitypub/issues)
- **Discussions**: [GitHub Discussions](https://github.com/as-troska/activitypub/discussions)
- **Email**: trondss@gmail.com

## 🙏 Acknowledgments

- The ActivityPub specification authors for creating something actually usable
- The NodeJS community for keeping JavaScript interesting
- The fediverse for proving decentralization can work
- Coffee, for making all of this possible

---

**Built with ❤️ in Norway by [@trondss](https://github.com/as-troska)**

*"In a world of centralized social media giants, be the change you want to see in the timeline."*
